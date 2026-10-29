/* Shared physical behaviour for interactive laboratory objects.
   Chemical identity never belongs here: an HCl bottle and a water bottle use
   the same bottle profile, while phase and reaction data stay in chemistry. */
export const MECHANICAL_PROFILES = Object.freeze({
  openVessel: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'receiveLiquid', 'pourLiquid', 'pourSolid', 'tilt', 'shake', 'heat', 'sink', 'weigh'],
    geometry: 'open-vessel', carryHeight: .16, collisionRadius: .04,
    liquidStore: 'solution', residualVolume: .4, requiresOpen: false
  }),
  reagentBottle: Object.freeze({
    capabilities: ['carry', 'collide', 'contain', 'receiveLiquid', 'pourLiquid', 'tilt', 'open', 'weigh'],
    geometry: 'necked-bottle', carryHeight: .19, collisionRadius: .029,
    liquidStore: 'stock', residualVolume: 0, requiresOpen: true
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
    capabilities: ['carry', 'collide', 'contain', 'dispenseSolid', 'open', 'weigh'],
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
  object.mechanics = {
    ...profile,
    ...overrides,
    profile: profileName,
    capabilities: new Set([...profile.capabilities, ...extra])
  };
  return object;
}

export const hasMechanicalCapability = (object, capability) =>
  !!(object && object.mechanics && object.mechanics.capabilities.has(capability));

export const mechanicalGeometry = object => object && object.mechanics ? object.mechanics.geometry : null;
export const mechanicalRadius = object => object && object.mechanics ? object.mechanics.collisionRadius : 0;
export const mechanicalCarryHeight = object => object && object.mechanics ? object.mechanics.carryHeight : .16;
export const phaseMechanics = phase => PHYSICAL_PHASES[phase === 'solid' ? 'solidPiece' : phase] || null;
export const canTransferPhase = (object, phase) => {
  const physical = phaseMechanics(phase);
  return !!physical && hasMechanicalCapability(object, physical.transferCapability);
};
