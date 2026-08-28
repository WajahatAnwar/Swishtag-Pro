import { clearAdminSessionCookie } from "../../../lib/server/admin-auth.js";

export function POST({ cookies }) {
  clearAdminSessionCookie(cookies);

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
