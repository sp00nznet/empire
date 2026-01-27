# Empire: Wargame of the Century

A classic turn-based strategy wargame originally written by Walter Bright in 1978, ported to modern platforms.

## Overview

Empire is a turn-based strategy game where players compete to conquer cities and destroy enemy forces using armies, fighters, and naval units. This repository contains a modernized port of the original D language codebase.

## Project Status

This is an active port with the following goals:
1. **Windows 11** - Native executable using LDC2 compiler
2. **HTML5** - Web browser version using TypeScript (future)

## Building

### Prerequisites

- [LDC2](https://github.com/ldc-developers/ldc/releases) (LLVM-based D compiler)
- [DUB](https://dub.pm/) (D package manager, included with LDC2)

### Build Commands

```bash
# Debug build
dub build

# Release build
dub build --build=release

# Run
./empire.exe
```

## Directory Structure

```
empire/
├── dub.json           # Build configuration
├── source/            # D2 source files
│   ├── empire.d       # Core types and constants
│   ├── eplayer.d      # Player struct and AI
│   ├── display.d      # Display management
│   ├── winmain.d      # Windows entry point
│   └── ...            # Other modules
├── docs/              # Documentation
│   ├── D2_MIGRATION.md
│   └── BUILD_PLAN.md
└── assets/            # Game assets (bitmaps, sounds)
```

## Documentation

- [D2 Migration Notes](docs/D2_MIGRATION.md) - Changes from D1 to D2
- [Build Plan](docs/BUILD_PLAN.md) - Full porting roadmap

## License

Copyright (C) 1978-2004 by Walter Bright. All Rights Reserved.

Personal use only. Contact www.digitalmars.com for commercial licensing.

## Credits

- Original game by Walter Bright
- D2/LDC2 port for Windows 11 compatibility
