/**
 * Empire: Wargame of the Century
 * HTML5 Web Version - Main Entry Point
 */

import {
  Location,
  Direction,
  Unit,
  City,
  Player,
  UnitTypes,
  UnitType,
  MapValue,
  Mode,
  IFO,
  CITMAX,
  ROW,
  COL,
  LOC,
  arrow,
  chkloc,
  dist,
  movdir,
} from './core/types';

import { typ, own, sea, land, X } from './core/map';
import { pathBlk, pathSea } from './core/path';

import {
  GameState,
  createGameState,
  initGame,
  revealArea,
  findUnit,
  findCity,
  destroyUnit,
  createNewUnit,
  produceUnits,
  checkWin,
  exportState,
  importState,
  random,
  randir,
} from './core/game';

import { Renderer } from './platform/renderer';
import { AudioManager, SoundId } from './platform/audio';
import { InputHandler, InputEvent } from './platform/input';
import { Storage } from './platform/storage';

// ========== Game Controller ==========

class EmpireGame {
  private state: GameState;
  private renderer: Renderer;
  private audio: AudioManager;
  private input: InputHandler;
  private storage: Storage;

  private currentPlayer: Player | null = null;
  private currentUnit: Unit | null = null;
  private cursorLoc: Location = 0;
  private gameLoop: number | null = null;
  private gameSpeed: number = 100;  // ms per tick

  constructor() {
    this.state = createGameState();
    this.renderer = new Renderer();
    this.audio = new AudioManager();
    this.input = new InputHandler();
    this.storage = new Storage();

    this.setupUI();
    this.showMainMenu();
  }

  private setupUI(): void {
    // Menu buttons
    document.getElementById('btn-new-1')?.addEventListener('click', () => this.startNewGame(1));
    document.getElementById('btn-new-2')?.addEventListener('click', () => this.startNewGame(2));
    document.getElementById('btn-new-3')?.addEventListener('click', () => this.startNewGame(3));
    document.getElementById('btn-load')?.addEventListener('click', () => this.loadGame());

    // City dialog buttons
    const cityDialog = document.getElementById('city-dialog');
    cityDialog?.querySelectorAll('[data-phase]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const phase = parseInt((e.target as HTMLElement).dataset.phase || '0');
        this.selectCityProduction(phase);
      });
    });

    // Canvas click for cursor movement
    this.renderer.getCanvas().addEventListener('click', (e) => {
      const rect = this.renderer.getCanvas().getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const loc = this.renderer.getTileFromCoords(x, y);
      if (loc !== null) {
        this.moveCursor(loc);
      }
    });

    // Input handler
    this.input.onInput((event) => this.handleInput(event));

    // Initialize audio on first interaction
    document.addEventListener('click', () => this.audio.init(), { once: true });
    document.addEventListener('keydown', () => this.audio.init(), { once: true });
  }

  private showMainMenu(): void {
    this.hideDialog('city-dialog');
    this.showDialog('menu-dialog');
  }

  private showDialog(id: string): void {
    document.getElementById('overlay')?.classList.add('visible');
    document.getElementById(id)?.classList.add('visible');
    this.input.setEnabled(false);
  }

  private hideDialog(id: string): void {
    document.getElementById('overlay')?.classList.remove('visible');
    document.getElementById(id)?.classList.remove('visible');
    this.input.setEnabled(true);
  }

  private hideAllDialogs(): void {
    this.hideDialog('menu-dialog');
    this.hideDialog('city-dialog');
  }

  // ========== Game Initialization ==========

  private startNewGame(numPlayers: number): void {
    this.hideAllDialogs();

    // Player 1 is always human
    const humanPlayers = [1];

    initGame(this.state, numPlayers, humanPlayers);

    this.currentPlayer = this.state.players[1];
    this.cursorLoc = this.findPlayerStartLoc(1);

    this.renderer.setSector(this.cursorLoc);
    this.renderer.invalidateSector();

    this.updateDisplay();
    this.startGameLoop();

    this.renderer.setText(0, `Empire: ${numPlayers} player game started`);
    this.renderer.setText(1, 'Press H for help');
  }

  private findPlayerStartLoc(playerNum: number): Location {
    for (const city of this.state.cities) {
      if (city.own === playerNum && city.loc) {
        return city.loc;
      }
    }
    return LOC(30, 50);  // Center of map as fallback
  }

  private loadGame(): void {
    const json = this.storage.loadGame();
    if (!json) {
      alert('No saved game found');
      return;
    }

    try {
      importState(this.state, json);
      this.hideAllDialogs();

      this.currentPlayer = this.state.players[this.state.plynum];
      this.cursorLoc = this.findPlayerStartLoc(this.state.plynum);

      this.renderer.setSector(this.cursorLoc);
      this.renderer.invalidateSector();
      this.updateDisplay();
      this.startGameLoop();

      this.renderer.setText(0, 'Game loaded');
    } catch (e) {
      alert('Failed to load game');
      console.error(e);
    }
  }

  private saveGame(): void {
    const json = exportState(this.state);
    if (this.storage.saveGame(json)) {
      this.renderer.setText(0, 'Game saved');
      this.audio.play(SoundId.CLICK);
    } else {
      this.renderer.setText(0, 'Failed to save game');
      this.audio.play(SoundId.ERROR);
    }
  }

  // ========== Game Loop ==========

  private startGameLoop(): void {
    if (this.gameLoop) return;

    const tick = () => {
      this.gameTick();
      this.gameLoop = window.setTimeout(tick, this.gameSpeed);
    };

    tick();
  }

  private stopGameLoop(): void {
    if (this.gameLoop) {
      clearTimeout(this.gameLoop);
      this.gameLoop = null;
    }
  }

  private gameTick(): void {
    if (this.state.gameOver) {
      this.stopGameLoop();
      return;
    }

    const player = this.state.players[this.state.plynum];

    if (player.human) {
      // Human player - wait for input
      this.currentPlayer = player;
      this.processHumanTurn(player);
    } else {
      // AI player
      this.processAITurn(player);
    }

    // Check for win/loss
    const result = checkWin(this.state);
    if (result.winner !== null) {
      this.handleGameOver(result.winner);
    }

    this.updateDisplay();
  }

  private processHumanTurn(player: Player): void {
    // Find next unit that needs orders
    if (!this.currentUnit || !this.currentUnit.loc) {
      this.currentUnit = this.findNextUnit(player);
    }

    if (this.currentUnit) {
      // Center on current unit
      if (this.cursorLoc !== this.currentUnit.loc) {
        this.cursorLoc = this.currentUnit.loc;
        this.renderer.setSector(this.cursorLoc);
        this.renderer.invalidateSector();
      }

      this.showUnitStatus(this.currentUnit);
    } else {
      // No units to move - end turn
      this.endPlayerTurn(player);
    }
  }

  private findNextUnit(player: Player): Unit | null {
    for (let i = player.uninum; i < this.state.unitop; i++) {
      const unit = this.state.units[i];
      if (unit.loc && unit.own === player.num && !unit.mov) {
        player.uninum = i;
        return unit;
      }
    }
    return null;
  }

  private endPlayerTurn(player: Player): void {
    // Reset unit move flags
    for (const unit of this.state.units) {
      if (unit.own === player.num) {
        unit.mov = false;
      }
    }

    player.uninum = 0;
    player.round++;

    // Produce units
    produceUnits(this.state, player);

    // Update player stats
    this.updatePlayerStats(player);

    // Next player
    this.state.plynum = (this.state.plynum % this.state.numply) + 1;
    this.currentUnit = null;

    this.renderer.setText(0, `Round ${player.round} complete`);
  }

  private updatePlayerStats(player: Player): void {
    player.numown = 0;
    player.numuni.fill(0);

    for (const city of this.state.cities) {
      if (city.own === player.num) {
        player.numown++;
      }
    }

    for (const unit of this.state.units) {
      if (unit.loc && unit.own === player.num) {
        player.numuni[unit.typ]++;
      }
    }
  }

  private processAITurn(player: Player): void {
    // Simple AI: move units randomly toward enemy cities
    const unit = this.findNextUnit(player);

    if (unit) {
      const dir = this.getAIMove(player, unit);
      this.moveUnit(unit, dir);
      unit.mov = true;
      player.uninum++;
    } else {
      this.endPlayerTurn(player);
    }
  }

  private getAIMove(player: Player, unit: Unit): Direction {
    // Find nearest enemy city
    let nearestCity: City | null = null;
    let nearestDist = Infinity;

    for (const city of this.state.cities) {
      if (city.loc && city.own !== player.num) {
        const d = dist(unit.loc, city.loc);
        if (d < nearestDist) {
          nearestDist = d;
          nearestCity = city;
        }
      }
    }

    if (nearestCity) {
      // Try to move toward target
      const dir = movdir(unit.loc, nearestCity.loc);
      const newLoc = unit.loc + arrow(dir);

      if (this.canMove(unit, newLoc)) {
        return dir;
      }
    }

    // Random move as fallback
    return randir(this.state);
  }

  // ========== Input Handling ==========

  private handleInput(event: InputEvent): void {
    if (!this.currentPlayer || this.state.gameOver) return;

    this.audio.resume();

    if (event.type === 'direction' && event.direction !== undefined) {
      this.handleDirection(event.direction);
    } else if (event.type === 'command' && event.command) {
      this.handleCommand(event.command);
    }
  }

  private handleDirection(dir: Direction): void {
    if (this.currentUnit) {
      this.moveUnit(this.currentUnit, dir);
    } else {
      // Move cursor
      const newLoc = this.cursorLoc + arrow(dir);
      if (chkloc(newLoc)) {
        this.moveCursor(newLoc);
      }
    }
  }

  private handleCommand(command: string): void {
    switch (command) {
      case 'production':
        this.showCityProductionDialog();
        break;
      case 'save':
        this.saveGame();
        break;
      case 'help':
        this.showHelp();
        break;
      case 'survey':
        this.toggleSurveyMode();
        break;
      case 'sentry':
        if (this.currentUnit) {
          this.currentUnit.ifo = IFO.NONE;
          this.currentUnit.mov = true;
          this.currentUnit = null;
          this.renderer.setText(0, 'Unit on sentry');
        }
        break;
      case 'escape':
        this.currentUnit = null;
        this.renderer.setText(0, '');
        break;
      case 'space':
        if (this.currentUnit) {
          this.moveUnit(this.currentUnit, -1);  // Stay in place
        }
        break;
    }
  }

  private moveCursor(loc: Location): void {
    this.renderer.invalidate(this.cursorLoc);
    this.cursorLoc = loc;
    this.renderer.invalidate(loc);

    // Update sector if needed
    if (!this.renderer.inSector(loc)) {
      this.renderer.setSector(loc);
    }

    // Show info about location
    this.showLocationInfo(loc);

    this.audio.play(SoundId.CLICK);
  }

  // ========== Unit Movement ==========

  private moveUnit(unit: Unit, dir: Direction): void {
    if (!unit.loc) return;

    const player = this.state.players[unit.own];
    const oldLoc = unit.loc;
    const newLoc = oldLoc + arrow(dir);

    // Validate move
    if (!this.canMove(unit, newLoc)) {
      this.audio.play(SoundId.ERROR);
      this.renderer.setText(0, 'Cannot move there');
      return;
    }

    // Check for combat
    const targetUnit = findUnit(this.state, newLoc);
    const targetCity = findCity(this.state, newLoc);

    if (targetUnit && targetUnit.own !== unit.own) {
      this.resolveCombat(unit, targetUnit);
    } else if (targetCity && targetCity.own !== unit.own && targetCity.own !== 0) {
      this.captureCity(unit, targetCity);
    } else {
      // Normal move
      unit.loc = newLoc;
      this.audio.play(SoundId.MOVE);
    }

    // Update map
    this.renderer.invalidate(oldLoc);
    this.renderer.invalidate(unit.loc);

    // Reveal area around new location
    revealArea(this.state, unit.own, unit.loc, 2);

    // Mark as moved
    unit.mov = true;
    this.currentUnit = null;

    this.updateDisplay();
  }

  private canMove(unit: Unit, loc: Location): boolean {
    if (!chkloc(loc)) return false;

    const mapVal = this.state.map[loc];

    // Army can only move on land or into transport
    if (unit.typ === UnitType.A) {
      return !sea[mapVal] || typ[mapVal] === UnitType.T;
    }

    // Ships can only move on sea
    if (unit.typ >= UnitType.D) {
      return sea[mapVal] || mapVal === MapValue.CITY;
    }

    // Fighters can go anywhere
    return true;
  }

  private resolveCombat(attacker: Unit, defender: Unit): void {
    this.audio.play(SoundId.ATTACK);

    // Simple combat: random winner
    const attackRoll = random(this.state, attacker.hit + 1);
    const defendRoll = random(this.state, defender.hit + 1);

    if (attackRoll >= defendRoll) {
      // Attacker wins
      destroyUnit(this.state, defender);
      attacker.loc = defender.loc;
      this.renderer.setText(0, `${UnitTypes[attacker.typ].name} destroyed enemy ${UnitTypes[defender.typ].name}`);
      this.audio.play(SoundId.DESTROY);
    } else {
      // Defender wins
      destroyUnit(this.state, attacker);
      this.renderer.setText(0, `${UnitTypes[attacker.typ].name} was destroyed`);
      this.audio.play(SoundId.DEFEAT);
    }
  }

  private captureCity(unit: Unit, city: City): void {
    if (unit.typ !== UnitType.A) {
      this.renderer.setText(0, 'Only armies can capture cities');
      return;
    }

    const oldOwner = city.own;
    city.own = unit.own;
    city.phs = UnitType.A;  // Start producing armies
    city.fnd = this.state.players[unit.own].round + UnitTypes[UnitType.A].prodtime;

    unit.loc = city.loc;

    this.state.players[unit.own].numown++;
    if (oldOwner > 0) {
      this.state.players[oldOwner].numown--;
    }

    this.renderer.setText(0, 'City captured!');
    this.audio.play(SoundId.VICTORY);
  }

  // ========== UI Updates ==========

  private updateDisplay(): void {
    if (!this.currentPlayer) return;

    this.renderer.render(this.state, this.currentPlayer, this.cursorLoc);
    this.renderer.updateStatus(this.state, this.currentPlayer);
  }

  private showUnitStatus(unit: Unit): void {
    const typeInfo = UnitTypes[unit.typ];
    this.renderer.setText(0, `${typeInfo.name} at (${ROW(unit.loc)},${COL(unit.loc)})`);
    this.renderer.setText(1, `Hits: ${unit.hit}  Orders: ${this.getOrdersText(unit)}`);
  }

  private showLocationInfo(loc: Location): void {
    if (!this.currentPlayer) return;

    const mapVal = this.currentPlayer.map[loc];
    const row = ROW(loc);
    const col = COL(loc);

    let info = `Location: (${row},${col}) - `;

    if (mapVal === MapValue.UNKNOWN) {
      info += 'Unexplored';
    } else if (mapVal === MapValue.SEA) {
      info += 'Sea';
    } else if (mapVal === MapValue.LAND) {
      info += 'Land';
    } else if (mapVal === MapValue.CITY) {
      info += 'Neutral City';
    } else {
      const owner = own[mapVal];
      const unitType = typ[mapVal];

      if (unitType === X) {
        info += `City (Player ${owner})`;
      } else if (unitType >= 0) {
        info += `${UnitTypes[unitType].name} (Player ${owner})`;
      }
    }

    this.renderer.setText(0, info);
  }

  private getOrdersText(unit: Unit): string {
    switch (unit.ifo) {
      case IFO.NONE: return 'Awaiting orders';
      case IFO.TAR: return 'Moving to target';
      case IFO.DIR: return 'Moving in direction';
      default: return 'Active';
    }
  }

  private showCityProductionDialog(): void {
    const city = findCity(this.state, this.cursorLoc);
    if (!city || city.own !== this.currentPlayer?.num) {
      this.renderer.setText(0, 'No owned city at cursor');
      this.audio.play(SoundId.ERROR);
      return;
    }

    this.showDialog('city-dialog');
  }

  private selectCityProduction(phase: number): void {
    const city = findCity(this.state, this.cursorLoc);
    if (!city || !this.currentPlayer) return;

    city.phs = phase;
    city.fnd = this.currentPlayer.round + UnitTypes[phase].phstart;

    this.hideDialog('city-dialog');
    this.renderer.setText(0, `City now producing ${UnitTypes[phase].name}`);
    this.audio.play(SoundId.CLICK);
  }

  private showHelp(): void {
    this.renderer.clearText();
    this.renderer.setText(0, 'QWEASDZXC/Arrows: Move | P: Production | H: Help');
    this.renderer.setText(1, 'Space: Wait | S: Sentry | Y: Survey | Esc: Cancel');
    this.renderer.setText(2, 'Ctrl+S: Save | F: From | T: To | G: Go to city');
    this.renderer.setText(3, 'Unit types: A=Army F=Fighter D=Destroyer T=Transport');
    this.renderer.setText(4, 'S=Submarine R=Cruiser C=Carrier B=Battleship');
  }

  private toggleSurveyMode(): void {
    // Toggle between cursor mode and unit mode
    this.currentUnit = null;
    this.renderer.setText(0, 'Survey mode - use arrows to explore');
  }

  private handleGameOver(winner: number): void {
    this.stopGameLoop();
    this.state.gameOver = true;

    if (winner === 1 && this.state.players[1].human) {
      this.renderer.setText(0, 'VICTORY! You have conquered the world!');
      this.audio.play(SoundId.VICTORY);
    } else {
      this.renderer.setText(0, `Game Over - Player ${winner} wins`);
      this.audio.play(SoundId.DEFEAT);
    }

    this.renderer.setText(1, 'Press any key to return to menu');

    // Wait for input then show menu
    this.input.wait().then(() => {
      this.showMainMenu();
    });
  }
}

// ========== Start Application ==========

document.addEventListener('DOMContentLoaded', () => {
  new EmpireGame();
});
