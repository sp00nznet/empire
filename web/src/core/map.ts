/**
 * Empire: Wargame of the Century
 * Map Utilities (TypeScript port from maps.d)
 */

import {
  Location,
  Direction,
  Unit,
  MAPSIZE,
  Mrowmx,
  Mcolmx,
  MAPMAX,
  UnitType,
  MapValue,
  J,
  X,
  ROW,
  COL,
  arrow,
  chkloc,
  dist,
} from './types';

// ========== Map Type Tables ==========

// These tables are indexed by map value (0..MAPMAX-1)
// Map values encode: terrain type + owner + unit type

// own[mapval] = owner of that map value (0 = neutral, 1-6 = player)
export const own: number[] = new Array(MAPMAX).fill(0);

// typ[mapval] = unit type at that location (J = none, X = city, 0-7 = unit type)
export const typ: number[] = new Array(MAPMAX).fill(J);

// sea[mapval] = true if this is a sea square
export const sea: boolean[] = new Array(MAPMAX).fill(false);

// land[mapval] = true if this is a land square
export const land: boolean[] = new Array(MAPMAX).fill(false);

/**
 * Initialize the map type tables.
 * Layout: [0]=unknown, [1]=city, [2]=sea, [3]=land,
 *         [4..13]=player1 units, [14..23]=player2 units, etc.
 */
export function initMapTables(): void {
  // Base values (indices 0-3)
  own[0] = 0; typ[0] = J; sea[0] = false; land[0] = false;  // Unknown
  own[1] = 0; typ[1] = X; sea[1] = false; land[1] = false;  // City
  own[2] = 0; typ[2] = J; sea[2] = true;  land[2] = false;  // Sea
  own[3] = 0; typ[3] = J; sea[3] = false; land[3] = true;   // Land

  // Player units (indices 4+)
  // Each player has 10 slots: city, A, F, F(sea), D, T, S, R, C, B
  for (let player = 1; player <= 6; player++) {
    const base = 4 + (player - 1) * 10;

    own[base + 0] = player; typ[base + 0] = X;           sea[base + 0] = false; land[base + 0] = false;  // City
    own[base + 1] = player; typ[base + 1] = UnitType.A;  sea[base + 1] = false; land[base + 1] = true;   // Army
    own[base + 2] = player; typ[base + 2] = UnitType.F;  sea[base + 2] = false; land[base + 2] = true;   // Fighter (land)
    own[base + 3] = player; typ[base + 3] = UnitType.F;  sea[base + 3] = true;  land[base + 3] = false;  // Fighter (sea)
    own[base + 4] = player; typ[base + 4] = UnitType.D;  sea[base + 4] = true;  land[base + 4] = false;  // Destroyer
    own[base + 5] = player; typ[base + 5] = UnitType.T;  sea[base + 5] = true;  land[base + 5] = false;  // Transport
    own[base + 6] = player; typ[base + 6] = UnitType.S;  sea[base + 6] = true;  land[base + 6] = false;  // Submarine
    own[base + 7] = player; typ[base + 7] = UnitType.R;  sea[base + 7] = true;  land[base + 7] = false;  // Cruiser
    own[base + 8] = player; typ[base + 8] = UnitType.C;  sea[base + 8] = true;  land[base + 8] = false;  // Carrier
    own[base + 9] = player; typ[base + 9] = UnitType.B;  sea[base + 9] = true;  land[base + 9] = false;  // Battleship
  }
}

/**
 * Count how many armies/fighters are aboard a transport/carrier.
 */
export function aboard(u: Unit, units: Unit[], map: Uint8Array): number {
  const loc = u.loc;
  const cargoType = tcaf(u);

  if (cargoType < 0) return 0;  // Not a T or C
  if (typ[map[loc]] === X) return 0;  // In a city

  let total = 0;
  for (const unit of units) {
    if (unit.loc === loc && unit.typ === cargoType && unit.own === u.own) {
      total++;
    }
  }
  return total;
}

/**
 * Look for cargo type for transports or carriers.
 * Returns: A if unit is a T, F if unit is a C, -1 otherwise
 */
export function tcaf(u: Unit): number {
  const tcaftab = [-1, -1, -1, UnitType.A, -1, -1, UnitType.F, -1];
  return tcaftab[u.typ];
}

/**
 * Total up amount of sea around loc.
 */
export function edger(loc: Location, map: Uint8Array): number {
  if (!chkloc(loc)) return 0;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    if (sea[map[loc + arrow(i)]]) {
      sum++;
    }
  }
  return sum;
}

/**
 * Convert location to row*256+col format.
 */
export function rowcol(loc: Location): number {
  return (ROW(loc) << 8) + COL(loc);
}

/**
 * Get map value for a given terrain, owner, and unit type.
 */
export function getMapValue(terrain: number, owner: number, unitType: number): number {
  if (owner === 0) {
    // Neutral/unowned
    if (terrain === MapValue.SEA) return MapValue.SEA;
    if (terrain === MapValue.LAND) return MapValue.LAND;
    if (terrain === MapValue.CITY) return MapValue.CITY;
    return MapValue.UNKNOWN;
  }

  // Player-owned
  const base = 4 + (owner - 1) * 10;
  if (unitType === X) return base;  // City
  if (unitType >= 0 && unitType <= 7) {
    // Unit types: A=1, F=2(land)/3(sea), D=4, T=5, S=6, R=7, C=8, B=9
    if (unitType === UnitType.A) return base + 1;
    if (unitType === UnitType.F) return base + 2;  // Default to land
    return base + 4 + (unitType - 2);  // D, T, S, R, C, B
  }

  return MapValue.UNKNOWN;
}

/**
 * Update map location to show what's there (land or sea).
 */
export function updmap(loc: Location, map: Uint8Array): number {
  const val = map[loc];
  map[loc] = land[val] ? MapValue.LAND : MapValue.SEA;
  return map[loc];
}

/**
 * Check if unit is surrounded by sea (for army on transport).
 */
export function sursea(u: Unit, units: Unit[], map: Uint8Array): boolean {
  const loc = u.loc;

  if (u.typ !== UnitType.A || typ[map[loc]] !== UnitType.T) {
    return false;
  }

  for (let i = 0; i < 8; i++) {
    const ac = map[loc + arrow(i)];
    if ((land[ac] || typ[ac] === X) && own[ac] !== u.own) {
      return false;  // Found land or unowned city
    }
  }

  return true;  // Surrounded by friendly sea/units
}

/**
 * Check if transport/carrier is full.
 */
export function full(u: Unit, units: Unit[], map: Uint8Array): boolean {
  let max = u.hit;
  if (u.typ === UnitType.T) {
    max *= 2;  // Transports hold 2x their hit points
  }
  return aboard(u, units, map) >= max;
}

/**
 * Return true if there's no land around location.
 */
export function crowded(loc: Location, map: Uint8Array): boolean {
  for (let i = 0; i < 8; i++) {
    if (map[loc + arrow(i)] === MapValue.LAND) {
      return false;
    }
  }
  return true;
}

// Initialize tables on module load
initMapTables();
