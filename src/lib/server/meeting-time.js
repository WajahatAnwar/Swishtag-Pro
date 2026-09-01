function clean(value) {
  return String(value ?? "").trim();
}

function parseDateParts(value) {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseTimeParts(value) {
  const match = clean(value).toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  const meridiem = match[3] || "";

  if (minute < 0 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === "pm") hour += 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return { hour, minute };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc({ year, month, day, hour, minute, timeZone }) {
  try {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
    const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
    let utcDate = new Date(utcGuess.getTime() - offset);
    const correctedOffset = getTimeZoneOffsetMs(utcDate, timeZone);

    if (offset !== correctedOffset) {
      utcDate = new Date(utcGuess.getTime() - correctedOffset);
    }

    return Number.isNaN(utcDate.getTime()) ? null : utcDate;
  } catch {
    return null;
  }
}

function normalizeStoredDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getBookDemoMeetingAt(submission) {
  const fields = submission?.fields || submission || {};
  const storedMeetingAt = normalizeStoredDate(submission?.meetingAt || submission?.meetingAtISO);
  const dateParts = parseDateParts(fields.selectedDateISO || fields.selectedDate);
  const timeParts = parseTimeParts(fields.selectedTime);
  const timeZone = clean(fields.timezone);

  if (!dateParts || !timeParts || !timeZone) return storedMeetingAt;

  return zonedDateTimeToUtc({
    ...dateParts,
    ...timeParts,
    timeZone,
  }) || storedMeetingAt;
}

export function formatMeetingDate(meetingAt, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: clean(timeZone) || "UTC",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(meetingAt);
  } catch {
    return meetingAt.toISOString();
  }
}
