export function parseDecimal(value, fallback = Number.NaN) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatDecimal(value, decimals = 4) {
  if (!Number.isFinite(value)) return '';
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, '').replace('.', ',');
}
