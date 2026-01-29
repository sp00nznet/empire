/*
 * Empire, the Wargame of the Century (tm)
 * Copyright (C) 1978-2004 by Walter Bright
 * All Rights Reserved
 *
 * You may use this source for personal use only. To use it commercially
 * or to distribute source or binaries of Empire, please contact
 * www.digitalmars.com.
 *
 * Written by Walter Bright.
 * This source is written in the D Programming Language.
 * See www.digitalmars.com/d/ for the D specification and compiler.
 *
 * Use entirely at your own risk. There is no warranty, expressed or implied.
 *
 * Ported to D2/LDC2 for Windows 11 compatibility.
 */

module winmain;

import core.stdc.stdlib;
import core.stdc.stdio;
import core.stdc.string;
import core.sys.windows.windows;
import core.runtime;

// Windows constants not in core.sys.windows
enum LOGPIXELSX = 88;
enum LOGPIXELSY = 90;

// SetWindowPos flags
enum SWP_NOSIZE = 0x0001;
enum SWP_NOMOVE = 0x0002;
enum SWP_NOZORDER = 0x0004;
enum SWP_NOACTIVATE = 0x0010;

import empire;
import winemp;
import eplayer;
import display;
import twin;
import init;
import maps;
import var;

/********************************************************/

extern (Windows)
int WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,
            LPSTR lpCmdLine, int nCmdShow)
{
    int result;

    try
    {
        Runtime.initialize();
        result = doit(hInstance, hPrevInstance, lpCmdLine, nCmdShow);
        Runtime.terminate();
    }
    catch (Throwable o)
    {
        MessageBoxA(null, cast(char*)o.msg.ptr, "Error",
                    MB_OK | MB_ICONEXCLAMATION);
        result = 0;
    }

    return result;
}
/********************************************************/


/* Collect all Windows static global data.
 */

extern (Windows)
{
    alias DLGPROC = extern(Windows) INT_PTR function(HWND, UINT, WPARAM, LPARAM) nothrow;
}

struct Global
{
    HINSTANCE hinst;    // instance of entire program
    HWND hwnd;      // handle of main window

    int inited;     // !=0 means game is initialized
    HBITMAP hSplash;    // handle for splash screen .bmp

    // About
    DLGPROC lpfnAboutDlgProc;

    // City Select
    int phase;
    int newphase;
    DLGPROC lpfnCitySelectDlgProc;

    // Init
    int numplayers;
    int newnumplayers;
    int demo;
    DLGPROC lpfnInitDlgProc;

    int speaker;    // !=0 means sound is on

    // Menu
    HMENU hMenu;

    OPENFILENAMEA ofn;  // save file

    double scalex;  // zoom factor
    double scaley;  // zoom factor

    // Font
    HFONT hFont;
    short cxChar, cxCaps, cyChar;

    // Pen
    HPEN hPen;

    // Bitmaps
    HBITMAP[MAPMAX] mapvaltab;
    HBITMAP unknown10;

    Player *player; // which player is being displayed
    ubyte *map;     // which map is being displayed
    loc_t ulcorner; // upper left corner
    loc_t cursor;   // location of cursor
    HBITMAP hCursor;    // bitmap of cursor
    int offsetx;
    int offsety;

    // Window size
    int cxClient, cyClient;

    // Clipping rectangles
    RECT sector;
    RECT text;

    HRGN sectorRegion;
    HRGN textRegion;

    // Sector size
    int pixelx;
    int pixely;

    // Blast
    HBITMAP hBlast; // bitmap of blast
    HBITMAP hBlastmask; // bitmap of blast
    int blastState; // !=0 means draw blast
    int blastx;
    int blasty;     // location of blast

    // DPI scaling (Windows 10/11)
    uint dpi;           // current DPI (96 = 100%)
    float dpiScale;     // scale factor (1.0 = 100%)
}

Global global;


int doit(HINSTANCE hInstance, HINSTANCE hPrevInstance,
                    LPSTR lpszCmdLine, int nCmdShow)
{
    static char[8] szAppName = "Empire\0";
    HWND hwnd;
    MSG msg;
    WNDCLASSA wndclass;

    // Initialize DPI awareness for Windows 10/11
    initDpiAwareness();

    if (!hPrevInstance)
    {
        wndclass.style         = CS_HREDRAW | CS_VREDRAW;
        wndclass.lpfnWndProc   = &WndProc;
        wndclass.cbClsExtra    = 0;
        wndclass.cbWndExtra    = 0;
        wndclass.hInstance     = hInstance;
        wndclass.hIcon         = LoadIconA(hInstance, "About");
        wndclass.hCursor       = LoadCursorA(null, IDC_ARROW);
        wndclass.hbrBackground = GetStockObject(WHITE_BRUSH);
        wndclass.lpszMenuName  = szAppName.ptr;
        wndclass.lpszClassName = szAppName.ptr;

        RegisterClassA(&wndclass);

        helpRegister(hInstance);
    }

    global.hinst = hInstance;

    hwnd = CreateWindowA(szAppName.ptr, "Empire: Wargame of the Century",
                        WS_OVERLAPPEDWINDOW,
                          CW_USEDEFAULT, CW_USEDEFAULT,
                          CW_USEDEFAULT, CW_USEDEFAULT,
                          null, null, hInstance, null);

    ShowWindow(hwnd, nCmdShow);
    UpdateWindow(hwnd);

    while (true)
    {
        if (PeekMessageA(&msg, null, 0, 0, PM_REMOVE))
        {
            if (msg.message == WM_QUIT)
                break;
            TranslateMessage(&msg);
            DispatchMessageA(&msg);
        }
        else
        {
            // idle processing
            if (global.inited)
                slice();
        }
    }
    return cast(int)msg.wParam;
}

void DrawBitmap(HDC hdc, short xStart, short yStart, HBITMAP hBitmap, double scalex, double scaley, DWORD mode)
{
    BITMAP bm;
    HDC hMemDC;
    POINT pt;

    hMemDC = CreateCompatibleDC(hdc);
    SelectObject(hMemDC, hBitmap);
    GetObjectA(hBitmap, BITMAP.sizeof, cast(LPSTR)&bm);
    pt.x = bm.bmWidth;
    pt.y = bm.bmHeight;

    StretchBlt(hdc, xStart, yStart,
        cast(int)(pt.x * scalex + .99), cast(int)(pt.y * scaley + .99),
        hMemDC, 0, 0, pt.x, pt.y, mode);

    DeleteDC(hMemDC);
}

extern (Windows) LRESULT WndProc(HWND hwnd, UINT message, WPARAM wParam,
                             LPARAM lParam) nothrow
{
    HBITMAP hBitmap;
    HDC hdc;
    PAINTSTRUCT ps;
    POINT point;
    TEXTMETRICA tm;
    int i;
    int j;
    int ch;
    static LOGFONTA logfont;
    double newscalex;
    double newscaley;

    // File dialog box
    static char[260] szFileName;  // _MAX_PATH
    static char[280] szTitleName; // _MAX_FNAME + _MAX_EXT
    static immutable char*[3] szFilter = ["Empire Files (*.EMP)", "*.emp", ""];

    try {
    switch (message)
    {
        case WM_CREATE:
            global.speaker = 1;

            // Initialize DPI scaling
            global.dpi = getDpiForWindow(hwnd);
            if (global.dpi == 0) global.dpi = 96;
            global.dpiScale = cast(float)global.dpi / 96.0f;

            global.cxClient = scaleDpi(120, global.dpi);
            global.cyClient = scaleDpi(160, global.dpi);

            global.pixelx = scaleDpi(120, global.dpi);
            global.pixely = scaleDpi(120, global.dpi);

            global.hwnd = hwnd;
            global.scalex = 1.0;
            global.scaley = 1.0;
            global.numplayers = IDD_FOUR;
            global.map = .map.ptr;
            global.offsetx = 0;
            global.offsety = 0;

            // Clipping rectangles
            global.text.left = 0;
            global.text.top = 0;
            global.text.right = global.pixelx;
            global.text.bottom = 40;

            global.sector.left = 0;
            global.sector.top = 40;
            global.sector.right = global.pixelx;
            global.sector.bottom = global.sector.top + global.pixely;

            global.sectorRegion = CreateRectRgn(global.sector.left, global.sector.top, global.sector.right, global.sector.bottom);
            global.textRegion = CreateRectRgn(global.text.left, global.text.top, global.text.right, global.text.bottom);

            // Direct function pointer assignment (no MakeProcInstance needed in modern Windows)
            global.lpfnAboutDlgProc = &AboutDlgProc;
            global.lpfnCitySelectDlgProc = &CitySelectDlgProc;
            global.lpfnInitDlgProc = &InitDlgProc;

            // Menu
            global.hMenu = LoadMenuA(global.hinst, "PopMenu");
            global.hMenu = GetSubMenu(global.hMenu, 0);

            // File dialog box
            global.ofn.lStructSize       = OPENFILENAMEA.sizeof;
            global.ofn.hwndOwner         = hwnd;
            global.ofn.lpstrFilter       = szFilter[0];
            global.ofn.lpstrFile         = szFileName.ptr;
            global.ofn.nMaxFile          = 260; // _MAX_PATH
            global.ofn.lpstrFileTitle    = szTitleName.ptr;
            global.ofn.nMaxFileTitle     = 280; // _MAX_FNAME + _MAX_EXT
            global.ofn.lpstrDefExt       = "emp";

            for (i = 0; i < MAPMAX; i++)
            {
                hBitmap = LoadBitmapA(global.hinst, MAKEINTRESOURCEA(i + 1));
                global.mapvaltab[i] = hBitmap;
            }
            global.unknown10 = LoadBitmapA(global.hinst, MAKEINTRESOURCEA(BMP_UNKNOWN10));
            global.hCursor = LoadBitmapA(global.hinst, MAKEINTRESOURCEA(BMP_CURSOR));
            global.hSplash = LoadBitmapA(global.hinst, MAKEINTRESOURCEA(BMP_SPLASH));
            global.hBlast = LoadBitmapA(global.hinst, MAKEINTRESOURCEA(BMP_BLAST));
            global.hBlastmask = LoadBitmapA(global.hinst, MAKEINTRESOURCEA(BMP_BLASTMASK));

            hdc = GetDC(hwnd);

            logfont.lfHeight = 10;
            logfont.lfWidth = 5;
            global.hFont = CreateFontIndirectA(&logfont);
            SelectObject(hdc, global.hFont);

            GetTextMetricsA(hdc, &tm);
            global.cxChar = cast(short)tm.tmAveCharWidth;
            global.cxCaps = cast(short)((tm.tmPitchAndFamily & 1 ? 3 : 2) * global.cxChar / 2);
            global.cyChar = cast(short)(tm.tmHeight + tm.tmExternalLeading);

            ReleaseDC(hwnd, hdc);
            return 0;

        case WM_SIZE:
            global.cyClient = HIWORD(lParam);
            global.cxClient = LOWORD(lParam);

            global.pixelx = global.cxClient;
            if (global.pixelx < 120)
                global.pixelx = 120;
            if (global.pixelx > (Mcolmx + 1) * 10)
                global.pixelx = (Mcolmx + 1) * 10;
            if (global.pixelx / cast(int)(10 * global.scalex) < 5)
            {
                global.scalex = global.pixelx / (10 * 5.0);
                global.scaley = global.scalex;
            }

            global.pixely = global.cyClient - 40;
            if (global.pixely < 120)
                global.pixely = 120;
            if (global.pixely > (Mrowmx + 1) * 10)
                global.pixely = (Mrowmx + 1) * 10;
            if (global.pixely / cast(int)(10 * global.scaley) < 5)
            {
                global.scaley = global.pixely / (10 * 5.0);
                global.scalex = global.scaley;
            }

            global.text.right = global.pixelx;
            global.sector.right = global.pixelx;
            global.sector.bottom = global.sector.top + global.pixely;

            SetRectRgn(global.sectorRegion, global.sector.left, global.sector.top, global.sector.right, global.sector.bottom);
            SetRectRgn(global.textRegion, global.text.left, global.text.top, global.text.right, global.text.bottom);

            if (global.inited && global.player)
            {   Display *d = global.player.display;

                d.secbas = -1;
                d.setdispsize(d.text.nrows, d.text.ncols);
                d.text.clear();
                adjSector(global.scalex, global.scaley);
            }

            return 0;

        case 0x02E0:  // WM_DPICHANGED (Windows 8.1+)
            // Update DPI when window moves between monitors
            global.dpi = HIWORD(wParam);
            global.dpiScale = cast(float)global.dpi / 96.0f;

            // Resize window to suggested size
            RECT* prcNewWindow = cast(RECT*)lParam;
            if (prcNewWindow)
            {
                SetWindowPos(hwnd, null,
                    prcNewWindow.left, prcNewWindow.top,
                    prcNewWindow.right - prcNewWindow.left,
                    prcNewWindow.bottom - prcNewWindow.top,
                    SWP_NOZORDER | SWP_NOACTIVATE);
            }
            return 0;

        case WM_RBUTTONDOWN:
            point.x = lParam & 0xFFFF;
            point.y = (lParam >> 16) & 0xFFFF;
            ClientToScreen(hwnd, &point);
            TrackPopupMenu(global.hMenu, 0, point.x, point.y, 0, hwnd, null);
            return 0;

        case WM_COMMAND:
            switch (wParam)
            {
                case IDM_NEW:       // start new game
                    DialogBoxParamA(global.hinst, "InitBox", hwnd,
                                    global.lpfnInitDlgProc, 0);
                    init_var();
                    winSetup();
                    global.inited = 1;
                    InvalidateRect(hwnd, null, TRUE);
                    return 0;

                case IDM_OPEN:      // open saved game
                    if (GetOpenFileNameA(&global.ofn))
                    {   FILE *fp;

                        fp = fopen(global.ofn.lpstrFile, "rb");
                        if (!fp)
                        {
                            MessageBoxA(hwnd, "Empire Restore",
                                       "Could not read EMP file",
                                       MB_ICONEXCLAMATION | MB_OK);
                        }
                        else
                        {
                            init_var();
                            if (resgam(fp))
                            {   MessageBoxA(hwnd, "Empire Restore",
                                       "Corrupt EMP file",
                                       MB_ICONEXCLAMATION | MB_OK);
                                winSetup();
                            }
                            else
                                winRestore();
                            global.inited = 1;
                            InvalidateRect(hwnd, null, TRUE);
                        }
                    }
                    return 0;

                case IDM_SAVE:      // save existing game
                    if (GetOpenFileNameA(&global.ofn))
                    {
                        if (var_savgam(global.ofn.lpstrFile))
                        {
                            MessageBoxA(hwnd, "Empire Save",
                                       "Could not write EMP file",
                                       MB_ICONEXCLAMATION | MB_OK);
                        }
                    }
                    return 0;

                case IDM_CLOSE:
                    exit(0);
                    return 0;

                case IDM_SOUND:
                    global.speaker ^= 1;
                    return 0;

                case IDM_ABOUT:
                    DialogBoxParamA(global.hinst, "AboutBox", hwnd,
                                    global.lpfnAboutDlgProc, 0);
                    return 0;

                case IDM_HELP:
                    help(global.hinst);
                    return 0;

                case IDM_ZOOMIN:
                    goto Lzoomin;

                case IDM_ZOOMOUT:
                    goto Lzoomout;

                case IDM_F:    ch = 'F'; goto Linsert;
                case IDM_G:    ch = 'G'; goto Linsert;
                case IDM_H:    ch = 'H'; goto Linsert;
                case IDM_I:    ch = 'I'; goto Linsert;
                case IDM_K:    ch = 'K'; goto Linsert;
                case IDM_L:    ch = 'L'; goto Linsert;
                case IDM_N:    ch = 'N'; goto Linsert;
                case IDM_P:    ch = 'P'; goto Linsert;
                case IDM_R:    ch = 'R'; goto Linsert;
                case IDM_S:    ch = 'S'; goto Linsert;
                case IDM_U:    ch = 'U'; goto Linsert;
                case IDM_Y:    ch = 'Y'; goto Linsert;
                case IDM_ESC:  ch = ESC; goto Linsert;
                case IDM_FASTER:    ch = '<'; goto Linsert;
                case IDM_SLOWER:    ch = '>'; goto Linsert;
                case IDM_POV:    ch = 'O'; goto Linsert;

                default:
                    break;
            }
            break;

        case WM_CHAR:
            switch (wParam)
            {
                case 'j':
                case 'J':
                    global.speaker ^= 1;
                    return 0;

                case 12:
                    InvalidateRect(hwnd, null, TRUE);
                    break;

                default:
                    ch = cast(int)wParam;
                Linsert:
                    // Insert into buffer of player we are watching
                    Player *p;

                    for (int ii = 1; ii <= numply; ii++)
                    {
                        p = Player.get(ii);
                        if (p.watch)
                        {
                            p.display.text.TTunget(ch);
                            break;
                        }
                    }
                    break;
            }
            return 0;

        case WM_KEYDOWN:
            switch (wParam)
            {
                case VK_ADD:
                Lzoomin:
                    newscalex = global.scalex * 1.125;
                    newscaley = global.scaley * 1.125;
                    if (global.pixelx / cast(int)(10 * newscalex) >= 5)
                    {
                        if (newscalex < newscaley)
                            newscaley = global.scaley;
                        else
                            newscaley = newscalex;
                        goto Lnew;
                    }
                    return 0;

                case VK_SUBTRACT:
                Lzoomout:
                    newscalex = global.scalex / 1.125;
                    newscaley = global.scaley / 1.125;
                    if (global.pixelx / cast(int)(10 * newscalex) <= (Mcolmx + 1))
                    {
                        if (global.pixely / cast(int)(10 * newscaley) > (Mrowmx + 1))
                            newscaley = global.scaley;
                      Lnew:
                        adjSector(newscalex, newscaley);
                        InvalidateRect(hwnd, &global.sector, FALSE);
                    }
                    return 0;

                case VK_PRIOR:  // PgUp
                case VK_NEXT:   // PgDn
                case VK_HOME:
                case VK_LEFT:
                case VK_RIGHT:
                case VK_UP:
                case VK_DOWN:
                    return 0;

                default:
                    break;
            }
            break;

        case WM_PAINT:
            hdc = BeginPaint(hwnd, &ps);

            if (!global.inited || !global.player)
            {   double sx, sy;

                sx = global.cxClient / 120.0;
                if (sx < 1)
                    sx = 1;
                sy = global.cyClient / 160.0;
                if (sy < 1)
                    sy = 1;
                DrawBitmap(hdc, 0, 0, global.hSplash,
                    sx, sy,
                    SRCCOPY);
                static int intro;
                if (!intro++)
                    PlaySoundA("intro.wav", null, SND_ASYNC | SND_FILENAME);
            }
            else
            {
                int r, c;
                int dx;
                int dy;
                DWORD mode;
                RECT clipbox;

                GetClipBox(hdc, &clipbox);
                if (clipbox.bottom < global.sector.top)
                    goto LpaintText;

                SelectClipRgn(hdc, global.sectorRegion);

                r = ROW(global.ulcorner);
                c = COL(global.ulcorner);
                int rmax, cmax;
                dx = cast(int)(10 * global.scalex);
                dy = cast(int)(10 * global.scaley);
                rmax = r + (global.offsety + global.pixely + dy - 1) / dy;
                cmax = c + (global.offsetx + global.pixelx + dx - 1) / dx;
                if (rmax > Mrowmx)
                    rmax = Mrowmx + 1;
                if (cmax > Mcolmx)
                    cmax = Mcolmx + 1;
                for (j = r; j < rmax; j++)
                {   int y;

                    y = global.sector.top + (j - r) * dy - global.offsety;
                    if (y >= clipbox.bottom ||
                        y + dy < clipbox.top)
                        continue;

                    for (i = c; i < cmax; i++)
                    {
                        loc_t loc = j * (Mcolmx + 1) + i;
                        HBITMAP h;
                        int x;

                        x = (i - c) * dx - global.offsetx;
                        if (x >= clipbox.right ||
                            x + dx < clipbox.left)
                            continue;

                        h = global.mapvaltab[global.map[loc]];
                        if ((j % 10) == 0 && (i % 10) == 0 &&
                            global.map[loc] == 0)
                            h = global.unknown10;
                        mode = SRCCOPY;
                        if (loc == global.cursor && global.player.mode != mdSURV)
                        {
                            mode = NOTSRCCOPY;
                        }
                        DrawBitmap(hdc, cast(short)x, cast(short)y, h,
                                   global.scalex, global.scaley, mode);
                    }
                }

                // Draw a rectangle around the map edge
                int x1,y1,x2,y2;
                x1 = -c * dx - global.offsetx;
                y1 = 40 - r * dx - global.offsety;
                x2 = x1 + (Mcolmx + 1) * dx - 1;
                y2 = y1 + (Mrowmx + 1) * dy - 1;
                global.hPen = CreatePen(PS_SOLID, dx/3+2, RGB(255, 0, 0));
                SelectObject(hdc, global.hPen);
                MoveToEx(hdc, x1, y1, null);
                LineTo(hdc, x2, y1);
                LineTo(hdc, x2, y2);
                LineTo(hdc, x1, y2);
                LineTo(hdc, x1, y1);
                DeleteObject(global.hPen);

                // Do the blast graphic
                if (global.blastState)
                {
                    DrawBitmap(hdc, cast(short)global.blastx, cast(short)global.blasty, global.hBlastmask, 1.0, 1.0, SRCAND);
                    DrawBitmap(hdc, cast(short)global.blastx, cast(short)global.blasty, global.hBlast, 1.0, 1.0, SRCPAINT);
                }

                // Survey and direction mode graphics would go here (simplified)

              LpaintText:
                if (clipbox.bottom > global.text.top &&
                    clipbox.top < global.text.bottom)
                {
                    // Do the text box
                    SelectClipRgn(hdc, global.textRegion);

                    // Fill background
                    FillRect(hdc, &global.text, GetStockObject(WHITE_BRUSH));

                    SelectObject(hdc, global.hFont);
                    for (i = 0; i < 4; i++)
                    {
                        // Split rendering: player stats on left, action messages on right
                        int len = cast(int)strlen(vbuffer[i].ptr);
                        int splitCol = 68;  // Where action messages start

                        if (i <= 1 && len > splitCol)
                        {
                            // Render player stats (left side)
                            TextOutA(hdc, 0, global.cyChar * i, vbuffer[i].ptr, splitCol);

                            // Render action messages (right side of screen)
                            int rightLen = len - splitCol;
                            int rightX = global.cxClient - (rightLen * global.cxChar);
                            if (rightX < splitCol * global.cxChar) rightX = splitCol * global.cxChar;
                            TextOutA(hdc, rightX, global.cyChar * i, vbuffer[i].ptr + splitCol, rightLen);
                        }
                        else
                        {
                            TextOutA(hdc, 0, global.cyChar * i, vbuffer[i].ptr, len);
                        }
                    }
                }
            }

            EndPaint(hwnd, &ps);
            return 0;

        case WM_DESTROY:
            for (i = 0; i < MAPMAX; i++)
            {
                if (global.mapvaltab[i])
                    DeleteObject(global.mapvaltab[i]);
            }

            DeleteObject(global.unknown10);
            DeleteObject(global.hBlast);
            DeleteObject(global.hBlastmask);
            DeleteObject(global.hSplash);
            DeleteObject(global.hCursor);
            DeleteObject(global.hFont);
            DeleteObject(global.sectorRegion);
            DeleteObject(global.textRegion);

            PostQuitMessage(0);
            return 0;

        default:
            break;
    }
    } catch (Exception e) {
        // Handle exceptions
    }
    return DefWindowProcA(hwnd, message, wParam, lParam);
}


/********************************************
 * "About" dialog box.
 */

extern (Windows) INT_PTR AboutDlgProc(HWND hDlg, UINT message, WPARAM wParam,
                                                               LPARAM lParam) nothrow
{
    switch (message)
    {
        case WM_INITDIALOG:
            return TRUE;

        case WM_COMMAND:
            switch (wParam)
            {
                case IDOK:
                case IDCANCEL:
                    EndDialog(hDlg, 0);
                    return TRUE;
                default:
                    break;
            }
            break;

        default:
            break;
    }
    return FALSE;
}

/********************************************
 * "City Select" dialog box.
 */

extern (Windows) INT_PTR CitySelectDlgProc(HWND hDlg, UINT message, WPARAM wParam,
                                                               LPARAM lParam) nothrow
{
    static HWND hSensor;
    static HWND hTile;
    BOOL result = FALSE;

    HDC hDC;
    RECT rect;
    int r, c;
    int dx, dy;
    double scalex, scaley;
    int i, j;

    switch (message)
    {
        case WM_INITDIALOG:
            global.newphase = global.phase;
            CheckRadioButton(hDlg, IDD_ARMIES, IDD_BATTLESHIPS, global.newphase);

            hSensor = GetDlgItem(hDlg, IDD_SENSOR);
            hTile = GetDlgItem(hDlg, IDD_TILE);

            SetFocus(GetDlgItem(hDlg, global.newphase));
            return TRUE;

        case WM_COMMAND:
            switch (wParam)
            {
                case IDOK:
                    global.phase = global.newphase;
                    EndDialog(hDlg, TRUE);
                    return TRUE;

                case IDCANCEL:
                    EndDialog(hDlg, FALSE);
                    return TRUE;

                case IDD_ARMIES:
                case IDD_FIGHTERS:
                case IDD_DESTROYERS:
                case IDD_TRANSPORTS:
                case IDD_SUBMARINES:
                case IDD_CRUISERS:
                case IDD_CARRIERS:
                case IDD_BATTLESHIPS:
                    global.newphase = cast(int)wParam;
                    CheckRadioButton(hDlg, IDD_ARMIES, IDD_BATTLESHIPS, global.newphase);
                    result = TRUE;
                    goto LpaintTile;

                default:
                    break;
            }
            break;

        case WM_PAINT:
            // Sensor probe
            InvalidateRect(hSensor, null, TRUE);
            UpdateWindow(hSensor);

            hDC = GetDC(hSensor);
            GetClientRect(hSensor, &rect);

            r = ROW(global.cursor) - 2;
            if (r < 0)
                r = 0;
            if (r + 5 > Mrowmx)
                r = Mrowmx - 5;
            c = COL(global.cursor) - 2;
            if (c < 0)
                c = 0;
            if (c + 5 > Mcolmx)
                c = Mcolmx - 5;

            dx = (rect.right - rect.left) / 5;
            dy = (rect.bottom - rect.top) / 5;
            scalex = dx / cast(double)10;
            scaley = dy / cast(double)10;

            for (j = 0; j < 5; j++)
            {
                for (i = 0; i < 5; i++)
                {
                    loc_t loc = (r + j) * (Mcolmx + 1) + (c + i);
                    HBITMAP h = global.mapvaltab[global.map[loc]];

                    DrawBitmap(hDC, cast(short)(rect.left + i * dx), cast(short)(rect.top + j * dy),
                        h, scalex, scaley, SRCCOPY);
                }
            }

            ReleaseDC(hSensor, hDC);

        LpaintTile:
            // Sample Tile
            InvalidateRect(hTile, null, TRUE);
            UpdateWindow(hTile);

            hDC = GetDC(hTile);
            GetClientRect(hTile, &rect);

            dx = rect.right - rect.left;
            dy = rect.bottom - rect.top;
            scalex = dx / cast(double)10;
            scaley = dy / cast(double)10;

            {
                int ab = global.newphase - IDD_ARMIES;
                HBITMAP h = global.mapvaltab[ab + ((ab <= F) ? 5 : 6)];

                DrawBitmap(hDC, cast(short)rect.left, cast(short)rect.top,
                    h, scalex, scaley, SRCCOPY);
            }

            ReleaseDC(hTile, hDC);
            break;

        default:
            break;
    }
    return result;
}


/********************************
 * Dialog box to get city phase.
 */

int dialogCitySelect(int oldphase)
{
    UpdateWindow(global.hwnd);
    if (oldphase & ~7)
        oldphase = 0;       // default to armies
    global.phase = oldphase + IDD_ARMIES;

    DialogBoxParamA(global.hinst, "CitySelectBox", global.hwnd, global.lpfnCitySelectDlgProc, 0);

    return global.phase - IDD_ARMIES;
}


/********************************************
 * "Init" dialog box.
 */

extern (Windows) INT_PTR InitDlgProc(HWND hDlg, UINT message, WPARAM wParam,
                                                               LPARAM lParam) nothrow
{
    switch (message)
    {
        case WM_INITDIALOG:
            global.newnumplayers = global.numplayers;
            CheckRadioButton(hDlg, IDD_ONE, IDD_SIX, global.newnumplayers);
            if (global.demo)
                CheckRadioButton(hDlg, IDD_DEMO, IDD_DEMO, IDD_DEMO);
            SetFocus(GetDlgItem(hDlg, global.newnumplayers));
            return TRUE;

        case WM_COMMAND:
            switch (wParam)
            {
                case IDOK:
                    global.numplayers = global.newnumplayers;
                    EndDialog(hDlg, TRUE);
                    return TRUE;

                case IDCANCEL:
                    EndDialog(hDlg, FALSE);
                    return TRUE;

                case IDD_ONE:
                case IDD_TWO:
                case IDD_THREE:
                case IDD_FOUR:
                case IDD_FIVE:
                case IDD_SIX:
                    global.newnumplayers = cast(int)wParam;
                    CheckRadioButton(hDlg, IDD_ONE, IDD_SIX, global.newnumplayers);
                    return TRUE;

                case IDD_DEMO:
                    global.demo ^= 1;
                    CheckRadioButton(hDlg, IDD_DEMO, IDD_DEMO, global.demo ? IDD_DEMO : IDD_DEMO + 1);
                    return TRUE;

                default:
                    break;
            }
            break;

        default:
            break;
    }
    return FALSE;
}




/******************************
 * Flush the display.
 */

extern (C) void win_flush()
{
    InvalidateRect(global.hwnd, &global.text, FALSE);
    UpdateWindow(global.hwnd);
}

/******************************
 * Sound functions.
 */

extern (C) void sound_click()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("click.wav", null, SND_ASYNC | SND_FILENAME | SND_NOSTOP);
}

void sound_gun()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("gun_1.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_bang()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
    {   PlaySoundA("explosi1.wav", null, SND_SYNC | SND_FILENAME);
        PlaySoundA("bubbles.wav", null, SND_SYNC | SND_FILENAME);
    }
}

void sound_error()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("error.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_splash()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("splash.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_aground()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("bubbles.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_subjugate()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("machine1.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_crushed()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("gun_3.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_flyby()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("flyby.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_fcrash()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("explode.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_fuel()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("fuel.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_taps()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("taps.wav", null, SND_SYNC | SND_FILENAME);
}

void sound_ackack()
{
    UpdateWindow(global.hwnd);
    if (global.speaker)
        PlaySoundA("ackack1.wav", null, SND_SYNC | SND_FILENAME);
}

/***********************************
 * Setup for Windows.
 */

void winSetup()
{
    debug
    {
        setran();
    }

    Display.Text *t = &player[0].display.text;

    selmap();           // read in map
    citini();           // init city variables

    numply = global.numplayers - IDD_ONE + 1;
    numleft = numply;
    for (plynum = 0; plynum <= numply; plynum++)
    {
        Player *p = &player[plynum];
        p.display = new Display();
        Display *d = p.display;
        d.initialize();

        p.num = plynum;
        p.map = (plynum == 0) ? .map.ptr : cast(ubyte *)calloc(MAPSIZE, 1);
        p.human = (plynum == 1 && !global.demo);
        p.watch = DAnone;

        if (p.human)
        {
            d.timeinterval = 1;
        }

        if (plynum == 1)
        {
            p.secflg = 1;
            p.watch = DAwindows;
            d.text.TTinit();
            d.text.watch = p.watch;
            d.maptab = MTcgacolor;
            d.setdispsize(d.text.nrows, d.text.ncols);
            d.text.clear();
            d.text.block_cursor();
        }
        if (plynum)
            p.citsel();     // select city for each player
    }

    plynum = 1;         // get the default player
}

void winRestore()
{
    debug
    {
        setran();       // seed random number generator
    }

    Display.Text *t = &player[0].display.text;

    t.TTinit();

    for (plynum = 0; plynum <= numply; plynum++)
    {   Player *p = &player[plynum];
        Display *d = new Display();
        p.display = d;
        d.initialize();

        if (p.human)
        {
            d.timeinterval = 1;
        }

        if (plynum == 1)
        {
            p.secflg = 1;
            p.watch = DAwindows;
            d.text.TTinit();
            d.text.watch = p.watch;
            d.maptab = MTcgacolor;
            d.setdispsize(d.text.nrows, d.text.ncols);
            d.text.clear();
            d.text.block_cursor();
        }
    }
    plynum = 1;         // get the default player
}

/***************************************
 * Given new scale factors x,y, adjust sector location.
 */

int adjSector(double newscalex, double newscaley)
{
    int cursorx;
    int dx;
    int ncols;
    int scmin;
    int scmax;

    int cursory;
    int dy;
    int nrows;
    int srmin;
    int srmax;

    int gap;
    int n;
    int width;
    Display *d;

    int moved = 0;
    int newval;

    if (!global.player)     // if not initialized yet
        return 0;

    ncols = COL(global.cursor) - COL(global.ulcorner);
    dx = cast(int)(10 * global.scalex);
    cursorx = ncols * dx + (dx / 2) - global.offsetx;
    dx = cast(int)(10 * newscalex);
    n = (cursorx - (dx / 2) + (dx - 1)) / dx;
    if (cursorx < dx + (dx / 2))
    {   n = 1;
        cursorx = n * dx + (dx / 2);
    }
    if (COL(global.cursor) < n)
    {   n = COL(global.cursor);
        cursorx = n * dx + (dx / 2);
    }
    width = (global.pixelx + (dx - 1)) / dx;

    gap = cursorx - dx/2 + 3 * dx - global.pixelx;
    if (gap > 0)
    {
        cursorx -= gap;
        n = (cursorx - (dx / 2) + (dx - 1)) / dx;
    }
    gap = global.pixelx - (((Mcolmx + 1) - COL(global.cursor)) * dx + cursorx - dx/2);
    if (gap > 0)
    {
        cursorx += gap;
        n = (cursorx - (dx / 2) + (dx - 1)) / dx;
        if (COL(global.cursor) < n)
        {   n = COL(global.cursor);
            cursorx = n * dx + (dx / 2);
        }
    }

    newval = dx * n + dx / 2 - cursorx;
    if (newval != global.offsetx)
        moved = 1;
    global.offsetx = newval;
    scmin = COL(global.cursor) - n;
    scmax = (width - 1);
    assert(scmin <= COL(global.cursor));

    nrows = ROW(global.cursor) - ROW(global.ulcorner);
    dy = cast(int)(10 * global.scaley);
    cursory = nrows * dy + (dy / 2) - global.offsety;
    dy = cast(int)(10 * newscaley);
    n = (cursory - (dy / 2) + (dy - 1)) / dy;
    if (cursory < dy + (dy / 2))
    {   n = 1;
        cursory = n * dy + (dy / 2);
    }
    if (ROW(global.cursor) < n)
    {   n = ROW(global.cursor);
        cursory = n * dy + dy / 2;
    }
    width = (global.pixely + (dy - 1)) / dy;

    gap = cursory - dy/2 + 3 * dy - global.pixely;
    if (gap > 0)
    {
        cursory -= gap;
        n = (cursory - (dy / 2) + (dy - 1)) / dy;
    }
    gap = global.pixely - (((Mrowmx + 1) - ROW(global.cursor)) * dy + cursory - dy/2);
    if (gap > 0)
    {
        cursory += gap;
        n = (cursory - (dy / 2) + (dy - 1)) / dy;
        if (ROW(global.cursor) < n)
        {   n = ROW(global.cursor);
            cursory = n * dy + dy / 2;
        }
    }

    newval = dy * n + dy / 2 - cursory;
    if (newval != global.offsety)
        moved = 1;
    global.offsety = newval;
    srmin = ROW(global.cursor) - n;
    srmax = (width - 1);

    d = global.player.display;
    d.Smax = srmax * 256 + scmax;

    newval = srmin * (Mcolmx + 1) + scmin;
    if (newval != global.ulcorner)
        moved = 1;
    global.ulcorner = newval;
    d.secbas = global.ulcorner;

    assert(global.ulcorner >= 0 && global.ulcorner < MAPSIZE);
    assert(global.ulcorner <= global.cursor && global.cursor < MAPSIZE);
    assert(COL(global.ulcorner) <= COL(global.cursor));
    assert(dx > 0 && dy > 0);
    assert(global.offsetx >= 0 && global.offsetx < dx);
    assert(global.offsety >= 0 && global.offsety < dy);

    global.scalex = newscalex;
    global.scaley = newscaley;

    return moved;
}

/*************************************
 * Invalidate display of loc on the screen.
 */

void invalidateLoc(loc_t loc)
{
    RECT rect;
    int r, c;
    int dx;
    int dy;

    assert(loc < MAPSIZE);

    r = ROW(loc) - ROW(global.ulcorner);
    c = COL(loc) - COL(global.ulcorner);
    dx = cast(int)(10 * global.scalex);
    dy = cast(int)(10 * global.scaley);

    rect.left = c * dx - global.offsetx;
    rect.top = 40 + r * dy - global.offsety;
    rect.right = rect.left + dx;
    rect.bottom = rect.top + dy;

    InvalidateRect(global.hwnd, &rect, FALSE);
}

/*************************************
 * Invalidate display of rectangle formed by corners loc1, loc2.
 */

void invalidateLocRect(loc_t loc1, loc_t loc2)
{
    RECT rect;
    int r1, c1;
    int r2, c2;
    int dx;
    int dy;

    assert(loc1 < MAPSIZE);
    assert(loc2 < MAPSIZE);

    r1 = ROW(loc1) - ROW(global.ulcorner);
    c1 = COL(loc1) - COL(global.ulcorner);
    r2 = ROW(loc2) - ROW(global.ulcorner);
    c2 = COL(loc2) - COL(global.ulcorner);

    if (r1 > r2)
    {   int r;
        r = r1;
        r1 = r2;
        r2 = r;
    }
    if (c1 > c2)
    {   int c;
        c = c1;
        c1 = c2;
        c2 = c;
    }

    dx = cast(int)(10 * global.scalex);
    dy = cast(int)(10 * global.scaley);

    rect.left = c1 * dx - global.offsetx;
    rect.top = 40 + r1 * dy - global.offsety;
    rect.right = rect.left + dx * (c2 - c1 + 1);
    rect.bottom = rect.top + dy * (r2 - r1 + 1);

    InvalidateRect(global.hwnd, &rect, FALSE);
}

/******************************************
 * Invalidate entire sector.
 */

void invalidateSector()
{
    InvalidateRect(global.hwnd, &global.sector, FALSE);
}

/******************************************
 * Convert loc to screen coordinate.
 */

int LocToX(loc_t loc)
{
    int dx;
    int x;
    int col;

    col = COL(loc) - COL(global.ulcorner);
    dx = cast(int)(10 * global.scalex);
    x = col * dx + dx / 2 - global.offsetx;
    return x;
}

int LocToY(loc_t loc)
{
    int dy;
    int y;
    int row;

    row = ROW(loc) - ROW(global.ulcorner);
    dy = cast(int)(10 * global.scaley);
    y = 40 + row * dy + dy / 2 - global.offsety;
    return y;
}

/*********************************************
 * Start/Stop blast graphic.
 */

void ShowBlast(int state, loc_t loc)
{
    RECT blastbox;
    int x, y;

    x = LocToX(loc);
    y = LocToY(loc);
    blastbox.bottom = y + 5;
    blastbox.top = blastbox.bottom - 20;
    blastbox.left = x - 10;
    blastbox.right = x + 10;
    InvalidateRect(global.hwnd, &blastbox, FALSE);
    global.blastState = state;
    global.blastx = blastbox.left;
    global.blasty = blastbox.top;
    if (state)
        UpdateWindow(global.hwnd);
}

/* ================================================================== */
/* DPI Awareness for Windows 10/11                                     */
/* ================================================================== */

/**
 * DPI awareness context values for Windows 10 1703+
 */
enum DPI_AWARENESS_CONTEXT : HANDLE
{
    UNAWARE              = cast(HANDLE)-1,
    SYSTEM_AWARE         = cast(HANDLE)-2,
    PER_MONITOR_AWARE    = cast(HANDLE)-3,
    PER_MONITOR_AWARE_V2 = cast(HANDLE)-4,
    UNAWARE_GDISCALED    = cast(HANDLE)-5,
}

/**
 * Initialize DPI awareness for the application.
 * Tries the best available DPI awareness mode.
 */
void initDpiAwareness() nothrow
{
    // Try Windows 10 1703+ API first (best option)
    HMODULE user32 = GetModuleHandleA("user32.dll");
    if (user32)
    {
        // SetProcessDpiAwarenessContext (Windows 10 1703+)
        alias SetDpiContextFn = extern(Windows) BOOL function(DPI_AWARENESS_CONTEXT) nothrow;
        auto setDpiContext = cast(SetDpiContextFn)GetProcAddress(user32, "SetProcessDpiAwarenessContext");
        if (setDpiContext)
        {
            // Try Per-Monitor V2 first (best for Windows 10/11)
            if (setDpiContext(DPI_AWARENESS_CONTEXT.PER_MONITOR_AWARE_V2))
                return;
            // Fall back to Per-Monitor V1
            if (setDpiContext(DPI_AWARENESS_CONTEXT.PER_MONITOR_AWARE))
                return;
        }
    }

    // Try Windows 8.1+ API
    HMODULE shcore = LoadLibraryA("shcore.dll");
    if (shcore)
    {
        alias SetProcessDpiAwarenessFn = extern(Windows) HRESULT function(int) nothrow;
        auto setDpiAwareness = cast(SetProcessDpiAwarenessFn)GetProcAddress(shcore, "SetProcessDpiAwareness");
        if (setDpiAwareness)
        {
            // PROCESS_PER_MONITOR_DPI_AWARE = 2
            setDpiAwareness(2);
            return;
        }
    }

    // Fall back to Vista+ API
    if (user32)
    {
        alias SetProcessDPIAwareFn = extern(Windows) BOOL function() nothrow;
        auto setDpiAware = cast(SetProcessDPIAwareFn)GetProcAddress(user32, "SetProcessDPIAware");
        if (setDpiAware)
        {
            setDpiAware();
        }
    }
}

/**
 * Get the DPI for a window (Windows 10 1607+) or system DPI.
 */
uint getDpiForWindow(HWND hwnd) nothrow
{
    HMODULE user32 = GetModuleHandleA("user32.dll");
    if (user32)
    {
        alias GetDpiForWindowFn = extern(Windows) UINT function(HWND) nothrow;
        auto getDpi = cast(GetDpiForWindowFn)GetProcAddress(user32, "GetDpiForWindow");
        if (getDpi && hwnd)
        {
            return getDpi(hwnd);
        }
    }

    // Fall back to system DPI
    HDC hdc = GetDC(null);
    uint dpi = cast(uint)GetDeviceCaps(hdc, LOGPIXELSX);
    ReleaseDC(null, hdc);
    return dpi;
}

/**
 * Scale a value based on DPI.
 */
int scaleDpi(int value, uint dpi) pure nothrow
{
    return (value * dpi) / 96;
}

/* ================================================================== */
/* Platform Adapter Functions                                          */
/* These C-callable functions provide the bridge between the           */
/* platform-independent IPlatform interface and the Win32 code.        */
/* ================================================================== */

extern (C):

/**
 * Invalidate a single map location for redraw.
 */
void win_invalidate_loc(uint loc)
{
    if (global.hwnd is null)
        return;

    RECT locbox;
    int x = LocToX(loc);
    int y = LocToY(loc);
    int dx = cast(int)(10 * global.scalex);
    int dy = cast(int)(10 * global.scaley);

    locbox.left = x - dx / 2;
    locbox.right = x + dx / 2;
    locbox.top = y - dy / 2;
    locbox.bottom = y + dy / 2;

    InvalidateRect(global.hwnd, &locbox, FALSE);
}

/**
 * Invalidate entire sector for redraw.
 */
void win_invalidate_sector()
{
    if (global.hwnd !is null)
    {
        InvalidateRect(global.hwnd, null, TRUE);
    }
}

/**
 * Poll for key input without blocking.
 * Returns key code or -1 if no key available.
 */
int win_poll_key()
{
    MSG msg;

    if (PeekMessageA(&msg, null, 0, 0, PM_REMOVE))
    {
        if (msg.message == WM_KEYDOWN)
        {
            int key = cast(int)msg.wParam;
            // Convert scan codes to key codes
            if (key >= 'a' && key <= 'z')
                key -= 32;  // Convert to uppercase
            return key;
        }
        TranslateMessage(&msg);
        DispatchMessageA(&msg);
    }
    return -1;
}

/**
 * Wait for key input (blocking).
 * Returns key code.
 */
int win_wait_key()
{
    MSG msg;
    int key;

    while (true)
    {
        if (GetMessageA(&msg, null, 0, 0) <= 0)
            return -1;

        if (msg.message == WM_KEYDOWN)
        {
            key = cast(int)msg.wParam;
            if (key >= 'a' && key <= 'z')
                key -= 32;
            return key;
        }
        TranslateMessage(&msg);
        DispatchMessageA(&msg);
    }
}

/**
 * Play a sound effect.
 * id: Sound effect ID (maps to SoundId enum)
 * sync: If true, wait for sound to complete
 */
void win_play_sound(int id, bool sync)
{
    if (!global.speaker)
        return;

    static immutable const(char)*[] soundFiles = [
        "click.wav",        // 0: Click
        "explode.wav",      // 1: Explosion
        "splash.wav",       // 2: Splash
        "flyby.wav",        // 3: Flyby
        "gun_1.wav",        // 4: Gunfire
        "ackack1.wav",      // 5: AckAck
        "bubbles.wav",      // 6: Bubbles
        "fuel.wav",         // 7: Fuel
        "error.wav",        // 8: Error
        "intro.wav",        // 9: Intro
        "taps.wav",         // 10: Taps
        "machine1.wav",     // 11: MachineGun
    ];

    if (id >= 0 && id < soundFiles.length)
    {
        uint flags = SND_FILENAME | (sync ? SND_SYNC : SND_ASYNC);
        PlaySoundA(soundFiles[id], null, flags);
    }
}

/**
 * Show city production dialog.
 * Returns selected unit type (0-7) or -1 if cancelled.
 */
int win_show_city_dialog(int currentPhase)
{
    return dialogCitySelect(currentPhase);
}

/**
 * Show new game dialog.
 * Returns number of players (1-6) or 0 if cancelled.
 */
int win_show_new_game_dialog()
{
    INT_PTR result = DialogBoxParamA(global.hinst, "InitBox", global.hwnd,
                                      global.lpfnInitDlgProc, 0);
    if (result)
    {
        // IDD_ONE = 161, so numplayers = IDD_xxx - 160
        return global.numplayers - 160;
    }
    return 0;  // Cancelled
}

/**
 * Show about dialog.
 */
void win_show_about_dialog()
{
    DialogBoxParamA(global.hinst, "AboutBox", global.hwnd,
                    global.lpfnAboutDlgProc, 0);
}

/**
 * Delay for specified time units (1 unit = ~100ms).
 */
void win_delay(int units)
{
    if (units > 0)
    {
        Sleep(units * 100);
    }
}

/**
 * Get current time in milliseconds.
 */
long win_get_time_ms()
{
    return GetTickCount();
}
