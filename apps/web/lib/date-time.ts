export type TimestampFormat = "date" | "compact" | "detail";

export function formatLocalTimestamp(
  value: string | number | Date,
  format: TimestampFormat = "detail",
  timeZone?: string,
) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  const options: Intl.DateTimeFormatOptions = format === "date"
    ? { month: "short", day: "numeric", year: "2-digit" }
    : format === "compact"
      ? {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }
      : {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
          timeZoneName: "short",
        };

  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(date);
}
