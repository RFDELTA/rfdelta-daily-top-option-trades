export function currentReportDate(now = new Date(), timeZone = process.env.REPORT_TIME_ZONE || "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function resolveReportDate(args: string[], envDate?: string) {
  const index = args.indexOf("--date");
  const positionalDate = args.find((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value));
  const requested = (index >= 0 ? args[index + 1] : undefined) || positionalDate || envDate || "today";
  const date = requested === "today" ? currentReportDate() : requested;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error(`Invalid report date: ${date}`);
  return date;
}
