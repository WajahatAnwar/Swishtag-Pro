import { createSubmissionDocument, getSubmissionCollection } from "../../../lib/server/form-submissions.js";

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
  const data = await readPayload(request);
  const result = createSubmissionDocument(data, request);

  if (result.skipped) {
    return json({ ok: true, message: "Thanks. Your request has been received." });
  }

  if (result.error) {
    return json({ ok: false, message: result.error.message }, result.error.status);
  }

  try {
    const collection = await getSubmissionCollection();
    await collection.insertOne(result.document);

    return json({
      ok: true,
      message: "Thanks. Your request has been sent to Swishtag.",
    });
  } catch (error) {
    console.error("Swishtag form database error:", error);
    return json({
      ok: false,
      message: "We could not save your request right now. Please try again or email hello@swishtag.com directly.",
    }, 500);
  }
}
