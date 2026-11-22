// Shared bench rules; no renderer or DOM dependencies.
export const flowAllowed = object => object.open !== false && (object.stopcock == null || object.stopcock > 0);
export function doseCapacity(chem, dose) {
  const requested = Math.max(0, dose);
  const accepted = Math.min(requested, Math.max(0, (chem.cap ?? 250) - chem.V));
  return { accepted, overflow: requested - accepted };
}
export function sampleSnapshot(v) {
  const c = v.chem;
  const solids = [];
  if (v.solid > 1e-8) solids.push({ name: 'NaCl', amount: v.solid, unit: 'g' });
  for (const p of v.particles || []) if (p.m > 1e-8) solids.push({ name: p.cmp?.f || p.sym || '?', amount: p.m, unit: 'g' });
  for (const [name, amount] of Object.entries(c.eq?.ppt || {})) if (amount > 1e-8) solids.push({ name, amount, unit: 'mmol' });
  return {
    volume: c.V, temperature: v.temp, liquid: c.V > 1e-8, solids,
    components: Object.entries(c.tot || {}).filter(([, n]) => n > 1e-10).map(([name, amount]) => ({ name, amount, concentration: c.V > 0 ? amount / c.V : null })),
    solvents: Object.entries(c.solv || {}).filter(([, n]) => n > 1e-10).map(([name, volume]) => ({ name, volume })),
    indicators: Object.entries(c.ind || {}).filter(([, n]) => n > 1e-10).map(([name, amount]) => ({ name, amount }))
  };
}
