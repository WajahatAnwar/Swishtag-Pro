import "dotenv/config";

const siteUrl = (process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
const secret = (process.env.CRON_SECRET || "").trim();
const windowHours = Number(process.env.MEETING_REMINDER_WINDOW_HOURS || "24");

if (!siteUrl) {
  console.error("[Swishtag reminders] SITE_URL is required to run the reminder script.");
  process.exit(1);
}

if (!secret) {
  console.error("[Swishtag reminders] CRON_SECRET is required to run the reminder script.");
  process.exit(1);
}

const endpoint = new URL("/api/cron/daily-reminders", `${siteUrl}/`);
if (Number.isFinite(windowHours) && windowHours > 0) {
  endpoint.searchParams.set("hours", String(windowHours));
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${secret}`,
  },
});

const result = await response.json().catch(() => ({
  ok: false,
  message: "Reminder endpoint did not return JSON.",
}));

console.log(JSON.stringify(result, null, 2));

if (!response.ok || !result.ok) {
  process.exit(1);
}
