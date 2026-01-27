/**
 * Empire: Wargame of the Century
 * Core Game Types (TypeScript port from D)
 */

// ========== Type Aliases ==========

/** Map location (0 to MAPSIZE-1) */
export type Location = number;

/** Direction (-1 to 7) */
export type Direction = number;

// ========== Constants ==========

export const Mrowmx = 59;           // Maximum row index
export const Mcolmx = 99;           // Maximum column index
export const MAPSIZE = (Mrowmx + 1) * (Mcolmx + 1);  // 6000 total locations

export const CITMAX = 70;           // Maximum number of cities
export const UNIMAX = 500;          // Maximum number of units
export const TYPMAX = 8;            // Number of unit types
export const PLYMAX = 6;            // Maximum number of players
export const LOCMAX = 10;           // Maximum locations tracked for AI
export const MAPMAX = 4 + PLYMAX * 10;  // Map element types

// ========== Unit Type Constants ==========

export const UnitType = {
  A: 0,     // Army
  F: 1,     // Fighter
  D: 2,     // Destroyer
  T: 3,     // Troop Transport
  S: 4,     // Submarine
  R: 5,     // Cruiser
  C: 6,     // Aircraft Carrier
  B: 7,     // Battleship
} as const;

export type UnitTypeId = typeof UnitType[keyof typeof UnitType];

// Special map type markers
export const J = -1;    // Not a unit or city
export const X = -2;    // City

// ========== Unit Type Masks (for AI targeting) ==========

export const UnitMask = {
  mA: 0x80,
  mF: 0x40,
  mD: 0x20,
  mT: 0x10,
  mS: 0x08,
  mR: 0x04,
  mC: 0x02,
  mB: 0x01,
} as const;

// ========== Map Values ==========

export const MapValue = {
  UNKNOWN: 0,   // Unexplored ' '
  CITY: 1,      // City '*'
  SEA: 2,       // Sea '.'
  LAND: 3,      // Land '+'
} as const;

export type MapValueType = typeof MapValue[keyof typeof MapValue];

// ========== IFO (Information/Orders) Constants ==========

export const IFO = {
  NONE: 0,          // No orders
  GOTO_T: 1,        // Army going to transport
  DIR_KAM: 2,       // Fighter kamikaze direction
  DIR: 3,           // Moving in direction
  TAR_KAM: 4,       // Fighter kamikaze to target
  TAR: 5,           // Moving to target location
  GOTO_C: 6,        // Fighter going to carrier
  CITY: 7,          // Going to city
  DAMAGED: 8,       // Ship damaged, going to port
  STATION: 9,       // Carrier stationed
  G_STATION: 10,    // Going to station
  CITY_TAR: 11,     // Ship targeting city
  ESCORT: 12,       // Escorting transport
  SHIP_EXPLOR: 13,  // Ship exploring
  LOAD_ARMY: 14,    // Transport loading armies
  A_CITY_TAR: 15,   // Army targeting city
  FOL_SHORE: 16,    // Following shoreline
  ON_BOARD: 17,     // Army on transport
} as const;

// Human player function codes
export const Fn = {
  AW: 0,    // Awake (no automatic movement)
  SE: 1,    // Sentry mode
  RA: 2,    // Random movement
  MO: 3,    // Move to location
  DI: 4,    // Move in direction
  FI: 5,    // Fill (load troops/fighters)
} as const;

// ========== Mode Constants ==========

export const Mode = {
  NONE: 0,
  MOVE: 1,
  SURV: 2,    // Survey mode
  DIR: 3,     // Direction input
  TO: 4,      // To (destination) mode
  PHAS: 5,    // Phase selection
} as const;

// ========== Key Constants ==========

export const Keys = {
  ESC: 27,
  SPACE: 32,
  // Direction keys (QWEASDZXC pattern)
  Q: 81, W: 87, E: 69,
  A: 65, D: 68,
  Z: 90, X: 88, C: 67,
  S: 83,
  // Command keys
  F: 70,  // From
  G: 71,  // Go to city/carrier
  H: 72,  // Help
  K: 75,  // Wake up
  L: 76,  // Load
  P: 80,  // Production
  R: 82,  // Random
  T: 84,  // To
  Y: 89,  // Survey
} as const;

// ========== Structures ==========

/**
 * Unit type definition.
 * Contains static properties for each unit type.
 */
export interface UnitTypeInfo {
  char: string;       // Display character (A, F, D, T, S, R, C, B)
  hits: number;       // Hit points / fuel capacity
  phstart: number;    // Starting production time
  prodtime: number;   // Production time (rounds)
  name: string;       // Full name
}

/**
 * Unit instance.
 * Represents a single game unit (army, ship, fighter, etc.)
 */
export interface Unit {
  loc: Location;      // Current location (0 if destroyed)
  own: number;        // Owner player number (1-6)
  typ: UnitTypeId;    // Unit type (A, F, D, T, S, R, C, B)
  hit: number;        // Current hit points / fuel remaining
  ifo: number;        // Current orders (IFO constant)
  ila: number;        // Order parameter (location, direction, or unit#)
  dir: number;        // Preferred turn direction (-1 or 1)
  mov: boolean;       // Has moved this round?
  fuel: number;       // Fuel remaining (fighters)
  abd: number;        // Units aboard (transports/carriers)
}

/**
 * City instance.
 * Represents a city on the map.
 */
export interface City {
  loc: Location;      // Location on map (0 if doesn't exist)
  own: number;        // Owner player number (0=neutral, 1-6=player)
  phs: number;        // Production phase (-1=none, 0-7=unit type)
  fnd: number;        // Round when current production completes
  fipath: Location;   // Fighter patrol destination
  round: number;      // Used by AI for various purposes
}

/**
 * Player state.
 */
export interface Player {
  num: number;            // Player number (1..numply)
  round: number;          // Current round number
  map: Uint8Array;        // Player's view of the map
  human: boolean;         // Is human player?
  defeat: boolean;        // Is defeated?
  movedone: boolean;      // Completed move this turn?
  uninum: number;         // Current unit index
  secflg: boolean;        // Move by sector flag
  turns: number;          // Number of turns completed

  // Human player state
  mode: number;           // Current input mode
  curloc: Location;       // Cursor location
  frmloc: Location;       // From location (for TO mode)
  maxrng: number;         // Maximum range
  citnum: number;         // Current city number
  savmod: number;         // Saved mode
  nrdy: boolean;          // Not ready flag

  // Computer AI state
  target: boolean[];      // Target flags for cities
  troopt: number[][];     // Ship sighting locations
  loci: Location[];       // Enemy army sightings
  numuni: number[];       // Count of each unit type
  numown: number;         // Owned cities count
  numtar: number;         // Target cities count
  numphs: number[];       // Cities producing each type
}

// ========== Unit Type Data ==========

export const UnitTypes: UnitTypeInfo[] = [
  { char: 'A', hits: 0,  phstart: 6,  prodtime: 5,  name: 'Army' },
  { char: 'F', hits: 20, phstart: 12, prodtime: 10, name: 'Fighter' },
  { char: 'D', hits: 3,  phstart: 24, prodtime: 20, name: 'Destroyer' },
  { char: 'T', hits: 3,  phstart: 36, prodtime: 30, name: 'Transport' },
  { char: 'S', hits: 2,  phstart: 30, prodtime: 25, name: 'Submarine' },
  { char: 'R', hits: 8,  phstart: 60, prodtime: 50, name: 'Cruiser' },
  { char: 'C', hits: 8,  phstart: 72, prodtime: 60, name: 'Carrier' },
  { char: 'B', hits: 12, phstart: 90, prodtime: 75, name: 'Battleship' },
];

// ========== Helper Functions ==========

/**
 * Convert location to row number.
 */
export function ROW(loc: Location): number {
  return Math.floor(loc / (Mcolmx + 1));
}

/**
 * Convert location to column number.
 */
export function COL(loc: Location): number {
  return loc % (Mcolmx + 1);
}

/**
 * Convert row,col to location.
 */
export function LOC(row: number, col: number): Location {
  return row * (Mcolmx + 1) + col;
}

/**
 * Check if location is on map border.
 */
export function border(loc: Location): boolean {
  const row = ROW(loc);
  const col = COL(loc);
  return row === 0 || row === Mrowmx || col === 0 || col === Mcolmx;
}

/**
 * Validate location is within map bounds and not on border.
 */
export function chkloc(loc: Location): boolean {
  return loc >= 0 && loc < MAPSIZE && !border(loc);
}

/**
 * Get location offset for a direction.
 * Directions: 0=E, 1=NE, 2=N, 3=NW, 4=W, 5=SW, 6=S, 7=SE, -1=stay
 */
export function arrow(dir: Direction): number {
  const offsets = [
    1,                      // 0: East
    -(Mcolmx + 1) + 1,      // 1: Northeast
    -(Mcolmx + 1),          // 2: North
    -(Mcolmx + 1) - 1,      // 3: Northwest
    -1,                     // 4: West
    (Mcolmx + 1) - 1,       // 5: Southwest
    (Mcolmx + 1),           // 6: South
    (Mcolmx + 1) + 1,       // 7: Southeast
    0,                      // 8/-1: Stay put
  ];

  if (dir < 0 || dir > 7) return 0;
  return offsets[dir];
}

/**
 * Find distance between two locations.
 */
export function dist(loc1: Location, loc2: Location): number {
  const r1 = ROW(loc1);
  const c1 = COL(loc1);
  const r2 = ROW(loc2);
  const c2 = COL(loc2);
  return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
}

/**
 * Find direction to move from loc1 to loc2.
 */
export function movdir(loc1: Location, loc2: Location): Direction {
  const mov = [3, 4, 5, 2, -1, 6, 1, 0, 7];
  const r1 = ROW(loc1);
  const c1 = COL(loc1);
  const r2 = ROW(loc2);
  const c2 = COL(loc2);

  let i = 0;
  if (c2 > c1) i++;
  if (c2 >= c1) i++;
  i *= 3;

  if (r2 > r1) i++;
  if (r2 >= r1) i++;

  return mov[i];
}

/**
 * Create a new empty unit.
 */
export function createUnit(): Unit {
  return {
    loc: 0,
    own: 0,
    typ: UnitType.A,
    hit: 0,
    ifo: IFO.NONE,
    ila: 0,
    dir: 1,
    mov: false,
    fuel: 0,
    abd: 0,
  };
}

/**
 * Create a new empty city.
 */
export function createCity(): City {
  return {
    loc: 0,
    own: 0,
    phs: -1,
    fnd: 0,
    fipath: 0,
    round: 0,
  };
}

/**
 * Create a new player.
 */
export function createPlayer(num: number, human: boolean): Player {
  return {
    num,
    round: 0,
    map: new Uint8Array(MAPSIZE),
    human,
    defeat: false,
    movedone: false,
    uninum: 0,
    secflg: false,
    turns: 0,
    mode: Mode.NONE,
    curloc: 0,
    frmloc: 0,
    maxrng: 0,
    citnum: 0,
    savmod: 0,
    nrdy: false,
    target: new Array(CITMAX).fill(false),
    troopt: Array.from({ length: 6 }, () => new Array(5).fill(0)),
    loci: new Array(LOCMAX).fill(0),
    numuni: new Array(TYPMAX).fill(0),
    numown: 0,
    numtar: 0,
    numphs: new Array(TYPMAX).fill(0),
  };
}
