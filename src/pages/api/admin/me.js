import { isAdminAuthenticated } from "../../../lib/server/admin-auth.js";

export function GET({ cookies }) {
  return new Response(JSON.stringify({ ok: true, authenticated: isAdminAuthenticated(cookies) }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
