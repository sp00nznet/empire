/**
 * Empire: Wargame of the Century
 * Keyboard Input Handler
 */

import { Direction, Keys } from '../core/types';

// Key to direction mapping (QWEASDZXC pattern)
const KEY_TO_DIRECTION: Record<string, Direction> = {
  // QWEASDZXC keys
  'KeyQ': 3,  // Northwest
  'KeyW': 2,  // North
  'KeyE': 1,  // Northeast
  'KeyA': 4,  // West
  'KeyS': -1, // Stay
  'KeyD': 0,  // East
  'KeyZ': 5,  // Southwest
  'KeyX': 6,  // South
  'KeyC': 7,  // Southeast

  // Arrow keys
  'ArrowUp': 2,
  'ArrowDown': 6,
  'ArrowLeft': 4,
  'ArrowRight': 0,

  // Numpad
  'Numpad7': 3,
  'Numpad8': 2,
  'Numpad9': 1,
  'Numpad4': 4,
  'Numpad5': -1,
  'Numpad6': 0,
  'Numpad1': 5,
  'Numpad2': 6,
  'Numpad3': 7,
};

// Command keys
export type CommandKey =
  | 'from'       // F - From (set movement origin)
  | 'to'         // T - To (set movement destination)
  | 'goto'       // G - Go to nearest city/carrier
  | 'wake'       // K - Wake up unit
  | 'load'       // L - Load armies onto transport
  | 'production' // P - Change city production
  | 'random'     // R - Random movement
  | 'sentry'     // S - Sentry mode
  | 'survey'     // Y - Survey mode
  | 'help'       // H - Help
  | 'save'       // Ctrl+S - Save game
  | 'escape'     // Escape - Cancel
  | 'space'      // Space - Stay/confirm
  | 'speedUp'    // > - Increase speed
  | 'speedDown'; // < - Decrease speed

const KEY_TO_COMMAND: Record<string, CommandKey> = {
  'KeyF': 'from',
  'KeyT': 'to',
  'KeyG': 'goto',
  'KeyK': 'wake',
  'KeyL': 'load',
  'KeyP': 'production',
  'KeyR': 'random',
  // 'KeyS': 'sentry',  // S is used for direction
  'KeyY': 'survey',
  'KeyH': 'help',
  'Escape': 'escape',
  'Space': 'space',
  'Period': 'speedUp',     // > (shift+period)
  'Comma': 'speedDown',    // < (shift+comma)
};

export interface InputEvent {
  type: 'direction' | 'command' | 'key';
  direction?: Direction;
  command?: CommandKey;
  key?: string;
  code?: string;
  shift?: boolean;
  ctrl?: boolean;
}

type InputCallback = (event: InputEvent) => void;

export class InputHandler {
  private callbacks: Set<InputCallback> = new Set();
  private keyQueue: InputEvent[] = [];
  private enabled: boolean = true;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't capture if in input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const event = this.translateKey(e);
    if (event) {
      // Prevent default for game keys
      e.preventDefault();

      // Queue the event
      this.keyQueue.push(event);

      // Notify callbacks
      for (const callback of this.callbacks) {
        callback(event);
      }
    }
  }

  private translateKey(e: KeyboardEvent): InputEvent | null {
    const code = e.code;
    const shift = e.shiftKey;
    const ctrl = e.ctrlKey || e.metaKey;

    // Check for save command
    if (ctrl && code === 'KeyS') {
      return { type: 'command', command: 'save', ctrl: true };
    }

    // Check for sentry (Shift+S since S is also a direction)
    if (shift && code === 'KeyS') {
      return { type: 'command', command: 'sentry', shift: true };
    }

    // Check for speed controls (need shift)
    if (shift && code === 'Period') {
      return { type: 'command', command: 'speedUp', shift: true };
    }
    if (shift && code === 'Comma') {
      return { type: 'command', command: 'speedDown', shift: true };
    }

    // Check for direction
    if (code in KEY_TO_DIRECTION) {
      return {
        type: 'direction',
        direction: KEY_TO_DIRECTION[code],
        code,
        shift,
        ctrl,
      };
    }

    // Check for command
    if (code in KEY_TO_COMMAND) {
      return {
        type: 'command',
        command: KEY_TO_COMMAND[code],
        code,
        shift,
        ctrl,
      };
    }

    // Return raw key for other cases
    return {
      type: 'key',
      key: e.key,
      code,
      shift,
      ctrl,
    };
  }

  /**
   * Add a callback for input events.
   */
  onInput(callback: InputCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Poll for queued key input.
   * Returns null if no input available.
   */
  poll(): InputEvent | null {
    return this.keyQueue.shift() || null;
  }

  /**
   * Wait for next key input.
   */
  async wait(): Promise<InputEvent> {
    // Check queue first
    const queued = this.poll();
    if (queued) return queued;

    // Wait for new input
    return new Promise((resolve) => {
      const cleanup = this.onInput((event) => {
        cleanup();
        resolve(event);
      });
    });
  }

  /**
   * Clear input queue.
   */
  clear(): void {
    this.keyQueue = [];
  }

  /**
   * Enable/disable input handling.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if input is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get direction from a key code.
   */
  static getDirection(code: string): Direction | null {
    return KEY_TO_DIRECTION[code] ?? null;
  }
}
