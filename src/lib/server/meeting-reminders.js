import { getSubmissionCollection, formTypes } from "./form-submissions.js";
import { getBookDemoMeetingAt } from "./meeting-time.js";
import { sendMeetingReminderEmail } from "./mail.js";

function errorDetails(error) {
  return {
    name: error?.name,
    code: error?.code,
    message: error?.message,
    stack: error?.stack,
  };
}

function getReminderEligibility(staleSendingBefore) {
  return [
    {
      $or: [
        { reminderSentAt: null },
        { reminderSentAt: { $exists: false } },
      ],
    },
    {
      $or: [
        { reminderStatus: { $exists: false } },
        { reminderStatus: { $in: ["pending", "failed"] } },
        {
          reminderStatus: "sending",
          reminderStartedAt: { $lt: staleSendingBefore },
        },
      ],
    },
  ];
}

function isInsideReminderWindow(meetingAt, now, windowEnd) {
  return meetingAt instanceof Date
    && !Number.isNaN(meetingAt.getTime())
    && meetingAt >= now
    && meetingAt <= windowEnd;
}

export async function runDailyMeetingReminders({
  now = new Date(),
  windowHours = 24,
  limit = 500,
} = {}) {
  const collection = await getSubmissionCollection();
  const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
  const staleSendingBefore = new Date(now.getTime() - 60 * 60 * 1000);
  const eligibility = getReminderEligibility(staleSendingBefore);

  const candidates = await collection
    .find({
      formType: formTypes.bookDemo,
      $and: eligibility,
      $or: [
        { meetingAt: { $gte: now, $lte: windowEnd } },
        { meetingAt: null },
        { meetingAt: { $exists: false } },
      ],
    })
    .sort({ meetingAt: 1, createdAt: -1 })
    .limit(limit)
    .toArray();

  const results = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const submission of candidates) {
    const meetingAt = getBookDemoMeetingAt(submission);
    const id = submission._id?.toString() || "";

    if (!meetingAt) {
      skipped += 1;
      await collection.updateOne(
        { _id: submission._id },
        {
          $set: {
            reminderStatus: "missing_meeting_time",
            reminderError: "Could not parse selectedDateISO, selectedTime, and timezone.",
            reminderCheckedAt: now,
          },
        },
      );
      results.push({ id, status: "missing_meeting_time" });
      continue;
    }

    if (!isInsideReminderWindow(meetingAt, now, windowEnd)) {
      skipped += 1;
      if (!submission.meetingAt) {
        await collection.updateOne(
          { _id: submission._id },
          {
            $set: {
              meetingAt,
              meetingAtISO: meetingAt.toISOString(),
              reminderCheckedAt: now,
            },
          },
        );
      }
      results.push({ id, status: "outside_window", meetingAt: meetingAt.toISOString() });
      continue;
    }

    const lockResult = await collection.updateOne(
      {
        _id: submission._id,
        $and: getReminderEligibility(staleSendingBefore),
      },
      {
        $set: {
          reminderStatus: "sending",
          reminderStartedAt: now,
          reminderCheckedAt: now,
          meetingAt,
          meetingAtISO: meetingAt.toISOString(),
        },
        $unset: {
          reminderError: "",
        },
      },
    );

    if (!lockResult.matchedCount) {
      skipped += 1;
      results.push({ id, status: "already_locked_or_sent" });
      continue;
    }

    try {
      const mailResult = await sendMeetingReminderEmail(submission, meetingAt);
      const reminderSentAt = new Date();

      await collection.updateOne(
        { _id: submission._id },
        {
          $set: {
            reminderStatus: "sent",
            reminderSentAt,
            reminderError: "",
            reminderRecipients: mailResult.recipients,
            reminderSubject: mailResult.subject,
          },
        },
      );

      sent += 1;
      results.push({
        id,
        status: "sent",
        meetingAt: meetingAt.toISOString(),
        recipients: mailResult.recipients,
      });
    } catch (error) {
      failed += 1;
      await collection.updateOne(
        { _id: submission._id },
        {
          $set: {
            reminderStatus: "failed",
            reminderError: error?.message || "Reminder email failed.",
          },
        },
      );

      results.push({
        id,
        status: "failed",
        meetingAt: meetingAt.toISOString(),
        error: errorDetails(error),
      });
    }
  }

  return {
    ok: failed === 0,
    checked: candidates.length,
    sent,
    failed,
    skipped,
    windowStart: now.toISOString(),
    windowEnd: windowEnd.toISOString(),
    results,
  };
}
