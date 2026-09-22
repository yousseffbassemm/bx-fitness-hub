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
#   scripts/dev-watchdog.sh start | stop | restart | status | log | url
#   scripts/dev-watchdog.sh install-login | uninstall-login
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
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

stamp() { date '+%Y-%m-%d %H:%M:%S'; }
say()   { echo "[$(stamp)] $*" >>"$LOG"; }

lan_ip() {
  local ip
  for i in en0 en1 en2 en3; do
    ip="$(ipconfig getifaddr "$i" 2>/dev/null)" && [ -n "$ip" ] && { echo "$ip"; return; }
  done
  echo ""
}

alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

watchdog_pid() { [ -f "$PIDFILE" ] && cat "$PIDFILE" 2>/dev/null; }

healthy() { curl -fsS -m "$CHECK_TIMEOUT" -o /dev/null "$HEALTH"; }

# --- the loop that does the actual watching ------------------------------
supervise() {
  say "watchdog up (pid $$), port $PORT"
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

    local fails=0
    while alive "$server"; do
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
    echo $! >"$PIDFILE"
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
    pid="$(watchdog_pid)"
    alive "$pid" && kill "$pid" 2>/dev/null && echo "Watchdog stopped."
    child="$(cat "$CHILDFILE" 2>/dev/null)"
    alive "$child" && kill "$child" 2>/dev/null
    sleep 1
    alive "$child" && kill -9 "$child" 2>/dev/null
    rm -f "$PIDFILE" "$CHILDFILE"
    ;;

  restart) "$0" stop; sleep 1; "$0" start ;;

  status)
    pid="$(watchdog_pid)"
    if alive "$pid"; then echo "Watchdog: running (pid $pid)"; else echo "Watchdog: not running"; fi
    if curl -fsS -m 5 -o /dev/null "$HEALTH"; then echo "Server:   answering on $PORT"; else echo "Server:   not answering"; fi
    ;;

  url)
    ip="$(lan_ip)"
    host="$(scutil --get LocalHostName 2>/dev/null)"
    echo
    echo "  On this Mac:  http://localhost:$PORT"
    [ -n "$ip" ]   && echo "  On your phone: http://$ip:$PORT"
    [ -n "$host" ] && echo "  or (survives the address changing): http://$host.local:$PORT"
    echo
    echo "  Same Wi-Fi as the Mac. Edits reload on both."
    ;;

  log) tail -n "${2:-40}" -f "$LOG" ;;

  install-login)
    plist="$HOME/Library/LaunchAgents/com.bx.devwatchdog.plist"
    mkdir -p "$(dirname "$plist")"
    cat >"$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.bx.devwatchdog</string>
  <key>ProgramArguments</key>
  <array>
    <string>$ROOT/scripts/dev-watchdog.sh</string>
    <string>__supervise</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
    launchctl unload "$plist" 2>/dev/null
    launchctl load "$plist" && echo "Installed. The link now comes back on its own after a reboot."
    echo "Undo with: $0 uninstall-login"
    ;;

  uninstall-login)
    plist="$HOME/Library/LaunchAgents/com.bx.devwatchdog.plist"
    launchctl unload "$plist" 2>/dev/null
    rm -f "$plist" && echo "Removed. It will no longer start at login."
    ;;

  *) echo "usage: $0 start|stop|restart|status|log|url|install-login|uninstall-login"; exit 1 ;;
esac
