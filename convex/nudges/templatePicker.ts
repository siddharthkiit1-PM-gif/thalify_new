export function pickTemplate<T extends { weight?: number }>(
  templates: T[],
): T | null {
  if (templates.length === 0) return null;
  if (templates.length === 1) return templates[0];

  const totalWeight = templates.reduce((sum, t) => sum + (t.weight ?? 1.0), 0);
  let r = Math.random() * totalWeight;

  for (const t of templates) {
    const w = t.weight ?? 1.0;
    if (r < w) return t;
    r -= w;
  }
  return templates[templates.length - 1];
}
