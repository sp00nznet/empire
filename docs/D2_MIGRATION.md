# D1 to D2 Migration Notes

This document explains the changes made to port the Empire codebase from D1 (Digital Mars D) to D2 (modern D with LDC2 compiler).

## Why This Migration?

The original Empire source code was written for the Digital Mars D1 compiler, which is now obsolete. D2 is the current standard, and LDC2 (LLVM-based D compiler) produces modern, optimized executables compatible with Windows 11.

### Key Benefits
- **Windows 11 Compatibility** - Modern ABI and security features
- **64-bit Support** - Native x64 compilation
- **Better Optimization** - LLVM backend for improved performance
- **Active Maintenance** - LDC2 receives regular updates

## Changes Made

### 1. Import Path Changes

The D standard library reorganized module paths between D1 and D2:

| D1 Import | D2 Import | Files Affected |
|-----------|-----------|----------------|
| `std.c.stdlib` | `core.stdc.stdlib` | winmain.d, var.d, display.d |
| `std.c.stdio` | `core.stdc.stdio` | var.d, printf.d, eplayer.d |
| `std.c.time` | `core.stdc.time` | display.d |
| `std.c.string` | `core.stdc.string` | multiple files |
| `std.c.windows.windows` | `core.sys.windows.windows` | winmain.d, twin.d, text.d, display.d |
| `std.ctype` | `std.ascii` | text.d |

### 2. Contract Syntax Change

D2 changed the `body` keyword to `do` in function contracts:

```d
// D1 (old)
int func(int x)
in { assert(x > 0); }
body { return x * 2; }

// D2 (new)
int func(int x)
in { assert(x > 0); }
do { return x * 2; }
```

**Files modified:** var.d, path.d, sub2.d, display.d, eplayer.d

### 3. Array Declaration Syntax

D2 prefers the type on the left side:

```d
// D1 (old) - C-style
char buf[100];
ubyte data[];

// D2 (new) - D-style
char[100] buf;
ubyte[] data;
```

**Files modified:** mapdata.d, eplayer.d

### 4. Removed Obsolete Win16 Functions

`MakeProcInstance` was a Win16 compatibility function that is no longer needed:

```d
// D1 (old)
global.lpfnAboutDlgProc = cast(DLGPROC) MakeProcInstance(
    cast(FARPROC) &AboutDlgProc, global.hInstance);

// D2 (new) - Direct function pointer
global.lpfnAboutDlgProc = &AboutDlgProc;
```

**Files modified:** winmain.d

### 5. Callback Function Attributes

Win32 callbacks now require `nothrow` attribute in D2:

```d
// D1 (old)
extern(Windows) LRESULT WndProc(HWND hwnd, UINT message,
                                 WPARAM wParam, LPARAM lParam)

// D2 (new)
extern(Windows) LRESULT WndProc(HWND hwnd, UINT message,
                                 WPARAM wParam, LPARAM lParam) nothrow
```

**Files modified:** winmain.d, twin.d

### 6. Variadic Function Handling

D2 changed how variadic arguments work:

```d
// D1 (old)
void PRINTF(char[] fmt, ...) {
    va_list ap;
    va_start!(char[])(ap, fmt);
    // ...
}

// D2 (new)
void PRINTF(const(char)* fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    // ...
}
```

**Files modified:** printf.d, text.d

### 7. String Literal Types

D2 is stricter about string mutability:

```d
// D1 (old)
char* s = "hello";

// D2 (new)
const(char)* s = "hello";
// or
char* s = cast(char*)"hello";  // if mutation needed
```

**Files modified:** Multiple files

### 8. DLGPROC Type Definition

The dialog procedure type needed adjustment for D2:

```d
// D2 definition
alias DLGPROC = extern(Windows) INT_PTR function(
    HWND, UINT, WPARAM, LPARAM) nothrow;
```

**Files modified:** winmain.d

### 9. Random Number Generation

Updated to use D2's `std.random`:

```d
// D1 (old)
import std.random;
int random(int n) { return rand() % n; }

// D2 (new)
import std.random : Mt19937, unpredictableSeed, uniform;
Mt19937 rng;
int random(int n) { return uniform(0, n, rng); }
```

**Files modified:** empire.d

### 10. Thread Sleep

```d
// D1 (old)
import std.c.time : sleep;
sleep(1);

// D2 (new)
import core.thread : Thread;
Thread.sleep(dur!"seconds"(1));
```

**Files modified:** display.d

## Files Modified Summary

| File | Changes |
|------|---------|
| empire.d | Random number generation, alias syntax |
| var.d | Imports, contract syntax |
| printf.d | Imports, variadic handling |
| text.d | Imports, std.ascii |
| path.d | Contract syntax |
| sub2.d | Contract syntax |
| twin.d | Imports, nothrow |
| display.d | Imports, contract syntax, Thread.sleep |
| maps.d | Minor syntax |
| move.d | Minor syntax |
| init.d | Minor syntax |
| winemp.d | Module declaration |
| mapdata.d | Array syntax |
| winmain.d | Imports, MakeProcInstance removal, nothrow, DLGPROC |
| eplayer.d | Imports, contract syntax, array syntax |

## Testing the Migration

After building with `dub build`, test these scenarios:
1. Start new game with 1-6 players
2. AI player movement
3. Save/load game
4. Sound effects
5. All unit types (Army, Fighter, ships)
6. City production changes

## Known Issues

None currently identified. Report issues to the repository.
