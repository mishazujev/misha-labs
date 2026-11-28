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

// Aggregate NaCl only; discrete cabinet pieces retain their existing model.
export function saltLanding(grain, receivers, sink) {
 for(const v of receivers)if(!v.held&&!v.stowed&&v.tilt<1&&Math.hypot(grain.x-v.g.position.x,grain.z-v.g.position.z)<v.Ri&&grain.y<=v.g.position.y+v.b+.002)return {kind:'vessel',v};
 const inSink=sink&&grain.x>sink.x0&&grain.x<sink.x1&&grain.z>sink.z0&&grain.z<sink.z1;
 if(inSink)return grain.y<=-sink.depth?{kind:'sink'}:null;
 return grain.y<=.001?{kind:'bench'}:null;
}
export function depositSalt(spills,x,z,mass){
 if(!Number.isFinite(mass)||mass<=0)return null;
 let spill=spills.find(s=>Math.hypot(s.x-x,s.z-z)<.06);if(!spill){spill={x,z,mass:0};spills.push(spill);}spill.mass+=mass;return spill;
}
export function saltInventory(receivers,grains,spills,waste){
 const state={solid:receivers.reduce((n,v)=>n+(v.solid||0),0),dissolved:receivers.reduce((n,v)=>n+Math.min(v.chem.tot.Na||0,v.chem.tot.Cl||0)*58.44/1000,0),inFlight:grains.reduce((n,g)=>n+g.m,0),bench:spills.reduce((n,s)=>n+s.mass,0),collected:waste.collected||0,sink:waste.sink||0};
 state.total=Object.values(state).reduce((n,x)=>n+x,0);return state;
}
