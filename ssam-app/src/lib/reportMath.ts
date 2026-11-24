export const r1 = (n: number): number => Math.round(n * 10) / 10;

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}
