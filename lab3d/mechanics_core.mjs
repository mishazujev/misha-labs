/* Shared physical behaviour for interactive laboratory objects. */
export const MECHANICAL_PROFILES = Object.freeze({
  openVessel: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'receiveLiquid', 'pourLiquid', 'pourSolid', 'tilt', 'shake', 'heat', 'sink', 'weigh'],
    geometry: 'open-vessel', carryHeight: .16, collisionRadius: .04,
    liquidStore: 'solution', residualVolume: .4, requiresOpen: false
  }),
  reagentBottle: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'receiveLiquid', 'pourLiquid', 'tilt', 'open', 'weigh'],
    geometry: 'necked-bottle', carryHeight: .19, collisionRadius: .029,
    liquidStore: 'stock', residualVolume: 0, requiresOpen: true, autoOpenOnDrag: true
  }),
  chemicalBottle: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'pourLiquid', 'tilt', 'open', 'weigh'],
    geometry: 'chemical-bottle', carryHeight: .17, collisionRadius: .03,
    requiresOpen: true, autoOpenOnDrag: false
  }),
  chemicalDropper: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'dispenseLiquid', 'tilt', 'open', 'weigh'],
    geometry: 'chemical-dropper', carryHeight: .17, collisionRadius: .022,
    requiresOpen: true, autoOpenOnDrag: false
  }),
  solidJar: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'pourSolid', 'tilt', 'open', 'weigh'],
    geometry: 'solid-jar', carryHeight: .16, collisionRadius: .03,
    requiresOpen: true, autoOpenOnDrag: false
  }),
  gasCylinder: Object.freeze({
    capabilities: ['collide', 'contain', 'ventGas', 'valve'],
    geometry: 'gas-cylinder', carryHeight: 0, collisionRadius: .1,
    requiresOpen: true, autoOpenOnDrag: false
  }),
  gasJar: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'ventGas', 'open', 'weigh'],
    geometry: 'gas-jar', carryHeight: .16, collisionRadius: .03,
    requiresOpen: true, autoOpenOnDrag: false
  }),
  pipette: Object.freeze({
    capabilities: ['carry', 'collide', 'drawLiquid', 'dispenseLiquid', 'dock', 'weigh'],
    geometry: 'pipette', carryHeight: .16, collisionRadius: .012
  }),
  dropper: Object.freeze({
    capabilities: ['carry', 'collide', 'dispenseLiquid', 'dock', 'open', 'weigh'],
    geometry: 'dropper', carryHeight: .17, collisionRadius: .02
  }),
  washBottle: Object.freeze({
    capabilities: ['carry', 'collide', 'dispenseLiquid', 'weigh'],
    geometry: 'wash-bottle', carryHeight: .18, collisionRadius: .032
  }),
  probe: Object.freeze({
    capabilities: ['carry', 'collide', 'immerse', 'weigh'],
    geometry: 'probe', carryHeight: .16, collisionRadius: .012
  }),
  handTool: Object.freeze({
    capabilities: ['carry', 'collide', 'weigh'],
    geometry: 'hand-tool', carryHeight: .16, collisionRadius: .02
  }),
  sampleJar: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'pourSolid', 'tilt', 'open', 'weigh'],
    geometry: 'sample-jar', carryHeight: .16, collisionRadius: .026
  }),
  movableProp: Object.freeze({
    capabilities: ['carry', 'collide', 'weigh'],
    geometry: 'prop', carryHeight: .16, collisionRadius: .03
  })
});

export const PHYSICAL_PHASES = Object.freeze({
  liquid: Object.freeze({ gravity: true, flowsOnTilt: true, transferCapability: 'pourLiquid' }),
  powder: Object.freeze({ gravity: true, flowsOnTilt: true, transferCapability: 'pourSolid' }),
  granularSolid: Object.freeze({ gravity: true, flowsOnTilt: true, transferCapability: 'pourSolid' }),
  solidPiece: Object.freeze({ gravity: true, flowsOnTilt: true, transferCapability: 'pourSolid' }),
  gas: Object.freeze({ gravity: false, flowsOnTilt: false, transferCapability: 'ventGas' })
});

export function applyMechanicalProfile(object, profileName, overrides = {}) {
  const profile = MECHANICAL_PROFILES[profileName];
  if (!profile) throw new Error(`Unknown mechanical profile: ${profileName}`);
  const extra = overrides.capabilities || [];
  object.mechanics = { ...profile, ...overrides, profile: profileName, capabilities: new Set([...profile.capabilities, ...extra]) };
  return object;
}

export const hasMechanicalCapability = (object, capability) => !!(object && object.mechanics && object.mechanics.capabilities.has(capability));
export const mechanicalGeometry = object => object && object.mechanics ? object.mechanics.geometry : null;
export const mechanicalRadius = object => object && object.mechanics ? object.mechanics.collisionRadius : 0;
export const mechanicalCarryHeight = object => object && object.mechanics ? object.mechanics.carryHeight : .16;
export const phaseMechanics = phase => PHYSICAL_PHASES[phase === 'solid' ? 'solidPiece' : phase] || null;
export const canTransferPhase = (object, phase) => {
  const physical = phaseMechanics(phase);
  if (!physical) return false;
  return hasMechanicalCapability(object, physical.transferCapability) ||
    (phase === 'liquid' && hasMechanicalCapability(object, 'dispenseLiquid'));
};
export const containerProfileForPhase = (phase, form = '') => {
  const physical = phaseMechanics(phase);
  if (!physical) return 'movableProp';
  if (physical.transferCapability === 'pourLiquid') return form === 'dropper' ? 'chemicalDropper' : 'chemicalBottle';
  if (physical.transferCapability === 'pourSolid') return 'solidJar';
  if (physical.transferCapability === 'ventGas') return 'gasCylinder';
  return 'movableProp';
};
