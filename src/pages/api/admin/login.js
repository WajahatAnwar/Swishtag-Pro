import {
  checkAdminCredentials,
  createAdminSession,
  setAdminSessionCookie,
} from "../../../lib/server/admin-auth.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST({ request, cookies }) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkAdminCredentials(username, password)) {
    return json({ ok: false, message: "Invalid username or password." }, 401);
  }

  const token = createAdminSession(username);
  setAdminSessionCookie(cookies, token, request.url);

  return json({ ok: true });
}
