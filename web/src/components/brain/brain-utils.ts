/** Seeded pseudo-random — deterministic, replaces Math.random() for stable positions */
export function srand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}
