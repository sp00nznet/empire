/**
 * Empire: Wargame of the Century
 * Canvas Renderer
 */

import {
  Location,
  City,
  Unit,
  Player,
  MAPSIZE,
  Mrowmx,
  Mcolmx,
  UnitType,
  UnitTypes,
  MapValue,
  ROW,
  COL,
  LOC,
  X,
} from '../core/types';

import { own, typ, sea, land } from '../core/map';
import type { GameState } from '../core/game';

// ========== Constants ==========

const TILE_SIZE = 8;        // Base tile size in pixels
const SECTOR_COLS = 26;     // Columns visible in sector view
const SECTOR_ROWS = 16;     // Rows visible in sector view

// Colors
const COLORS = {
  background: '#000000',
  sea: '#0000aa',
  land: '#00aa00',
  city: '#ffff00',
  cityNeutral: '#aaaaaa',
  unknown: '#000000',
  border: '#333333',
  cursor: '#ffffff',
  text: '#00ff00',

  // Player colors
  players: [
    '#ffffff',    // 0 - neutral
    '#00ff00',    // 1 - green
    '#ff0000',    // 2 - red
    '#0000ff',    // 3 - blue
    '#ffff00',    // 4 - yellow
    '#ff00ff',    // 5 - magenta
    '#00ffff',    // 6 - cyan
  ],
};

// Unit display characters
const UNIT_CHARS = ['A', 'F', 'D', 'T', 'S', 'R', 'C', 'B'];

// ========== Renderer Class ==========

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textRows: HTMLElement[];

  private scale: number = 1;
  private sectorRow: number = 0;
  private sectorCol: number = 0;

  private dirty: Set<Location> = new Set();
  private fullRedraw: boolean = true;

  constructor() {
    this.canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.textRows = [];
    for (let i = 0; i < 5; i++) {
      this.textRows.push(document.getElementById(`text-row-${i}`)!);
    }

    // Calculate scale to fit
    this.calculateScale();

    // Set up font
    this.ctx.font = `${TILE_SIZE * this.scale}px monospace`;
    this.ctx.textBaseline = 'top';
  }

  private calculateScale(): void {
    const maxWidth = window.innerWidth - 40;
    const maxHeight = window.innerHeight - 200;

    const scaleX = maxWidth / (SECTOR_COLS * TILE_SIZE);
    const scaleY = maxHeight / (SECTOR_ROWS * TILE_SIZE);

    this.scale = Math.min(scaleX, scaleY, 4);
    this.scale = Math.max(this.scale, 1);

    this.canvas.width = SECTOR_COLS * TILE_SIZE * this.scale;
    this.canvas.height = SECTOR_ROWS * TILE_SIZE * this.scale;
  }

  /**
   * Set the sector view center.
   */
  setSector(centerLoc: Location): void {
    const row = ROW(centerLoc);
    const col = COL(centerLoc);

    this.sectorRow = Math.max(0, Math.min(row - Math.floor(SECTOR_ROWS / 2), Mrowmx - SECTOR_ROWS));
    this.sectorCol = Math.max(0, Math.min(col - Math.floor(SECTOR_COLS / 2), Mcolmx - SECTOR_COLS));

    this.fullRedraw = true;
  }

  /**
   * Check if location is in current sector view.
   */
  inSector(loc: Location): boolean {
    const row = ROW(loc);
    const col = COL(loc);
    return (
      row >= this.sectorRow &&
      row < this.sectorRow + SECTOR_ROWS &&
      col >= this.sectorCol &&
      col < this.sectorCol + SECTOR_COLS
    );
  }

  /**
   * Mark a location as needing redraw.
   */
  invalidate(loc: Location): void {
    if (this.inSector(loc)) {
      this.dirty.add(loc);
    }
  }

  /**
   * Mark entire sector as needing redraw.
   */
  invalidateSector(): void {
    this.fullRedraw = true;
  }

  /**
   * Render the game state.
   */
  render(state: GameState, player: Player, cursorLoc: Location): void {
    if (this.fullRedraw) {
      this.renderFull(state, player, cursorLoc);
      this.fullRedraw = false;
      this.dirty.clear();
    } else if (this.dirty.size > 0) {
      for (const loc of this.dirty) {
        this.renderTile(state, player, loc, loc === cursorLoc);
      }
      this.dirty.clear();
    }
  }

  /**
   * Full redraw of the sector.
   */
  private renderFull(state: GameState, player: Player, cursorLoc: Location): void {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let r = 0; r < SECTOR_ROWS; r++) {
      for (let c = 0; c < SECTOR_COLS; c++) {
        const row = this.sectorRow + r;
        const col = this.sectorCol + c;

        if (row >= 0 && row <= Mrowmx && col >= 0 && col <= Mcolmx) {
          const loc = LOC(row, col);
          this.renderTile(state, player, loc, loc === cursorLoc);
        }
      }
    }
  }

  /**
   * Render a single tile.
   */
  private renderTile(state: GameState, player: Player, loc: Location, isCursor: boolean): void {
    const row = ROW(loc);
    const col = COL(loc);

    const x = (col - this.sectorCol) * TILE_SIZE * this.scale;
    const y = (row - this.sectorRow) * TILE_SIZE * this.scale;
    const size = TILE_SIZE * this.scale;

    // Get map value from player's view
    const mapVal = player.map[loc];

    // Determine terrain color and character
    let bgColor = COLORS.unknown;
    let fgColor = COLORS.text;
    let char = ' ';

    if (mapVal === MapValue.UNKNOWN) {
      bgColor = COLORS.unknown;
      char = ' ';
    } else if (mapVal === MapValue.SEA) {
      bgColor = COLORS.sea;
      char = '.';
      fgColor = '#0066cc';
    } else if (mapVal === MapValue.LAND) {
      bgColor = COLORS.land;
      char = '+';
      fgColor = '#006600';
    } else if (mapVal === MapValue.CITY) {
      bgColor = COLORS.land;
      char = '*';
      fgColor = COLORS.cityNeutral;
    } else {
      // Player-owned terrain or unit
      const owner = own[mapVal];
      const unitType = typ[mapVal];

      if (sea[mapVal]) {
        bgColor = COLORS.sea;
      } else {
        bgColor = COLORS.land;
      }

      if (unitType === X) {
        // City
        char = '*';
        fgColor = COLORS.players[owner] || COLORS.cityNeutral;
      } else if (unitType >= 0 && unitType < UNIT_CHARS.length) {
        // Unit
        char = UNIT_CHARS[unitType];
        fgColor = COLORS.players[owner] || COLORS.text;
      }
    }

    // Draw background
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(x, y, size, size);

    // Draw character
    this.ctx.fillStyle = fgColor;
    this.ctx.font = `${size}px monospace`;
    this.ctx.fillText(char, x, y);

    // Draw cursor
    if (isCursor) {
      this.ctx.strokeStyle = COLORS.cursor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
  }

  /**
   * Set text row content.
   */
  setText(row: number, text: string): void {
    if (row >= 0 && row < this.textRows.length) {
      this.textRows[row].textContent = text;
    }
  }

  /**
   * Clear all text rows.
   */
  clearText(): void {
    for (const row of this.textRows) {
      row.textContent = '';
    }
  }

  /**
   * Update status bar.
   */
  updateStatus(state: GameState, player: Player): void {
    const roundEl = document.getElementById('round-display');
    const citiesEl = document.getElementById('cities-display');
    const unitsEl = document.getElementById('units-display');

    if (roundEl) roundEl.textContent = player.round.toString();
    if (citiesEl) citiesEl.textContent = player.numown.toString();
    if (unitsEl) {
      const total = player.numuni.reduce((a, b) => a + b, 0);
      unitsEl.textContent = total.toString();
    }
  }

  /**
   * Get tile location from canvas coordinates.
   */
  getTileFromCoords(canvasX: number, canvasY: number): Location | null {
    const tileSize = TILE_SIZE * this.scale;
    const col = this.sectorCol + Math.floor(canvasX / tileSize);
    const row = this.sectorRow + Math.floor(canvasY / tileSize);

    if (row >= 0 && row <= Mrowmx && col >= 0 && col <= Mcolmx) {
      return LOC(row, col);
    }
    return null;
  }

  /**
   * Get canvas element for event binding.
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
