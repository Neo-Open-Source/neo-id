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

// OPTIONS must be forwarded to Hono too: without this export, Next.js answers
// the CORS preflight itself with a bare 204 (no Access-Control-Allow-* headers),
// so the browser blocks the PKCE token exchange even though the Hono cors
// middleware is configured. Forwarding lets the middleware emit the headers.
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as DELETE,
  handler as PATCH,
  handler as OPTIONS,
};
