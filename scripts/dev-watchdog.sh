#!/usr/bin/env bash
#
# Keeps the dev server up, and reachable from a phone.
#
# `next dev` is bound to every interface rather than just localhost, then
# watched: if it exits, or stays up but stops answering, it is started again.
# The watchdog detaches from the terminal that launched it, so the link keeps
# working after that terminal is closed - the point being that a URL handed to
# a phone should not need anyone tending it.
#
# What it does not survive on its own is a reboot. `install-login` registers it
# as a launch agent so it comes back when you log in; it is not installed
# unless you ask for it, because it starts a server on this Mac every login.
#
#   scripts/dev-watchdog.sh start | stop | restart | status | log | url | backup
#   scripts/dev-watchdog.sh install-login | uninstall-login
#
set -uo pipefail

# pwd -P, not pwd: there is a symlink at the old ~/Desktop path pointing here,
# and the logical path would record *that* - which is the one macOS will not
# let a login agent read. The physical path is the only one worth writing down.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PORT="${PORT:-3000}"

# Local runs use the SQLite file, not BX's live database.
#
# Once the site is deployed, the live database holds real bookings from real
# people. A dev server here reads .env.local, which points at it - so a test
# booking made while trying something out is a real name on a real class
# list, and clearing it out afterwards means deleting live rows. Blanking
# these two makes the store fall back to SQLite; Next will not overwrite a
# variable that is already set, even to nothing.
#
# BX_LIVE=1 opts in, for when looking at real data is the actual point.
if [ -z "${BX_LIVE:-}" ]; then
  export SUPABASE_URL=
  export SUPABASE_SERVICE_ROLE_KEY=
fi
STATE="${TMPDIR:-/tmp}"
PIDFILE="$STATE/bx-watchdog.pid"
CHILDFILE="$STATE/bx-dev-server.pid"
LOG="$STATE/bx-dev.log"
HEALTH="http://127.0.0.1:$PORT/"

# How patient to be before calling the server dead. A cold compile in dev can
# take a while, and restarting mid-compile would turn slow into broken.
CHECK_EVERY=6
CHECK_TIMEOUT=10
FAILS_BEFORE_RESTART=5
BOOT_GRACE=90

# The tunnel is checked far less often than the server. It is a request that
# leaves the machine, and the failure it catches unfolds over minutes.
TUNNEL_CHECK_EVERY=60
TUNNEL_TIMEOUT=20
TUNNEL_FAILS_BEFORE_RESTART=3
tunnel_fails=0

LABEL="com.bx.devwatchdog"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SUPPORT="$HOME/Library/Application Support/bx-fitness-hub"
LAUNCHER="$SUPPORT/watchdog-launcher.sh"
TUNNEL_FLAG="$SUPPORT/tunnel-enabled"      # present = run a public tunnel
TUNNEL_URL="$SUPPORT/tunnel-url"           # the address it is currently on
TUNNEL_PID="$STATE/bx-tunnel.pid"
TUNNEL_LOG="$STATE/bx-tunnel.log"
LAST_BACKUP="$STATE/bx-last-backup"
TUNNEL_CHECKED="$STATE/bx-tunnel-checked"

# How often the database is backed up while the watchdog is running.
BACKUP_EVERY_HOURS="${BACKUP_EVERY_HOURS:-24}"

stamp() { date '+%Y-%m-%d %H:%M:%S'; }
say()   { echo "[$(stamp)] $*" >>"$LOG"; }

# Every address this Mac is currently reachable at, the one carrying the
# default route first.
#
# Not a fixed list of en0..en3: tethering to a phone over USB or Bluetooth
# comes up on whatever interface the system hands out, and hard-coding the
# low-numbered ones prints the home Wi-Fi address long after it stopped
# meaning anything. awdl/llw are AirDrop, utun is a VPN - neither is somewhere
# a phone will reach this server.
lan_ips() {
  local def ip out=""
  def="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
  for i in $def $(ifconfig -l 2>/dev/null); do
    case "$i" in lo0|gif*|stf*|awdl*|llw*|utun*|bridge*) continue ;; esac
    ip="$(ipconfig getifaddr "$i" 2>/dev/null)" || continue
    [ -n "$ip" ] || continue
    case " $out " in *" $ip "*) continue ;; esac
    out="$out $ip"
  done
  echo $out
}

lan_ip() { lan_ips | awk '{print $1}'; }

alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

agent_loaded() { launchctl list 2>/dev/null | grep -q "$LABEL"; }
agent_on()  { launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST" 2>/dev/null; }
agent_off() { launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null; }

watchdog_pid() { [ -f "$PIDFILE" ] && cat "$PIDFILE" 2>/dev/null; }

healthy() { curl -fsS -m "$CHECK_TIMEOUT" -o /dev/null "$HEALTH"; }

tunnel_wanted() { [ -f "$TUNNEL_FLAG" ]; }

# Does the public address actually serve? Asked of Cloudflare, not of the
# process table.
#
# Two different failures look identical from a plain curl, and only one of
# them is worth a new address:
#
#   the far end dropped the tunnel   - the name exists nowhere, it is dead
#   this Mac cannot resolve the name - the tunnel is fine, the resolver is not
#
# The second is routine here: tethered to a phone, the resolver is the
# hotspot's at 172.20.10.1, and it does not pick a freshly minted
# trycloudflare name up for a while. Treating that as a dead tunnel would
# recycle a working one every minute and hand out a new address each time.
#
# So a failure is retried against a public resolver, going straight to the
# address. If it serves by any route it is up; only a name no resolver
# anywhere knows counts as gone.
tunnel_reachable() {
  local url host ip
  url="$(cat "$TUNNEL_URL" 2>/dev/null)"
  [ -n "$url" ] || return 1

  curl -fs -m "$TUNNEL_TIMEOUT" -o /dev/null "$url/" 2>/dev/null && return 0

  command -v dig >/dev/null 2>&1 || return 1
  host="${url#https://}"
  ip="$(dig +short +time=5 +tries=2 @1.1.1.1 "$host" 2>/dev/null \
        | grep -Eo '^[0-9.]+$' | head -1)"
  [ -n "$ip" ] || return 1

  curl -fs -m "$TUNNEL_TIMEOUT" -o /dev/null --resolve "$host:443:$ip" "https://$host/" 2>/dev/null
}

# Can this Mac reach the internet at all?
online() { curl -fsS -m 8 -o /dev/null https://www.cloudflare.com/cdn-cgi/trace; }

# Watch the tunnel end to end, and take a new address if the old one is gone.
#
# Asking whether cloudflared was *running* was not enough, and this is the
# failure that got past it: the Mac loses the network for a while - asleep,
# lid shut, wifi dropped - and the far end drops the quick tunnel's
# registration. cloudflared stays up and retries forever against a name that
# no longer exists ("Unauthorized: Tunnel not found"), so the process looks
# perfectly healthy while the link in someone's hand has stopped resolving.
#
# Recycling costs a new hostname, so it takes several failures in a row, and
# only when the site is up and the Mac is online: a dropped wifi is not a
# reason to burn the address people are already using.
tunnel_watch() {
  local now last
  now="$(date +%s)"
  last="$(cat "$TUNNEL_CHECKED" 2>/dev/null || echo 0)"
  [ $(( now - last )) -lt "$TUNNEL_CHECK_EVERY" ] && return 0
  echo "$now" >"$TUNNEL_CHECKED"

  if tunnel_reachable; then
    [ "$tunnel_fails" -gt 0 ] && say "tunnel: answering again"
    tunnel_fails=0
    return 0
  fi

  # A local server that is down explains a failing tunnel by itself, and the
  # other check is already dealing with it.
  healthy || return 0
  online || { say "tunnel: not answering, but this Mac is offline - waiting"; return 0; }

  tunnel_fails=$(( tunnel_fails + 1 ))
  say "tunnel: public address not answering ($tunnel_fails/$TUNNEL_FAILS_BEFORE_RESTART)"

  if [ "$tunnel_fails" -ge "$TUNNEL_FAILS_BEFORE_RESTART" ]; then
    say "tunnel: the far end has dropped it - taking a new address"
    tunnel_fails=0
    tunnel_kill_strays
    tunnel_start
  fi
}

# Take a backup if enough time has passed since the last one.
#
# Here rather than in a separate schedule because this process is already the
# thing that is always running. A backup is only skipped, never retried into
# a loop: a database that cannot be read is a problem the log should show
# once an hour, not once a second.
maybe_backup() {
  local now last age
  now="$(date +%s)"
  last="$(cat "$LAST_BACKUP" 2>/dev/null || echo 0)"
  age=$(( now - last ))

  [ "$age" -lt $(( BACKUP_EVERY_HOURS * 3600 )) ] && return 0

  echo "$now" >"$LAST_BACKUP"
  if out="$(cd "$ROOT" && node scripts/backup.mjs --quiet 2>&1)"; then
    say "backup taken"
  else
    say "BACKUP FAILED: $out"
  fi
}

# Start a quick tunnel and wait for Cloudflare to name it.
#
# These are anonymous and disposable: no account, and a fresh random hostname
# every single time one starts. So the address is read back out of the log and
# written where `url` can find it, rather than being something anyone can
# memorise or hard-code.
# Every quick tunnel gets its own random hostname, so a stray second copy is
# not a harmless duplicate - it is a second address, and the one written down
# may be the one that is no longer serving. Anything already running for this
# port goes first. Matched on the port so an unrelated cloudflared is left be.
tunnel_kill_strays() {
  pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:$PORT" 2>/dev/null
  sleep 1
  pkill -9 -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:$PORT" 2>/dev/null
  rm -f "$TUNNEL_PID"
  return 0
}

tunnel_start() {
  tunnel_wanted || return 0
  command -v cloudflared >/dev/null 2>&1 || { say "tunnel: cloudflared not installed"; return 1; }

  # Already up and named? Leave it alone - restarting means a new address.
  if alive "$(cat "$TUNNEL_PID" 2>/dev/null)" && [ -s "$TUNNEL_URL" ]; then
    return 0
  fi

  tunnel_kill_strays
  : >"$TUNNEL_LOG"
  cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" \
    >>"$TUNNEL_LOG" 2>&1 &
  echo $! >"$TUNNEL_PID"

  local url=""
  for _ in $(seq 1 40); do
    url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)"
    [ -n "$url" ] && break
    sleep 1
  done

  if [ -n "$url" ]; then
    echo "$url" >"$TUNNEL_URL"
    say "tunnel: $url"
  else
    say "tunnel: did not come up - see $TUNNEL_LOG"
    rm -f "$TUNNEL_URL"
  fi
}

tunnel_stop() {
  tunnel_kill_strays
  rm -f "$TUNNEL_URL"
}

# --- the loop that does the actual watching ------------------------------
supervise() {
  # Keep the Mac awake for as long as this is running.
  #
  # A sleeping laptop is an unreachable website, and pmset on this machine
  # sleeps after a minute idle - so the link handed to a phone would work
  # until nobody touched the keyboard for sixty seconds. -i stops idle sleep
  # and -s stops system sleep on power; the display is deliberately left to
  # sleep normally, because keeping a screen lit all night is a battery cost
  # with nothing to show for it.
  #
  # -w ties it to this process: when the watchdog stops, the Mac is free to
  # sleep again. Nothing is left changed behind it, which is why this is not
  # a pmset setting.
  if command -v caffeinate >/dev/null 2>&1 && [ "${NO_CAFFEINATE:-}" != "1" ]; then
    caffeinate -is -w $$ &
    say "keeping the Mac awake while serving"
  fi

  # One at a time.
  #
  # Asked of the process table, not of a pid file. The file version looked
  # right and failed in practice: `stop` deletes it, so launchd's own respawn
  # and a hand-started copy could both find it missing and both claim to be
  # the only one. Six supervisors and four servers accumulated that way over
  # a single session, fighting over the port - EADDRINUSE in the log and a
  # site that answered or did not depending on which one won.
  #
  # A process cannot lie about existing, so ask about processes.
  local others
  others="$(pgrep -f "dev-watchdog.sh __supervise" 2>/dev/null | grep -v "^$$\$" || true)"
  for other in $others; do
    # Only stand down for one that is genuinely older, so two starting at the
    # same moment cannot both defer and leave nothing running.
    if [ "$other" -lt "$$" ] && kill -0 "$other" 2>/dev/null; then
      say "another watchdog is already running (pid $other) - standing down"
      exit 0
    fi
  done

  # A kill -9, or launchd kickstarting this job, skips the trap below. If a
  # tunnel is still up and still has an address, keep it: it is pointed at the
  # port, so it will pick the new server up and the address people are using
  # stays valid. Only clear a broken one.
  if tunnel_wanted && alive "$(cat "$TUNNEL_PID" 2>/dev/null)" && [ -s "$TUNNEL_URL" ]; then
    say "tunnel: keeping the one already running ($(cat "$TUNNEL_URL"))"
  else
    tunnel_kill_strays
  fi
  # Written here rather than by `start`, so a copy launched by launchd at
  # login is just as findable to status/stop as one started by hand.
  echo $$ >"$PIDFILE"
  say "watchdog up (pid $$), port $PORT"
  # The tunnel is not torn down here. A restart - launchd kickstart, or the
  # server being replaced - arrives as the same SIGTERM as a genuine stop, and
  # tearing it down on both meant every restart handed out a new public
  # address. `stop` and `tunnel off` take it down explicitly; anything else
  # leaves it up for the next supervisor to adopt.
  trap 'say "watchdog asked to stop"; kill "$(cat "$CHILDFILE" 2>/dev/null)" 2>/dev/null; rm -f "$PIDFILE" "$CHILDFILE"; exit 0' TERM INT

  while true; do
    say "starting next dev on 0.0.0.0:$PORT"
    "$ROOT/node_modules/.bin/next" dev -H 0.0.0.0 -p "$PORT" >>"$LOG" 2>&1 &
    local server=$!
    echo "$server" >"$CHILDFILE"

    # Let it boot before judging it.
    local waited=0
    while [ "$waited" -lt "$BOOT_GRACE" ]; do
      alive "$server" || break
      healthy && { say "serving on $PORT"; break; }
      sleep 3; waited=$((waited + 3))
    done

    tunnel_start
    maybe_backup

    local fails=0
    while alive "$server"; do
      # The tunnel is watched too. It gets a new hostname when it comes back,
      # which is why the address is written to a file rather than announced
      # once and assumed to hold.
      if tunnel_wanted; then
        if ! alive "$(cat "$TUNNEL_PID" 2>/dev/null)"; then
          say "tunnel: died - restarting"
          tunnel_start
        else
          tunnel_watch
        fi
      fi

      maybe_backup

      if healthy; then
        fails=0
      else
        fails=$((fails + 1))
        say "no answer ($fails/$FAILS_BEFORE_RESTART)"
        if [ "$fails" -ge "$FAILS_BEFORE_RESTART" ]; then
          say "unresponsive - restarting it"
          kill "$server" 2>/dev/null
          sleep 3
          alive "$server" && kill -9 "$server" 2>/dev/null
          break
        fi
      fi
      sleep "$CHECK_EVERY"
    done

    # The tunnel is deliberately left running. It points at a port, not at a
    # process, so it survives the server restarting - and every restart that
    # took it down handed out a new public address, which meant the link in
    # someone's hand stopped working because a config file changed.
    wait "$server" 2>/dev/null
    rm -f "$CHILDFILE"
    say "server stopped - back in 2s"
    sleep 2
  done
}

# --- commands -------------------------------------------------------------
case "${1:-start}" in
  __supervise) supervise ;;

  start)
    pid="$(watchdog_pid)"
    if alive "$pid"; then echo "Already running (pid $pid)."; "$0" url; exit 0; fi

    # Take the port back if something else is sitting on it, or `next dev`
    # will quietly pick a different one and the link would point nowhere.
    holder="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)"
    if [ -n "$holder" ]; then
      echo "Port $PORT held by pid $holder - stopping it."
      kill "$holder" 2>/dev/null; sleep 2
      kill -0 "$holder" 2>/dev/null && kill -9 "$holder" 2>/dev/null
    fi

    : >"$LOG"
    nohup "$0" __supervise >/dev/null 2>&1 &
    disown 2>/dev/null || true

    printf "Starting"
    for _ in $(seq 1 40); do
      curl -fs -m 3 -o /dev/null "$HEALTH" 2>/dev/null && break
      printf "."; sleep 2
    done
    echo
    "$0" status
    "$0" url
    ;;

  stop)
    # Explicit stop means everything, tunnel included.
    tunnel_stop
    # launchd would only start it straight back, so say so rather than
    # leaving someone wondering why the link refuses to die.
    if agent_loaded; then
      echo "Running as a login agent, which restarts it on sight."
      echo "To stop it for good:  $0 uninstall-login"
      echo "Stopping it for now anyway; the agent will bring it back."
    fi
    pid="$(watchdog_pid)"
    alive "$pid" && kill "$pid" 2>/dev/null && echo "Watchdog stopped."
    child="$(cat "$CHILDFILE" 2>/dev/null)"
    alive "$child" && kill "$child" 2>/dev/null
    sleep 1
    alive "$child" && kill -9 "$child" 2>/dev/null
    rm -f "$PIDFILE" "$CHILDFILE"
    ;;

  restart)
    # Under launchd, a plain stop/start races: killing the watchdog makes
    # KeepAlive respawn it immediately, and the `start` that follows can
    # bring up a second one that then fights for the port. kickstart -k is
    # the same restart done by the thing that owns the process.
    if agent_loaded; then
      if launchctl kickstart -k "gui/$(id -u)/$LABEL" 2>/dev/null; then
        printf "Restarting"
        for _ in $(seq 1 45); do
          curl -fs -m 3 -o /dev/null "$HEALTH" 2>/dev/null && break
          printf "."; sleep 2
        done
        echo
      else
        echo "launchctl kickstart failed; falling back."
        "$0" stop; sleep 2; "$0" start
      fi
    else
      "$0" stop; sleep 1; "$0" start
    fi
    ;;

  status)
    pid="$(watchdog_pid)"
    if alive "$pid"; then echo "Watchdog: running (pid $pid)"; else echo "Watchdog: not running"; fi
    if curl -fsS -m 5 -o /dev/null "$HEALTH"; then echo "Server:   answering on $PORT"; else echo "Server:   not answering"; fi
    # The tunnel is asked whether it *answers*, not whether it is running.
    # A cloudflared retrying against a hostname the far end has forgotten
    # looks alive from here and serves nobody.
    if tunnel_wanted; then
      if [ ! -s "$TUNNEL_URL" ]; then
        echo "Tunnel:   wanted, but has no address yet"
      elif tunnel_reachable; then
        echo "Tunnel:   answering on $(cat "$TUNNEL_URL")"
      else
        echo "Tunnel:   NOT ANSWERING - $(cat "$TUNNEL_URL")"
      fi
    fi
    ;;

  url)
    host="$(scutil --get LocalHostName 2>/dev/null)"
    echo
    echo "  On this Mac:   http://localhost:$PORT"
    first=1
    for ip in $(lan_ips); do
      if [ "$first" = 1 ]; then
        echo "  On your phone: http://$ip:$PORT"
        first=0
      else
        echo "  or:            http://$ip:$PORT"
      fi
    done
    [ -n "$host" ] && echo "  or:            http://$host.local:$PORT   (name, not address)"
    if [ -s "$TUNNEL_URL" ]; then
      echo
      if tunnel_reachable; then
        echo "  Anywhere:      $(cat "$TUNNEL_URL")"
      else
        # Better to say so than to hand someone an address that has died.
        echo "  Anywhere:      $(cat "$TUNNEL_URL")   <- NOT ANSWERING"
      fi
      echo "                 public - anyone with this address can open it."
    elif tunnel_wanted; then
      echo
      echo "  Anywhere:      (tunnel starting - run this again in a moment)"
    fi
    echo
    echo "  The phone has to be on the same network as the Mac - the home"
    echo "  Wi-Fi, or the Mac tethered to the phone's own hotspot."
    echo "  The address changes with the network; run this again to see it."
    ;;

  log) tail -n "${2:-40}" -f "$LOG" ;;

  backup)
    # Take one now, whatever the schedule says.
    date +%s >"$LAST_BACKUP"
    (cd "$ROOT" && node scripts/backup.mjs)
    ;;

  tunnel)
    case "${2:-status}" in
      on)
        command -v cloudflared >/dev/null 2>&1 || {
          echo "cloudflared is not installed.  brew install cloudflared"; exit 1; }
        mkdir -p "$SUPPORT"; : >"$TUNNEL_FLAG"
        echo "Tunnel on. Restarting the watchdog so it picks it up."
        "$0" restart >/dev/null 2>&1
        printf "Waiting for Cloudflare to name it"
        for _ in $(seq 1 45); do
          [ -s "$TUNNEL_URL" ] && break
          printf "."; sleep 1
        done
        echo
        if [ -s "$TUNNEL_URL" ]; then
          "$0" url
          echo "  Off again with: $0 tunnel off"
        else
          echo "It did not come up. See: tail -n 40 $TUNNEL_LOG"
          exit 1
        fi
        ;;
      off)
        rm -f "$TUNNEL_FLAG" "$TUNNEL_URL"
        tunnel_stop
        echo "Tunnel off - that address is dead now. The local links still work."
        "$0" restart >/dev/null 2>&1
        "$0" status
        ;;
      *)
        if tunnel_wanted; then
          if [ -s "$TUNNEL_URL" ]; then echo "Tunnel: $(cat "$TUNNEL_URL")"; else echo "Tunnel: on, no address yet"; fi
        else
          echo "Tunnel: off"
        fi
        ;;
    esac
    ;;

  install-login)
    # Any copy started by hand has to go first, or launchd starts a second
    # one, the second cannot bind the port, and the link ends up served by
    # whichever won - or by neither.
    if agent_loaded; then agent_off; sleep 1; fi
    pid="$(watchdog_pid)"
    if alive "$pid"; then echo "Stopping the hand-started watchdog (pid $pid) first."; "$0" stop >/dev/null 2>&1; sleep 2; fi

    # launchd refuses to *execute* a file inside ~/Desktop, ~/Documents or
    # ~/Downloads - it fails with "Operation not permitted" before the script
    # runs at all. Reading those folders from a process already running is
    # fine, so the agent points at a stub kept outside them, and the stub runs
    # the real script out of the project.
    mkdir -p "$SUPPORT"
    cat >"$LAUNCHER" <<LAUNCH
#!/bin/bash
# Written by dev-watchdog.sh install-login. Kept outside the project because
# launchd will not exec a file from a protected folder; this reads it instead.
cd "$ROOT" || exit 1
exec /bin/bash "$ROOT/scripts/dev-watchdog.sh" __supervise
LAUNCH
    chmod +x "$LAUNCHER"

    # launchd starts with a bare PATH, which will not have node on it.
    node_dir="$(dirname "$(command -v node)")"

    mkdir -p "$(dirname "$PLIST")"
    cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$LAUNCHER</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$node_dir:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PORT</key><string>$PORT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

    if agent_on; then
      printf "Loading"
      for _ in $(seq 1 60); do
        curl -fs -m 3 -o /dev/null "$HEALTH" 2>/dev/null && break
        printf "."; sleep 2
      done
      echo
      "$0" status
      if curl -fs -m 5 -o /dev/null "$HEALTH" 2>/dev/null; then
        echo "Login agent: installed - the link comes back on its own after a reboot."
      else
        echo "Login agent: loaded, but the server did not come up. See: $0 log"
      fi
      "$0" url
      echo "  Undo with: $0 uninstall-login"
    else
      echo "Could not load the agent. Plist written to $PLIST"
      exit 1
    fi
    ;;

  uninstall-login)
    agent_off
    rm -f "$PLIST" "$LAUNCHER"
    echo "Login agent removed. It will no longer come back after a reboot."
    echo "The watchdog is still running for this session; '$0 stop' ends it."
    ;;

  *) echo "usage: $0 start|stop|restart|status|log|url|backup|tunnel on|off|install-login|uninstall-login"; exit 1 ;;
esac
