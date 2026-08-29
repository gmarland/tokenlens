export const compact = (x: any) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(x ?? 0));
export const money = (x: any) =>
  x == null
    ? "—"
    : new Intl.NumberFormat("en", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(Number(x));
export const duration = (x: any) =>
  x == null
    ? "—"
    : Number(x) < 1000
      ? `${Math.round(Number(x))} ms`
      : `${(Number(x) / 1000).toFixed(1)} s`;
export const date = (x: any) =>
  x
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(x))
    : "—";
