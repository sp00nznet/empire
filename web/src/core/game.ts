/**
 * Empire: Wargame of the Century
 * Game State Management (TypeScript port)
 */

import {
  Location,
  Direction,
  Unit,
  City,
  Player,
  UnitTypeId,
  MAPSIZE,
  CITMAX,
  UNIMAX,
  PLYMAX,
  TYPMAX,
  Mrowmx,
  Mcolmx,
  UnitType,
  UnitTypes,
  MapValue,
  IFO,
  J,
  X,
  ROW,
  COL,
  LOC,
  arrow,
  border,
  chkloc,
  dist,
  movdir,
  createUnit,
  createCity,
  createPlayer,
} from './types';

import { own, typ, sea, land, tcaf, aboard, updmap, initMapTables } from './map';

// ========== Random Number Generator ==========

class MersenneTwister {
  private mt: Uint32Array;
  private mti: number;

  constructor(seed: number = 37) {
    this.mt = new Uint32Array(624);
    this.mti = 625;
    this.seed(seed);
  }

  seed(s: number): void {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      const prev = this.mt[i - 1];
      this.mt[i] = ((((prev ^ (prev >>> 30)) >>> 0) * 1812433253) + i) >>> 0;
    }
    this.mti = 624;
  }

  next(): number {
    if (this.mti >= 624) {
      this.generateNumbers();
    }

    let y = this.mt[this.mti++];
    y ^= (y >>> 11);
    y ^= ((y << 7) & 0x9d2c5680) >>> 0;
    y ^= ((y << 15) & 0xefc60000) >>> 0;
    y ^= (y >>> 18);

    return y >>> 0;
  }

  private generateNumbers(): void {
    for (let i = 0; i < 624; i++) {
      const y = ((this.mt[i] & 0x80000000) | (this.mt[(i + 1) % 624] & 0x7fffffff)) >>> 0;
      this.mt[i] = this.mt[(i + 397) % 624] ^ (y >>> 1);
      if (y & 1) {
        this.mt[i] ^= 0x9908b0df;
      }
    }
    this.mti = 0;
  }

  random(max: number): number {
    return this.next() % max;
  }
}

// ========== Game State ==========

export interface GameState {
  // Map
  map: Uint8Array;              // Reference map (ground truth)

  // Cities
  cities: City[];
  cittop: number;               // Actual number of cities

  // Units
  units: Unit[];
  unitop: number;               // Highest unit index + 1

  // Players
  players: Player[];
  numply: number;               // Number of players
  plynum: number;               // Current player (1-based)
  numleft: number;              // Players remaining

  // Game state
  round: number;
  overpop: boolean;             // Unit arrays full
  gameOver: boolean;

  // RNG
  rng: MersenneTwister;
}

/**
 * Create initial game state.
 */
export function createGameState(): GameState {
  initMapTables();

  return {
    map: new Uint8Array(MAPSIZE),
    cities: Array.from({ length: CITMAX }, () => createCity()),
    cittop: 0,
    units: Array.from({ length: UNIMAX }, () => createUnit()),
    unitop: 0,
    players: Array.from({ length: PLYMAX + 1 }, (_, i) => createPlayer(i, false)),
    numply: 0,
    plynum: 1,
    numleft: 0,
    round: 0,
    overpop: false,
    gameOver: false,
    rng: new MersenneTwister(37),
  };
}

/**
 * Random number in range [0, max).
 */
export function random(state: GameState, max: number): number {
  return state.rng.random(max);
}

/**
 * Select a random direction, favoring diagonals.
 */
export function randir(state: GameState): Direction {
  let r2 = random(state, 24);
  if (r2 >= 8) {
    r2 &= 7;
    r2 |= 1;  // Pick diagonal
  }
  return r2;
}

// ========== Map Data ==========

// Compressed map data (5 built-in maps)
const MAP_DATA: number[][] = [
  // Map 1 - simplified representation
  // In the real game, these would be the compressed map bytes
  // For now, we'll generate procedural maps
];

/**
 * Generate a random map.
 */
export function generateMap(state: GameState): void {
  const { map, rng } = state;

  // Fill with sea
  map.fill(MapValue.SEA);

  // Generate continents
  const numContinents = 3 + rng.random(4);  // 3-6 continents

  for (let c = 0; c < numContinents; c++) {
    // Random starting point (not on border)
    const startRow = 5 + rng.random(Mrowmx - 10);
    const startCol = 5 + rng.random(Mcolmx - 10);

    // Grow continent
    const size = 100 + rng.random(200);
    growContinent(state, startRow, startCol, size);
  }

  // Add some islands
  const numIslands = 10 + rng.random(20);
  for (let i = 0; i < numIslands; i++) {
    const row = 2 + rng.random(Mrowmx - 4);
    const col = 2 + rng.random(Mcolmx - 4);
    const size = 5 + rng.random(30);
    growContinent(state, row, col, size);
  }

  // Place cities
  placeCities(state);

  // Set border to edge value
  for (let row = 0; row <= Mrowmx; row++) {
    map[LOC(row, 0)] = MapValue.UNKNOWN;
    map[LOC(row, Mcolmx)] = MapValue.UNKNOWN;
  }
  for (let col = 0; col <= Mcolmx; col++) {
    map[LOC(0, col)] = MapValue.UNKNOWN;
    map[LOC(Mrowmx, col)] = MapValue.UNKNOWN;
  }
}

/**
 * Grow a continent from a starting point.
 */
function growContinent(state: GameState, startRow: number, startCol: number, size: number): void {
  const { map, rng } = state;
  const queue: Location[] = [];
  const visited = new Set<Location>();

  const start = LOC(startRow, startCol);
  if (border(start)) return;

  queue.push(start);
  visited.add(start);
  map[start] = MapValue.LAND;

  let placed = 1;
  while (queue.length > 0 && placed < size) {
    const idx = rng.random(queue.length);
    const loc = queue[idx];
    queue.splice(idx, 1);

    // Try to expand in random directions
    for (let i = 0; i < 8; i++) {
      const dir = rng.random(8);
      const newLoc = loc + arrow(dir);

      if (!visited.has(newLoc) && !border(newLoc) && newLoc >= 0 && newLoc < MAPSIZE) {
        visited.add(newLoc);

        // Probability of adding land decreases with distance from center
        if (rng.random(100) < 70) {
          map[newLoc] = MapValue.LAND;
          queue.push(newLoc);
          placed++;
          if (placed >= size) break;
        }
      }
    }
  }
}

/**
 * Place cities on the map.
 */
function placeCities(state: GameState): void {
  const { map, cities, rng } = state;

  // Find all land locations
  const landLocs: Location[] = [];
  for (let loc = 0; loc < MAPSIZE; loc++) {
    if (map[loc] === MapValue.LAND && !border(loc)) {
      landLocs.push(loc);
    }
  }

  // Shuffle land locations
  for (let i = landLocs.length - 1; i > 0; i--) {
    const j = rng.random(i + 1);
    [landLocs[i], landLocs[j]] = [landLocs[j], landLocs[i]];
  }

  // Place cities (up to CITMAX or available land)
  let cityCount = 0;
  const minDist = 3;  // Minimum distance between cities

  for (const loc of landLocs) {
    if (cityCount >= CITMAX) break;

    // Check distance from existing cities
    let tooClose = false;
    for (let i = 0; i < cityCount; i++) {
      if (dist(loc, cities[i].loc) < minDist) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      cities[cityCount].loc = loc;
      cities[cityCount].own = 0;
      cities[cityCount].phs = -1;
      map[loc] = MapValue.CITY;
      cityCount++;
    }
  }

  state.cittop = cityCount;
}

/**
 * Initialize a new game.
 */
export function initGame(state: GameState, numPlayers: number, humanPlayers: number[] = [1]): void {
  // Reset state
  state.numply = numPlayers;
  state.numleft = numPlayers;
  state.plynum = 1;
  state.round = 0;
  state.overpop = false;
  state.gameOver = false;
  state.unitop = 0;

  // Reset cities
  for (const city of state.cities) {
    city.own = 0;
    city.phs = -1;
    city.fnd = 0;
    city.fipath = 0;
    city.round = 0;
  }

  // Reset units
  for (const unit of state.units) {
    unit.loc = 0;
  }

  // Generate map
  generateMap(state);

  // Initialize players
  for (let i = 1; i <= numPlayers; i++) {
    const player = state.players[i];
    player.num = i;
    player.round = 0;
    player.human = humanPlayers.includes(i);
    player.defeat = false;
    player.movedone = false;
    player.uninum = 0;
    player.secflg = false;
    player.turns = 0;
    player.numown = 0;

    // Initialize player's map (fog of war)
    player.map.fill(MapValue.UNKNOWN);

    // Reset AI tracking
    player.target.fill(false);
    player.loci.fill(0);
    player.numuni.fill(0);
    player.numphs.fill(0);
  }

  // Assign starting cities to players
  assignStartingCities(state);
}

/**
 * Assign starting cities to each player.
 */
function assignStartingCities(state: GameState): void {
  const { cities, cittop, players, numply, rng } = state;

  // Shuffle cities
  const cityIndices: number[] = [];
  for (let i = 0; i < cittop; i++) {
    if (cities[i].loc) {
      cityIndices.push(i);
    }
  }

  for (let i = cityIndices.length - 1; i > 0; i--) {
    const j = rng.random(i + 1);
    [cityIndices[i], cityIndices[j]] = [cityIndices[j], cityIndices[i]];
  }

  // Assign one city to each player
  for (let p = 1; p <= numply && cityIndices.length > 0; p++) {
    const cityIdx = cityIndices.pop()!;
    const city = cities[cityIdx];

    city.own = p;
    city.phs = UnitType.A;  // Start producing armies
    city.fnd = UnitTypes[UnitType.A].phstart;

    // Update player's map around their starting city
    revealArea(state, p, city.loc, 3);

    // Create starting army
    createNewUnit(state, city.loc, UnitType.A, p);

    players[p].numown = 1;
  }
}

/**
 * Reveal an area of the map for a player.
 */
export function revealArea(state: GameState, playerNum: number, center: Location, radius: number): void {
  const player = state.players[playerNum];

  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const row = ROW(center) + dr;
      const col = COL(center) + dc;

      if (row > 0 && row < Mrowmx && col > 0 && col < Mcolmx) {
        const loc = LOC(row, col);
        player.map[loc] = state.map[loc];
      }
    }
  }
}

/**
 * Create a new unit.
 */
export function createNewUnit(
  state: GameState,
  loc: Location,
  unitType: UnitTypeId,
  owner: number
): Unit | null {
  // Find free slot
  let slot = -1;
  for (let i = 0; i < UNIMAX; i++) {
    if (state.units[i].loc === 0) {
      slot = i;
      break;
    }
  }

  if (slot < 0) {
    state.overpop = true;
    return null;
  }

  const unit = state.units[slot];
  unit.loc = loc;
  unit.own = owner;
  unit.typ = unitType;
  unit.hit = UnitTypes[unitType].hits;
  unit.ifo = IFO.NONE;
  unit.ila = 0;
  unit.dir = state.rng.random(2) ? 1 : -1;
  unit.mov = false;
  unit.fuel = UnitTypes[unitType].hits;
  unit.abd = 0;

  if (slot >= state.unitop) {
    state.unitop = slot + 1;
  }

  // Update map
  updateMapUnit(state, loc, unitType, owner);

  // Update player stats
  state.players[owner].numuni[unitType]++;

  return unit;
}

/**
 * Destroy a unit.
 */
export function destroyUnit(state: GameState, unit: Unit): void {
  const owner = unit.own;
  const unitType = unit.typ;
  const loc = unit.loc;

  // Update player stats
  if (owner > 0 && owner <= state.numply) {
    state.players[owner].numuni[unitType]--;
  }

  // If transport/carrier, destroy units aboard
  const cargoType = tcaf(unit);
  if (cargoType >= 0 && typ[state.map[loc]] !== X) {
    for (const u of state.units) {
      if (u.loc === loc && u.typ === cargoType && u.own === owner) {
        u.loc = 0;
        state.players[owner].numuni[cargoType]--;
      }
    }
  }

  // Clear unit
  unit.loc = 0;

  // Update map
  updmap(loc, state.map);
}

/**
 * Update map to show a unit.
 */
function updateMapUnit(state: GameState, loc: Location, unitType: UnitTypeId, owner: number): void {
  const base = 4 + (owner - 1) * 10;
  const terrain = state.map[loc];
  const onSea = terrain === MapValue.SEA || sea[terrain];

  let mapVal: number;
  if (unitType === UnitType.A) {
    mapVal = base + 1;
  } else if (unitType === UnitType.F) {
    mapVal = onSea ? base + 3 : base + 2;
  } else {
    mapVal = base + 4 + (unitType - 2);
  }

  state.map[loc] = mapVal;
}

/**
 * Find unit at location.
 */
export function findUnit(state: GameState, loc: Location): Unit | null {
  for (let i = 0; i < state.unitop; i++) {
    const unit = state.units[i];
    if (unit.loc === loc) {
      return unit;
    }
  }
  return null;
}

/**
 * Find city at location.
 */
export function findCity(state: GameState, loc: Location): City | null {
  for (let i = 0; i < state.cittop; i++) {
    if (state.cities[i].loc === loc) {
      return state.cities[i];
    }
  }
  return null;
}

/**
 * Check if a player has won or lost.
 */
export function checkWin(state: GameState): { winner: number | null; losers: number[] } {
  const cityCounts = new Array(PLYMAX + 1).fill(0);
  const losers: number[] = [];

  // Count cities per player
  for (let i = 0; i < state.cittop; i++) {
    cityCounts[state.cities[i].own]++;
  }

  // Check for defeats
  for (let p = 1; p <= state.numply; p++) {
    const player = state.players[p];
    if (player.defeat) continue;

    if (cityCounts[p] === 0) {
      // Check for armies
      let hasArmy = false;
      for (const unit of state.units) {
        if (unit.loc && unit.own === p && unit.typ === UnitType.A) {
          hasArmy = true;
          break;
        }
      }

      if (!hasArmy) {
        player.defeat = true;
        state.numleft--;
        losers.push(p);
      }
    }
  }

  // Check for winner
  if (state.numleft === 1) {
    for (let p = 1; p <= state.numply; p++) {
      if (!state.players[p].defeat) {
        state.gameOver = true;
        return { winner: p, losers };
      }
    }
  }

  return { winner: null, losers };
}

/**
 * Produce units in cities.
 */
export function produceUnits(state: GameState, player: Player): void {
  for (let i = 0; i < state.cittop; i++) {
    const city = state.cities[i];

    if (city.own !== player.num || !city.loc) continue;
    if (city.phs < 0) continue;  // No production
    if (city.fnd > player.round) continue;  // Not ready yet

    // Create unit
    const unit = createNewUnit(state, city.loc, city.phs as UnitTypeId, player.num);

    if (unit) {
      // Reset production timer
      city.fnd = player.round + UnitTypes[city.phs].prodtime;
    }
  }
}

/**
 * Export game state for saving.
 */
export function exportState(state: GameState): string {
  return JSON.stringify({
    map: Array.from(state.map),
    cities: state.cities.map(c => ({ ...c })),
    cittop: state.cittop,
    units: state.units.map(u => ({ ...u })),
    unitop: state.unitop,
    players: state.players.map(p => ({
      ...p,
      map: Array.from(p.map),
      target: [...p.target],
      troopt: p.troopt.map(r => [...r]),
      loci: [...p.loci],
      numuni: [...p.numuni],
      numphs: [...p.numphs],
    })),
    numply: state.numply,
    plynum: state.plynum,
    numleft: state.numleft,
    round: state.round,
  });
}

/**
 * Import game state from save.
 */
export function importState(state: GameState, json: string): void {
  const data = JSON.parse(json);

  state.map = new Uint8Array(data.map);
  state.cittop = data.cittop;
  state.unitop = data.unitop;
  state.numply = data.numply;
  state.plynum = data.plynum;
  state.numleft = data.numleft;
  state.round = data.round;
  state.overpop = false;
  state.gameOver = false;

  for (let i = 0; i < CITMAX; i++) {
    Object.assign(state.cities[i], data.cities[i] || createCity());
  }

  for (let i = 0; i < UNIMAX; i++) {
    Object.assign(state.units[i], data.units[i] || createUnit());
  }

  for (let i = 0; i <= PLYMAX; i++) {
    const p = state.players[i];
    const dp = data.players[i];
    if (dp) {
      p.num = dp.num;
      p.round = dp.round;
      p.map = new Uint8Array(dp.map);
      p.human = dp.human;
      p.defeat = dp.defeat;
      p.movedone = dp.movedone;
      p.uninum = dp.uninum;
      p.secflg = dp.secflg;
      p.turns = dp.turns;
      p.mode = dp.mode;
      p.curloc = dp.curloc;
      p.frmloc = dp.frmloc;
      p.maxrng = dp.maxrng;
      p.citnum = dp.citnum;
      p.savmod = dp.savmod;
      p.nrdy = dp.nrdy;
      p.target = [...dp.target];
      p.troopt = dp.troopt.map((r: number[]) => [...r]);
      p.loci = [...dp.loci];
      p.numuni = [...dp.numuni];
      p.numown = dp.numown;
      p.numtar = dp.numtar;
      p.numphs = [...dp.numphs];
    }
  }
}
