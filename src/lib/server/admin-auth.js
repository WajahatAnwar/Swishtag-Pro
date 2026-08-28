import "dotenv/config";
import crypto from "node:crypto";

export const adminSessionCookie = "swishtag_admin_session";

const sessionDurationSeconds = 60 * 60 * 8;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || "change-this-admin-session-secret";
}

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "admin";
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function checkAdminCredentials(username, password) {
  const configuredUsername = getAdminUsername();
  const configuredPassword = getAdminPassword();

  return timingSafeEqualText(username, configuredUsername)
    && timingSafeEqualText(password, configuredPassword);
}

export function createAdminSession(username) {
  const payload = base64UrlEncode(JSON.stringify({
    username,
    exp: Math.floor(Date.now() / 1000) + sessionDurationSeconds,
  }));

  return `${payload}.${signPayload(payload)}`;
}

export function verifyAdminSession(token) {
  if (!token || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeEqualText(signature, signPayload(payload))) {
    return false;
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload));
    return data.username === getAdminUsername() && Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isAdminAuthenticated(cookies) {
  return verifyAdminSession(cookies.get(adminSessionCookie)?.value ?? "");
}

export function setAdminSessionCookie(cookies, token, requestUrl) {
  cookies.set(adminSessionCookie, token, {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: new URL(requestUrl).protocol === "https:",
    maxAge: sessionDurationSeconds,
  });
}

export function clearAdminSessionCookie(cookies) {
  cookies.delete(adminSessionCookie, {
    path: "/",
  });
}
