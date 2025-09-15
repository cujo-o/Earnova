export function formatCount(n: number | null | undefined) {
  if (!n && n !== 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (Math.round((n / 1000) * 10) / 10).toFixed(1).replace(/\.0$/, "") + "k";
  return (Math.round((n / 1_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, "") + "M";
}
