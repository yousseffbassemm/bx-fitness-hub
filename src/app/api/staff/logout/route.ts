import { NextResponse } from "next/server";
import { STAFF_COOKIE } from "@/lib/staff/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/staff/login", request.url), {
    status: 303,
  });
  response.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
