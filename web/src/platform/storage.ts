/**
 * Empire: Wargame of the Century
 * LocalStorage Save/Load
 */

const STORAGE_KEY = 'empire_save';
const SETTINGS_KEY = 'empire_settings';

export interface GameSettings {
  soundEnabled: boolean;
  gameSpeed: number;  // 1-10, where 5 is normal
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  gameSpeed: 5,
};

export class Storage {
  /**
   * Save game state to localStorage.
   */
  saveGame(stateJson: string): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, stateJson);
      return true;
    } catch (e) {
      console.error('Failed to save game:', e);
      return false;
    }
  }

  /**
   * Load game state from localStorage.
   */
  loadGame(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to load game:', e);
      return null;
    }
  }

  /**
   * Check if a saved game exists.
   */
  hasSavedGame(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Delete saved game.
   */
  deleteSave(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to delete save:', e);
    }
  }

  /**
   * Save settings.
   */
  saveSettings(settings: GameSettings): boolean {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  }

  /**
   * Load settings.
   */
  loadSettings(): GameSettings {
    try {
      const json = localStorage.getItem(SETTINGS_KEY);
      if (json) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Export save as downloadable file.
   */
  exportSave(): void {
    const data = this.loadGame();
    if (!data) {
      alert('No saved game to export');
      return;
    }

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empire_save_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import save from file.
   */
  async importSave(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const text = await file.text();
          // Validate JSON
          JSON.parse(text);
          this.saveGame(text);
          resolve(text);
        } catch (e) {
          console.error('Invalid save file:', e);
          alert('Invalid save file');
          resolve(null);
        }
      };

      input.click();
    });
  }
}
