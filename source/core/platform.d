/*
 * Empire, the Wargame of the Century (tm)
 * Copyright (C) 1978-2004 by Walter Bright
 * All Rights Reserved
 *
 * Platform Abstraction Layer
 * Ported to D2/LDC2 for Windows 11 compatibility.
 */

module core.platform;

import empire;

/**
 * Sound effect identifiers
 */
enum SoundId
{
    Click,          // UI click
    Explosion,      // Unit destroyed
    Splash,         // Ship sunk / drowning
    Flyby,          // Fighter movement
    Gunfire,        // Combat
    AckAck,         // Anti-aircraft
    Bubbles,        // Submarine
    Fuel,           // Low fuel warning
    Error,          // Invalid command
    Intro,          // Game start
    Taps,           // Player defeated
    MachineGun,     // Ground combat
}

/**
 * Dialog types
 */
enum DialogType
{
    About,
    NewGame,
    CityProduction,
    SaveGame,
    LoadGame,
    Confirm,
}

/**
 * Platform abstraction interface.
 *
 * This interface defines all platform-specific operations needed by the game.
 * Implementations exist for Windows (Win32 GDI) and HTML5 (Canvas/WebAudio).
 */
interface IPlatform
{
    // ========== Display Operations ==========

    /**
     * Invalidate a single map location for redraw.
     * Called when a unit moves or map state changes.
     */
    void invalidateLoc(loc_t loc);

    /**
     * Invalidate the entire visible sector for redraw.
     * Called when switching sectors or major display changes.
     */
    void invalidateSector();

    /**
     * Flush any pending display updates to screen.
     */
    void flush();

    /**
     * Clear the entire display.
     */
    void clear();

    // ========== Text Display ==========

    /**
     * Set cursor position for text output.
     * Position encoded as (row << 8) | col
     */
    void setCursor(uint pos);

    /**
     * Get current cursor position.
     */
    uint getCursor();

    /**
     * Output a single character at cursor position.
     */
    void putChar(char c);

    /**
     * Output a string at cursor position.
     */
    void putString(const(char)* str);

    /**
     * Get text buffer contents for a row.
     */
    const(char)[] getTextRow(int row);

    // ========== Input Operations ==========

    /**
     * Get next key press, waiting if necessary.
     * Returns key code or -1 on error.
     */
    int waitKey();

    /**
     * Check for key press without blocking.
     * Returns key code or -1 if no key available.
     */
    int pollKey();

    /**
     * Store a key to be returned by next pollKey/waitKey.
     */
    void pushKey(int key);

    // ========== Audio Operations ==========

    /**
     * Play a sound effect.
     * Params:
     *   id = Sound effect identifier
     *   sync = If true, wait for sound to complete
     */
    void playSound(SoundId id, bool sync = false);

    /**
     * Play the UI click sound.
     */
    void click();

    /**
     * Toggle sound on/off.
     */
    void setSoundEnabled(bool enabled);

    /**
     * Check if sound is enabled.
     */
    bool isSoundEnabled();

    // ========== Dialog Operations ==========

    /**
     * Show city production selection dialog.
     * Returns selected unit type (0-7) or -1 if cancelled.
     */
    int showCityDialog(int currentPhase);

    /**
     * Show a confirmation dialog.
     * Returns true if confirmed.
     */
    bool showConfirmDialog(const(char)* message);

    /**
     * Show the about dialog.
     */
    void showAboutDialog();

    /**
     * Show file open dialog for loading games.
     * Returns filename or null if cancelled.
     */
    const(char)* showOpenDialog();

    /**
     * Show file save dialog for saving games.
     * Returns filename or null if cancelled.
     */
    const(char)* showSaveDialog();

    /**
     * Show new game dialog for player count selection.
     * Returns number of players (1-6) or 0 if cancelled.
     */
    int showNewGameDialog();

    // ========== Timing Operations ==========

    /**
     * Delay for specified time units.
     * One unit is approximately 100ms.
     */
    void delay(int units);

    /**
     * Get current time in milliseconds.
     */
    long getTimeMs();

    // ========== Window Operations ==========

    /**
     * Get display dimensions.
     * Returns (rows << 8) | cols
     */
    uint getDisplaySize();

    /**
     * Check if display is in narrow mode (40 cols).
     */
    bool isNarrowMode();

    /**
     * Position cursor at map location.
     */
    void positionCursorAtLoc(loc_t loc);
}

/**
 * Global platform instance.
 * Set during initialization.
 */
__gshared IPlatform gPlatform;

/**
 * Initialize platform with given implementation.
 */
void initPlatform(IPlatform platform)
{
    gPlatform = platform;
}

/**
 * Get the global platform instance.
 */
IPlatform getPlatform()
{
    return gPlatform;
}
