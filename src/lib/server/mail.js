import "dotenv/config";
import net from "node:net";
import tls from "node:tls";
import { randomBytes } from "node:crypto";
import { formatMeetingDate } from "./meeting-time.js";

const fieldLabels = {
  "book-demo": {
    fullName: "Full name",
    workEmail: "Work email",
    companyName: "Company",
    website: "Website",
    solutionInterest: "Solution interest",
    service: "Service",
    intent: "Intent",
    storeCount: "Store count",
    selectedDate: "Selected date",
    selectedTime: "Selected time",
    timezone: "Timezone",
    notes: "Notes",
  },
  "discuss-idea": {
    name: "Name",
    email: "Work email",
    project_type: "Project type",
    stage: "Stage",
    problem: "Problem",
    integrations: "Integrations",
    budget: "Estimated investment",
  },
};

function envValue(key, fallback = "") {
  return (process.env[key] || fallback).trim();
}

function expandEnvTemplate(value) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => process.env[key] || "");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function dotStuff(value) {
  return value.replace(/^\./gm, "..");
}

function normalizeLineEndings(value) {
  return value.replace(/\r?\n/g, "\r\n");
}

function getMailConfig() {
  const fromName = expandEnvTemplate(envValue("MAIL_FROM_NAME", envValue("APP_NAME", "Swishtag"))) || "Swishtag";

  return {
    mailer: envValue("MAIL_MAILER", "smtp").toLowerCase(),
    host: envValue("MAIL_HOST"),
    port: Number(envValue("MAIL_PORT", "587")),
    username: envValue("MAIL_USERNAME"),
    password: envValue("MAIL_PASSWORD"),
    encryption: envValue("MAIL_ENCRYPTION", "tls").toLowerCase(),
    fromAddress: envValue("MAIL_FROM_ADDRESS"),
    fromName,
    to: envValue("MAIL_TO", "hello@swishtag.com"),
  };
}

export function getMailDebugInfo() {
  const config = getMailConfig();

  return {
    mailer: config.mailer,
    host: config.host,
    port: config.port,
    encryption: config.encryption,
    hasUsername: Boolean(config.username),
    hasPassword: Boolean(config.password),
    fromAddress: config.fromAddress,
    to: config.to,
  };
}

function validateMailConfig(config) {
  if (config.mailer !== "smtp") {
    throw new Error("MAIL_MAILER must be smtp.");
  }

  for (const key of ["host", "username", "password", "fromAddress"]) {
    if (!config[key]) {
      throw new Error(`Missing ${key} mail configuration.`);
    }
  }

  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error("MAIL_PORT is invalid.");
  }

  if (!config.fromAddress.includes("@")) {
    throw new Error("MAIL_FROM_ADDRESS is invalid.");
  }
}

function getRecipients(value) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(item => item.includes("@"));
}

function createSocket(config) {
  if (config.encryption === "ssl") {
    return tls.connect({
      host: config.host,
      port: config.port,
      servername: config.host,
    });
  }

  return net.connect({
    host: config.host,
    port: config.port,
  });
}

function waitForLine(socket) {
  return new Promise((resolve, reject) => {
    let response = "";

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };

    const onData = chunk => {
      response += chunk.toString("utf8");
      const lines = response.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || "";

      if (/^\d{3} /.test(lastLine)) {
        cleanup();
        resolve(response);
      }
    };

    const onError = error => {
      cleanup();
      reject(error);
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error("SMTP connection timed out."));
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

async function smtpCommand(socket, command, acceptedCodes) {
  if (command) {
    socket.write(`${command}\r\n`);
  }

  const response = await waitForLine(socket);
  const code = Number(response.slice(0, 3));

  if (!acceptedCodes.includes(code)) {
    throw new Error(`SMTP command failed with code ${code}.`);
  }

  return response;
}

function upgradeToTls(socket, config) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: config.host,
    }, () => resolve(secureSocket));

    secureSocket.once("error", reject);
    secureSocket.setTimeout(20000);
  });
}

function renderTextEmail(fields) {
  return fields.map(([label, value]) => `${label}: ${value || "-"}`).join("\r\n");
}

function renderHtmlEmail(heading, summary, fields) {
  const rows = fields.map(([label, value]) => {
    const displayValue = value || "-";
    const escapedValue = htmlEscape(displayValue);
    const renderedValue = /^https?:\/\//i.test(displayValue)
      ? `<a href="${escapedValue}" style="color:#202124;text-decoration:underline;">${escapedValue}</a>`
      : escapedValue.replace(/\r?\n/g, "<br>");

    return `<tr><td style="padding:12px 14px;border-bottom:1px solid #ecece8;color:#6c6e73;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;width:34%;vertical-align:top;">${htmlEscape(label)}</td><td style="padding:12px 14px;border-bottom:1px solid #ecece8;color:#202124;font-size:14px;line-height:1.45;vertical-align:top;">${renderedValue}</td></tr>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f3;font-family:Arial,Helvetica,sans-serif;color:#202124;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f3;padding:28px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #ecece8;border-radius:18px;overflow:hidden;"><tr><td style="background:#202124;color:#ffffff;padding:24px 28px;"><div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#c2ff02;margin-bottom:10px;">Swishtag Website</div><h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:900;">${htmlEscape(heading)}</h1><p style="margin:10px 0 0;color:#f5f5f3;font-size:14px;line-height:1.5;">${htmlEscape(summary)}</p></td></tr><tr><td style="padding:20px 22px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #ecece8;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;">${rows}</table></td></tr><tr><td style="padding:14px 28px 26px;color:#6c6e73;font-size:12px;line-height:1.5;">This message was sent from the Swishtag website form. Reply directly to follow up with the lead.</td></tr></table></td></tr></table></body></html>`;
}

function createEmailContent(submission) {
  const isBookDemo = submission.formType === "book-demo";
  const labels = fieldLabels[submission.formType] || {};
  const fields = [
    ["Form", isBookDemo ? "Book a Demo" : "Custom Software & Automation"],
    ...Object.entries(labels).map(([key, label]) => [label, submission.fields?.[key] || ""]),
    ["Page", submission.page || ""],
    ["IP", submission.ipAddress || ""],
    ["User agent", submission.userAgent || ""],
  ];

  return {
    subject: isBookDemo
      ? `New book demo request - ${submission.companyName || submission.displayName || "Swishtag website"}`
      : `New custom software idea - ${submission.displayName || "Swishtag website"}`,
    heading: isBookDemo ? "New Book Demo Request" : "New Custom Software Idea",
    summary: isBookDemo
      ? "A lead submitted the Book Demo form and selected a meeting slot."
      : "A lead submitted the Custom Software & Automation form.",
    textBody: renderTextEmail(fields),
    htmlBody: renderHtmlEmail(
      isBookDemo ? "New Book Demo Request" : "New Custom Software Idea",
      isBookDemo
        ? "A lead submitted the Book Demo form and selected a meeting slot."
        : "A lead submitted the Custom Software & Automation form.",
      fields,
    ),
  };
}

function createMeetingReminderContent(submission, meetingAt) {
  const fields = submission.fields || {};
  const meetingTime = formatMeetingDate(meetingAt, fields.timezone);
  const reminderFields = [
    ["Meeting time", meetingTime],
    ["Lead", submission.displayName || fields.fullName || ""],
    ["Work email", submission.email || fields.workEmail || ""],
    ["Company", submission.companyName || fields.companyName || ""],
    ["Solution interest", fields.solutionInterest || ""],
    ["Service", fields.service || ""],
    ["Intent", fields.intent || ""],
    ["Notes", fields.notes || ""],
    ["Page", submission.page || ""],
  ];

  const leadName = submission.displayName || submission.companyName || "a lead";
  const subject = `Reminder: demo with ${leadName} in the next 24 hours`;
  const summary = `${leadName} has a Book Demo meeting scheduled for ${meetingTime}.`;

  return {
    subject,
    heading: "Book Demo Meeting Reminder",
    summary,
    textBody: renderTextEmail(reminderFields),
    htmlBody: renderHtmlEmail("Book Demo Meeting Reminder", summary, reminderFields),
  };
}

async function sendSmtpMessage(config, recipient, content, replyTo) {
  let socket = createSocket(config);
  socket.setTimeout(20000);

  try {
    await smtpCommand(socket, "", [220]);
    await smtpCommand(socket, "EHLO swishtag.com", [250]);

    if (config.encryption === "tls" || config.encryption === "starttls") {
      await smtpCommand(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, config);
      await smtpCommand(socket, "EHLO swishtag.com", [250]);
    }

    await smtpCommand(socket, "AUTH LOGIN", [334]);
    await smtpCommand(socket, Buffer.from(config.username).toString("base64"), [334]);
    await smtpCommand(socket, Buffer.from(config.password).toString("base64"), [235]);
    await smtpCommand(socket, `MAIL FROM:<${config.fromAddress}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${recipient}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);

    const boundary = `swishtag_${randomBytes(12).toString("hex")}`;
    const headers = [
      `From: "${config.fromName.replace(/["\\]/g, "")}" <${config.fromAddress}>`,
      `To: <${recipient}>`,
      `Subject: ${encodeHeader(content.subject)}`,
      `Reply-To: <${replyTo}>`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "X-Mailer: Swishtag Website Form",
    ];

    const message = [
      headers.join("\r\n"),
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(normalizeLineEndings(content.textBody), "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(content.htmlBody, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
      `--${boundary}--`,
      "",
    ].join("\r\n");

    await smtpCommand(socket, `${dotStuff(message)}\r\n.`, [250]);
    await smtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}

export async function sendSubmissionEmail(submission) {
  const config = getMailConfig();
  validateMailConfig(config);

  const recipients = getRecipients(config.to);
  if (!recipients.length) {
    throw new Error("MAIL_TO does not contain a valid recipient.");
  }

  const content = createEmailContent(submission);

  for (const recipient of recipients) {
    await sendSmtpMessage(config, recipient, content, submission.email);
  }

  return {
    recipients,
    subject: content.subject,
  };
}

export async function sendMeetingReminderEmail(submission, meetingAt) {
  const config = getMailConfig();
  validateMailConfig(config);

  const recipients = getRecipients(envValue("MEETING_REMINDER_TO", config.to));
  if (!recipients.length) {
    throw new Error("MEETING_REMINDER_TO or MAIL_TO must contain a valid recipient.");
  }

  const content = createMeetingReminderContent(submission, meetingAt);

  for (const recipient of recipients) {
    await sendSmtpMessage(config, recipient, content, submission.email || config.fromAddress);
  }

  return {
    recipients,
    subject: content.subject,
  };
}
