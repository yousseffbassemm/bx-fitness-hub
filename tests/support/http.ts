/**
 * Calling a route handler the way Next calls it: with a real Request.
 *
 * Every call gets its own caller address by default. The routes are rate
 * limited per caller, and without this a long test file would start getting
 * 429s partway through and fail for a reason that has nothing to do with
 * what it was checking. A test that wants the limiter pins the address.
 */
export const SITE = "https://bx.test";

type Options = {
  ip?: string;
  cookie?: string;
  origin?: string | null;
  host?: string;
};

let caller = 0;
const nextIp = () => `203.0.113.${++caller % 250}`;

function headersFor({ ip, cookie, origin, host = "bx.test" }: Options) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-forwarded-for": ip ?? nextIp(),
    host,
  });
  if (cookie) headers.set("cookie", cookie);
  if (origin) headers.set("origin", origin);
  return headers;
}

export function post(path: string, body: unknown, options: Options = {}) {
  return new Request(`${SITE}${path}`, {
    method: "POST",
    headers: headersFor(options),
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function send(method: string, path: string, body: unknown, options: Options = {}) {
  return new Request(`${SITE}${path}`, {
    method,
    headers: headersFor(options),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function get(path: string, options: Options = {}) {
  return new Request(`${SITE}${path}`, { headers: headersFor(options) });
}

/** Status and parsed body together, which is what an assertion wants. */
export async function read(response: Response) {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body: body as Record<string, unknown> };
}
