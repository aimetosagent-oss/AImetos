import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionValue } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const expected = process.env.CONTROL_CENTER_PASSWORD;
  if (!expected || password !== expected) return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(COOKIE_NAME, createSessionValue(), { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 12 * 60 * 60 });
  return response;
}
