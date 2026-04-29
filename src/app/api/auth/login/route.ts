import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASSWORD = process.env.APP_PASSWORD;
const COOKIE_NAME = "drucker-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!PASSWORD || password === PASSWORD) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}
