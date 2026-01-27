# Empire Installation Guide

## Windows 11 Build Instructions

### Prerequisites

1. **LDC2 (LLVM-based D Compiler)**
   - Download from: https://github.com/ldc-developers/ldc/releases
   - Choose the latest `ldc2-X.X.X-windows-x64.7z` or `.zip`
   - Extract and add the `bin` folder to your PATH

2. **Windows SDK** (for resource compiler)
   - Usually included with Visual Studio
   - Or install Windows SDK standalone from Microsoft

3. **DUB** (D Package Manager)
   - Included with LDC2

### Building

#### Option 1: Using the Build Script

```batch
build.bat release
```

#### Option 2: Using DUB Directly

```batch
rem Compile resources first
rc /nologo /fo empire.res empire.rc

rem Build with DUB
dub build --build=release
```

#### Option 3: Using Visual Studio Developer Command Prompt

1. Open "Developer Command Prompt for VS 2022" (or your VS version)
2. Navigate to the empire directory
3. Run: `build.bat release`

### Running

After building, run:

```batch
empire.exe
```

### Game Controls

- **Arrow Keys / QWEASDZXC**: Move cursor/units
- **Space**: Stay in place
- **F**: From (set movement origin)
- **T**: To (set movement destination)
- **G**: Go to nearest city/carrier
- **K**: Wake up unit
- **L**: Load armies onto transport
- **P**: Change city production
- **R**: Random movement
- **S**: Sentry mode
- **Y**: Survey mode
- **ESC**: Exit current mode
- **< / >**: Decrease/increase game speed

### Troubleshooting

#### "LDC2 not found"
Add the LDC2 `bin` directory to your PATH environment variable.

#### "rc.exe not found"
Run from a Visual Studio Developer Command Prompt, or install Windows SDK.

#### High-DPI Display Issues
The game supports Per-Monitor DPI awareness on Windows 10/11. If you experience
scaling issues, try running in compatibility mode or adjusting your display
scaling settings.

#### Missing DLL Errors
Ensure you have the Visual C++ Redistributable installed:
https://aka.ms/vs/17/release/vc_redist.x64.exe

### Directory Structure

```
empire/
├── empire.exe          # Main executable (after building)
├── empire.res          # Compiled resources (after building)
├── *.bmp               # Game sprites
├── *.wav               # Sound effects
├── help.txt            # Game help file
├── source/             # D source files
└── docs/               # Documentation
```

### Uninstalling

Simply delete the empire directory. The game does not modify the registry
or install files elsewhere.
