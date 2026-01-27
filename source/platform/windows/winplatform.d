/*
 * Empire, the Wargame of the Century (tm)
 * Copyright (C) 1978-2004 by Walter Bright
 * All Rights Reserved
 *
 * Windows Platform Implementation
 * Implements IPlatform interface using Win32 GDI and APIs.
 *
 * Ported to D2/LDC2 for Windows 11 compatibility.
 */

module platform.windows.winplatform;

version (Windows):

import core.sys.windows.windows;
import core.stdc.string : memset;

import core.platform;
import core.types;

// External Win32 functions from winmain.d
extern (C)
{
    void win_flush();
    void sound_click();
    void win_invalidate_loc(uint loc);
    void win_invalidate_sector();
    int win_poll_key();
    int win_wait_key();
    void win_play_sound(int id, bool sync);
    int win_show_city_dialog(int currentPhase);
    int win_show_new_game_dialog();
    void win_show_about_dialog();
    void win_delay(int units);
    long win_get_time_ms();
}

/**
 * Windows implementation of IPlatform.
 *
 * This class wraps the existing Win32 code to provide the platform
 * interface used by the game logic.
 */
class WindowsPlatform : IPlatform
{
private:
    // Text buffer for display
    enum VBUFROWS = 5;
    enum VBUFCOLS = 80;
    char[VBUFCOLS + 1][VBUFROWS] vbuffer;

    uint _cursor;
    bool _soundEnabled = true;
    int _inputBuffer = -1;
    bool _anyChanges;

public:
    this()
    {
        clear();
    }

    // ========== Display Operations ==========

    override void invalidateLoc(loc_t loc)
    {
        win_invalidate_loc(loc);
    }

    override void invalidateSector()
    {
        win_invalidate_sector();
    }

    override void flush()
    {
        if (_anyChanges)
        {
            win_flush();
            _anyChanges = false;
        }
    }

    override void clear()
    {
        for (int r = 0; r < VBUFROWS; r++)
        {
            for (int c = 0; c < VBUFCOLS; c++)
                vbuffer[r][c] = ' ';
            vbuffer[r][VBUFCOLS] = 0;
        }
        _anyChanges = true;
    }

    // ========== Text Display ==========

    override void setCursor(uint pos)
    {
        _cursor = pos;
    }

    override uint getCursor()
    {
        return _cursor;
    }

    override void putChar(char c)
    {
        int row = _cursor >> 8;
        int col = _cursor & 0xFF;

        if (row < VBUFROWS && col < VBUFCOLS)
        {
            if (vbuffer[row][col] != c)
            {
                _anyChanges = true;
                vbuffer[row][col] = c;
            }
        }
    }

    override void putString(const(char)* str)
    {
        if (str is null)
            return;

        while (*str)
        {
            putChar(*str);
            // Advance cursor
            int col = _cursor & 0xFF;
            int row = _cursor >> 8;
            col++;
            if (col >= VBUFCOLS)
            {
                col = 0;
                row++;
            }
            _cursor = (row << 8) | col;
            str++;
        }
    }

    override const(char)[] getTextRow(int row)
    {
        if (row >= 0 && row < VBUFROWS)
            return vbuffer[row][0 .. VBUFCOLS];
        return null;
    }

    // ========== Input Operations ==========

    override int waitKey()
    {
        if (_inputBuffer != -1)
        {
            int key = _inputBuffer;
            _inputBuffer = -1;
            return key;
        }
        return win_wait_key();
    }

    override int pollKey()
    {
        if (_inputBuffer != -1)
        {
            int key = _inputBuffer;
            _inputBuffer = -1;
            return key;
        }
        return win_poll_key();
    }

    override void pushKey(int key)
    {
        _inputBuffer = key;
    }

    // ========== Audio Operations ==========

    override void playSound(SoundId id, bool sync = false)
    {
        if (_soundEnabled)
        {
            win_play_sound(cast(int)id, sync);
        }
    }

    override void click()
    {
        if (_soundEnabled)
        {
            sound_click();
        }
    }

    override void setSoundEnabled(bool enabled)
    {
        _soundEnabled = enabled;
    }

    override bool isSoundEnabled()
    {
        return _soundEnabled;
    }

    // ========== Dialog Operations ==========

    override int showCityDialog(int currentPhase)
    {
        return win_show_city_dialog(currentPhase);
    }

    override bool showConfirmDialog(const(char)* message)
    {
        // TODO: Implement confirmation dialog
        return true;
    }

    override void showAboutDialog()
    {
        win_show_about_dialog();
    }

    override const(char)* showOpenDialog()
    {
        // TODO: Implement file open dialog
        return null;
    }

    override const(char)* showSaveDialog()
    {
        // TODO: Implement file save dialog
        return null;
    }

    override int showNewGameDialog()
    {
        return win_show_new_game_dialog();
    }

    // ========== Timing Operations ==========

    override void delay(int units)
    {
        win_delay(units);
    }

    override long getTimeMs()
    {
        return win_get_time_ms();
    }

    // ========== Window Operations ==========

    override uint getDisplaySize()
    {
        // Default: 24 rows x 80 cols
        return (23 << 8) | 78;
    }

    override bool isNarrowMode()
    {
        return false;
    }

    override void positionCursorAtLoc(loc_t loc)
    {
        // Convert map location to screen position
        // This depends on the current sector being displayed
        // TODO: Implement based on current sector
    }
}

/**
 * Create and initialize the Windows platform.
 */
IPlatform createWindowsPlatform()
{
    auto platform = new WindowsPlatform();
    initPlatform(platform);
    return platform;
}
