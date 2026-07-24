import app from "@neo-id/api";
import { NextResponse } from "next/server";

const handler = async (request: Request) => {
  const honoRes = await app.fetch(request);

  // Next.js App Router may swallow Set-Cookie headers from a raw Response
  // returned by Hono. Copy them into a NextResponse so the browser receives
  // them reliably.
  const setCookieHeaders = honoRes.headers.getSetCookie?.() ?? [];

  if (setCookieHeaders.length === 0) {
    // No cookies to forward — return Hono's response as-is
    return honoRes;
  }

  // Clone the response body and all headers, then append each Set-Cookie
  const nextRes = new NextResponse(honoRes.body, {
    status: honoRes.status,
    statusText: honoRes.statusText,
    headers: honoRes.headers,
  });

  // getSetCookie() returns each cookie as a separate string (RFC 6265 §4.1)
  // We delete the combined header first and re-add them one by one so
  // NextResponse doesn't collapse them into a single comma-joined value.
  nextRes.headers.delete("set-cookie");
  for (const cookie of setCookieHeaders) {
    nextRes.headers.append("set-cookie", cookie);
  }

  return nextRes;
};

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
