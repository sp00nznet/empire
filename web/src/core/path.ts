/**
 * Empire: Wargame of the Century
 * Pathfinding (TypeScript port from path.d)
 */

import {
  Location,
  Direction,
  Player,
  MAPMAX,
  MAPSIZE,
  Mcolmx,
  arrow,
  border,
  chkloc,
  dist,
  movdir,
} from './types';

// ========== Path Tables ==========

// Tables indicate which map values can be traversed
// Indexed by map value

// Land path including blanks (unexplored)
export const okblk: number[] = new Array(MAPMAX).fill(0);

// Same continent path
export const okcnt: number[] = new Array(MAPMAX).fill(0);

// Land path excluding blanks
export const oklnd: number[] = new Array(MAPMAX).fill(0);

// Sea path including blanks
export const oksea: number[] = new Array(MAPMAX).fill(0);

let tablesInitialized = false;

/**
 * Initialize path tables.
 */
export function initPathTables(): void {
  if (tablesInitialized) return;

  // Base values (indices 0-13 for neutral + player 1)
  //           unknown, city, sea, land, city, A,F,F,D,T,S,R,C,B
  const baseOkblk = [1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0];
  const baseOkcnt = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
  const baseOklnd = [0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0];
  const baseOksea = [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];

  // Copy base values
  for (let i = 0; i < 14; i++) {
    okblk[i] = baseOkblk[i];
    okcnt[i] = baseOkcnt[i];
    oklnd[i] = baseOklnd[i];
    oksea[i] = baseOksea[i];
  }

  // Copy for each player (10 values per player starting at index 4)
  for (let player = 1; player < 6; player++) {
    for (let j = 0; j < 10; j++) {
      const srcIdx = 4 + j;
      const dstIdx = 4 + player * 10 + j;
      if (dstIdx < MAPMAX) {
        okblk[dstIdx] = okblk[srcIdx];
        okcnt[dstIdx] = okcnt[srcIdx];
        oklnd[dstIdx] = oklnd[srcIdx];
        oksea[dstIdx] = oksea[srcIdx];
      }
    }
  }

  tablesInitialized = true;
}

/**
 * Find path from beg to end.
 *
 * @param map Player's map view
 * @param beg Starting location
 * @param end Ending location
 * @param dir Initial turn direction (1 or -1)
 * @param ok Array of map values that can be traversed
 * @param optimize If true, attempt to optimize the path
 * @returns Direction to move, or -1 if no path found
 */
export function findPath(
  map: Uint8Array,
  beg: Location,
  end: Location,
  dir: number,
  ok: number[],
  optimize: boolean = true
): Direction {
  initPathTables();

  const TRACKMAX = 100;
  const track: Location[] = new Array(TRACKMAX).fill(0);

  if (!chkloc(beg) || !chkloc(end)) {
    return -1;
  }

  if (beg === end) {
    return -1;  // Already there
  }

  let result: Direction = -1;
  let curloc = beg;
  let dir3 = dir * 3;
  const begdir = dir;
  let t = 0;
  const movmax = 50 + 2 * dist(beg, end);
  let movnum = movmax;

  // Helper: check if we can move to loc
  const mapinm = (loc: Location): boolean => {
    return ok[map[loc]] === 1 || loc === end;
  };

  // Helper: try to move in direction d from curloc
  const armap = (d: Direction): { canMove: boolean; loc: Location } => {
    const loc = curloc + arrow(d);
    return { canMove: mapinm(loc), loc };
  };

  // Helper: try to move straight toward end
  const armain = (): { canMove: boolean; loc: Location; dir: Direction } => {
    const d = movdir(curloc, end);
    const { canMove, loc } = armap(d);
    return { canMove, loc, dir: d };
  };

  // Main pathfinding loop
  outer: while (true) {
    // Try to go straight toward end
    if (curloc === end) {
      return result;
    }

    let { canMove, loc, dir: trymov } = armain();

    if (!canMove) {
      // Follow shore/obstacle
      trymov = (trymov - dir3 + 8) & 7;
      const tryResult = armap(trymov);
      if (tryResult.canMove) {
        trymov = (trymov + dir3) & 7;
      }

      let found = false;
      for (let i = 0; i < 8; i++) {
        loc = curloc + arrow(trymov);
        if (!border(loc) && mapinm(loc)) {
          found = true;
          break;
        }
        trymov = (trymov + dir) & 7;
      }

      if (!found) {
        // Try other direction
        dir3 = -dir3;
        dir = -dir;
        if (dir === begdir) {
          return -1;  // Failed
        }
        movnum = movmax;
        curloc = beg;
        t = 0;
        result = -1;
        continue outer;
      }

      // Make the move
      if (curloc === beg) {
        result = trymov;
      }
      curloc = loc;

      if (curloc === end) {
        return result;
      }

      if (--movnum <= 0) {
        // Try other direction
        dir3 = -dir3;
        dir = -dir;
        if (dir === begdir) {
          return -1;  // Failed
        }
        movnum = movmax;
        curloc = beg;
        t = 0;
        result = -1;
        continue outer;
      }

      // Check if we can break away and go straight
      const movsav = movdir(curloc, end);
      const breakLoc = curloc + arrow(movsav);

      if (!mapinm(breakLoc)) {
        continue;  // Keep following shore
      }

      // Check if we already tried this
      let alreadyTried = false;
      for (let i = 0; i < t; i++) {
        if (track[i] === breakLoc) {
          alreadyTried = true;
          break;
        }
      }

      if (alreadyTried) {
        continue;  // Keep following shore
      }

      track[t++] = breakLoc;
      if (t >= TRACKMAX) {
        // Try other direction
        dir3 = -dir3;
        dir = -dir;
        if (dir === begdir) {
          return -1;
        }
        movnum = movmax;
        curloc = beg;
        t = 0;
        result = -1;
        continue outer;
      }

      // Go straight
      trymov = movsav;
      loc = breakLoc;
    }

    // Valid move
    if (curloc === beg) {
      result = trymov;
    }
    curloc = loc;

    if (curloc === end) {
      return result;
    }

    if (--movnum <= 0) {
      // Try other direction
      dir3 = -dir3;
      dir = -dir;
      if (dir === begdir) {
        return -1;
      }
      movnum = movmax;
      curloc = beg;
      t = 0;
      result = -1;
      continue outer;
    }

    // Attempt to optimize
    if (optimize) {
      const move1 = movdir(beg, curloc);
      let testLoc = beg;
      let canOptimize = true;

      while (testLoc !== curloc) {
        testLoc += arrow(movdir(testLoc, curloc));
        if (!mapinm(testLoc)) {
          canOptimize = false;
          break;
        }
      }

      if (canOptimize) {
        result = move1;
      }
    }
  }
}

/**
 * Find path over land (including unexplored).
 */
export function pathBlk(
  map: Uint8Array,
  beg: Location,
  end: Location,
  dir: number
): Direction {
  initPathTables();
  return findPath(map, beg, end, dir, okblk);
}

/**
 * Find path over same continent.
 */
export function pathCnt(
  map: Uint8Array,
  beg: Location,
  end: Location,
  dir: number
): Direction {
  initPathTables();
  return findPath(map, beg, end, dir, okcnt);
}

/**
 * Find path over land (excluding unexplored).
 */
export function pathLnd(
  map: Uint8Array,
  beg: Location,
  end: Location,
  dir: number
): Direction {
  initPathTables();
  return findPath(map, beg, end, dir, oklnd);
}

/**
 * Find path over sea (including unexplored).
 */
export function pathSea(
  map: Uint8Array,
  beg: Location,
  end: Location,
  dir: number
): Direction {
  initPathTables();
  return findPath(map, beg, end, dir, oksea);
}
