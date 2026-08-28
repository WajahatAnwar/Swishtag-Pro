import { getDb } from "./db.js";

const COLLECTION_NAME = process.env.FORM_SUBMISSIONS_COLLECTION || "form_submissions";

const bookDemoLabels = {
  fullName: "Full name",
  workEmail: "Work email",
  companyName: "Company",
  website: "Website",
  solutionInterest: "Solution interest",
  service: "Service",
  intent: "Intent",
  storeCount: "Store count",
  selectedDate: "Selected date",
  selectedDateISO: "Selected date ISO",
  selectedTime: "Selected time",
  timezone: "Timezone",
  notes: "Notes",
};

const discussIdeaLabels = {
  name: "Name",
  email: "Work email",
  project_type: "Project type",
  stage: "Stage",
  problem: "Problem",
  integrations: "Integrations",
  budget: "Estimated investment",
};

export const formTypes = {
  bookDemo: "book-demo",
  discussIdea: "discuss-idea",
};

export function cleanString(value, max = 2000) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
  return text.replace(/\r|\0/g, "").trim().slice(0, max);
}

export function normalizeWebsiteUrl(value) {
  const trimmed = cleanString(value, 300);
  if (!trimmed) return "";
  if (/\s/.test(trimmed)) return "";

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (!url.hostname || !url.hostname.includes(".")) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function getSubmissionCollection() {
  return getDb().then(db => db.collection(COLLECTION_NAME));
}

function missingRequiredFields(data, fields) {
  return fields.filter(field => cleanString(data[field] ?? "") === "");
}

export function createSubmissionDocument(data, request) {
  const source = cleanString(data.form_source ?? data.source ?? "", 80);
  const honeypot = cleanString(data.nickname ?? data._gotcha ?? "", 120);

  if (honeypot) {
    return { skipped: true };
  }

  if (source !== "book-demo" && source !== "custom-software") {
    return {
      error: {
        status: 400,
        message: "This form could not be verified. Please refresh and try again.",
      },
    };
  }

  const isBookDemo = source === "book-demo";
  const required = isBookDemo
    ? ["fullName", "workEmail", "companyName", "solutionInterest", "selectedDate", "selectedTime"]
    : ["name", "email", "project_type", "stage", "problem"];
  const missing = missingRequiredFields(data, required);

  if (missing.length) {
    return {
      error: {
        status: 422,
        message: "Please complete all required fields before submitting.",
      },
    };
  }

  const email = cleanString(isBookDemo ? data.workEmail : data.email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      error: {
        status: 422,
        message: "Please enter a valid work email address.",
      },
    };
  }

  const labels = isBookDemo ? bookDemoLabels : discussIdeaLabels;
  const fields = {};

  for (const [key] of Object.entries(labels)) {
    if (key === "website") {
      const rawWebsite = cleanString(data.website ?? "", 300);
      const website = normalizeWebsiteUrl(rawWebsite);
      if (rawWebsite && !website) {
        return {
          error: {
            status: 422,
            message: "Please enter a valid website like google.com or www.google.com.",
          },
        };
      }
      fields.website = website;
      continue;
    }

    fields[key] = cleanString(data[key] ?? "", key === "problem" || key === "notes" ? 3000 : 300);
  }

  const now = new Date();
  const headers = request.headers;

  return {
    document: {
      source,
      formType: isBookDemo ? formTypes.bookDemo : formTypes.discussIdea,
      title: isBookDemo ? "Book Demo" : "Discuss Idea",
      email,
      displayName: cleanString(isBookDemo ? data.fullName : data.name, 160),
      companyName: cleanString(data.companyName ?? "", 160),
      fields,
      page: cleanString(data.page ?? headers.get("referer") ?? "", 500),
      formLoadedAt: cleanString(data.form_loaded_at ?? "", 80),
      ipAddress: cleanString(
        headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "",
        80,
      ),
      userAgent: cleanString(headers.get("user-agent") ?? "", 500),
      emailStatus: "pending",
      emailSentAt: null,
      emailError: "",
      createdAt: now,
      createdAtISO: now.toISOString(),
    },
  };
}

export function serializeSubmission(submission) {
  return {
    id: submission._id?.toString() ?? "",
    source: submission.source ?? "",
    formType: submission.formType ?? "",
    title: submission.title ?? "",
    email: submission.email ?? "",
    displayName: submission.displayName ?? "",
    companyName: submission.companyName ?? "",
    fields: submission.fields ?? {},
    page: submission.page ?? "",
    ipAddress: submission.ipAddress ?? "",
    userAgent: submission.userAgent ?? "",
    emailStatus: submission.emailStatus ?? "",
    emailSentAt: submission.emailSentAt instanceof Date
      ? submission.emailSentAt.toISOString()
      : submission.emailSentAt ?? "",
    emailError: submission.emailError ?? "",
    createdAt: submission.createdAt instanceof Date
      ? submission.createdAt.toISOString()
      : submission.createdAtISO ?? "",
  };
}
