import { createSubmissionDocument, getSubmissionCollection } from "../../../lib/server/form-submissions.js";
import { getMongoDebugInfo } from "../../../lib/server/db.js";
import { randomUUID } from "node:crypto";

function errorDetails(error) {
  return {
    name: error?.name,
    code: error?.code,
    errno: error?.errno,
    syscall: error?.syscall,
    hostname: error?.hostname,
    message: error?.message,
    stack: error?.stack,
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await request.json().catch(() => null);
    return payload && typeof payload === "object" ? payload : {};
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export function GET() {
  return json({
    ok: false,
    message: "This endpoint is available and only accepts POST form submissions.",
  }, 405);
}

export async function POST({ request }) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  console.info("[Swishtag form] submit received", {
    requestId,
    method: request.method,
    url: request.url,
    contentType: request.headers.get("content-type") || "",
    mongo: getMongoDebugInfo(),
  });

  try {
    const data = await readPayload(request);
    const result = createSubmissionDocument(data, request);

    console.info("[Swishtag form] payload parsed", {
      requestId,
      source: data?.form_source || data?.source || "",
      fieldKeys: Object.keys(data || {}),
      skipped: Boolean(result.skipped),
      hasValidationError: Boolean(result.error),
    });

    if (result.skipped) {
      console.info("[Swishtag form] honeypot submission skipped", { requestId });
      return json({ ok: true, message: "Thanks. Your request has been received.", requestId });
    }

    if (result.error) {
      console.warn("[Swishtag form] validation failed", {
        requestId,
        status: result.error.status,
        message: result.error.message,
      });
      return json({ ok: false, message: result.error.message, requestId }, result.error.status);
    }

    console.info("[Swishtag form] connecting to collection", {
      requestId,
      formType: result.document.formType,
      collection: getMongoDebugInfo().collection,
    });

    const collection = await getSubmissionCollection();
    const insertResult = await collection.insertOne(result.document);

    console.info("[Swishtag form] submission saved", {
      requestId,
      insertedId: insertResult.insertedId?.toString(),
      formType: result.document.formType,
      durationMs: Date.now() - startedAt,
    });

    return json({
      ok: true,
      message: "Thanks. Your request has been sent to Swishtag.",
      requestId,
    });
  } catch (error) {
    console.error("[Swishtag form] submit failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: errorDetails(error),
      mongo: getMongoDebugInfo(),
    });

    return json({
      ok: false,
      message: "We could not save your request right now. Please try again or email hello@swishtag.com directly.",
      requestId,
    }, 500);
  }
}
