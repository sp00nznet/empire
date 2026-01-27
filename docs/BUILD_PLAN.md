# Empire Wargame Build Plan

This document outlines the complete roadmap for porting Empire to modern platforms.

## Project Goals

1. **Windows 11 Native** - Modern unified executable using LDC2 compiler
2. **HTML5 Web App** - Browser-based version with TypeScript
3. **Docker Deployment** - Containerized web version

## Phase Overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | D2 Migration | COMPLETE |
| 2 | Platform Abstraction Layer | IN PROGRESS |
| 3 | Windows 11 Native Port | Pending |
| 4 | HTML5 TypeScript Port | Pending |
| 5 | Docker Containerization | Pending |

---

## Phase 1: D2 Migration (COMPLETE)

### Objectives
- Create modern build system with DUB
- Fix all D1 to D2 syntax incompatibilities
- Prepare codebase for platform abstraction

### Deliverables
- [x] `dub.json` build configuration
- [x] All 15 source files ported to D2 syntax
- [x] Documentation of changes

### Build Instructions
```bash
# Install LDC2 from https://github.com/ldc-developers/ldc/releases
# Then run:
dub build
```

---

## Phase 2: Platform Abstraction Layer

### Objectives
- Create interfaces to decouple game logic from platform-specific code
- Enable same game logic to run on Windows (D) and Web (TypeScript)
- Separate human input handling from AI logic

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Game Logic                        │
│  (empire.d, eplayer.d AI, maps.d, path.d, move.d)   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Platform Interface (IPlatform)          │
│  - invalidateLoc(loc)      - playSound(id)          │
│  - invalidateSector()      - pollKey()              │
│  - drawText(row, text)     - showDialog(type)       │
└─────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌─────────────────────┐     ┌─────────────────────┐
│  Windows Platform   │     │   HTML5 Platform    │
│  (Win32 GDI, etc.)  │     │  (Canvas, WebAudio) │
└─────────────────────┘     └─────────────────────┘
```

### New Files to Create

```
source/
  core/
    platform.d      # IPlatform interface
    types.d         # Shared types (extracted from empire.d)
    game.d          # Game loop abstraction
  platform/
    windows/
      winplatform.d # Windows implementation
```

### Interface Definition

```d
interface IPlatform {
    // Display
    void invalidateLoc(uint loc);
    void invalidateSector();
    void drawText(int row, string text);
    void clearText();

    // Input
    int pollKey();           // Non-blocking key check
    int waitKey();           // Blocking key wait

    // Audio
    void playSound(SoundId id, bool sync);
    void toggleSound(bool enabled);

    // Dialogs
    int showDialog(DialogType type);
    int showCityDialog(int currentPhase);

    // Timing
    void delay(int units);
}
```

### Tasks
- [ ] Define IPlatform interface
- [ ] Extract pure game logic from display.d
- [ ] Split eplayer.d into AI (pure) and human input (platform-dependent)
- [ ] Create Windows platform implementation
- [ ] Update winmain.d to use abstraction

---

## Phase 3: Windows 11 Native Port

### Objectives
- Complete Windows platform implementation
- High-DPI awareness
- Modern Windows 11 compatibility

### Tasks
- [ ] Implement IPlatform for Windows
- [ ] Add DPI awareness manifest
- [ ] Test on Windows 11
- [ ] Create installer or portable package

### Build Output
```
empire.exe          # Main executable
assets/
  *.bmp            # Sprite bitmaps
  *.wav            # Sound effects
```

---

## Phase 4: HTML5 TypeScript Port

### Objectives
- Rewrite game logic in TypeScript
- Native Canvas rendering
- Web Audio API for sounds

### Project Structure

```
web/
  src/
    core/
      types.ts      # Unit, City, Player interfaces
      game.ts       # Game loop, turn management
      map.ts        # Map utilities
      path.ts       # Pathfinding (A* algorithm)
      combat.ts     # Battle mechanics
      ai.ts         # Computer player AI
    platform/
      renderer.ts   # Canvas 2D rendering
      audio.ts      # Web Audio API
      input.ts      # Keyboard handling
      storage.ts    # LocalStorage save/load
    index.ts        # Entry point
  public/
    index.html
    assets/
      sprites/      # PNG (converted from BMP)
      sounds/       # MP3/OGG (converted from WAV)
  package.json
  tsconfig.json
  vite.config.ts
```

### Asset Conversion

```bash
# BMP to PNG
for f in assets/*.bmp; do
  convert "$f" "web/public/assets/sprites/$(basename "$f" .bmp).png"
done

# WAV to MP3/OGG
for f in assets/*.wav; do
  ffmpeg -i "$f" "web/public/assets/sounds/$(basename "$f" .wav).mp3"
  ffmpeg -i "$f" "web/public/assets/sounds/$(basename "$f" .wav).ogg"
done
```

### Build Commands

```bash
cd web
npm install
npm run dev      # Development server
npm run build    # Production build
```

---

## Phase 5: Docker Containerization

### Objectives
- Package web version in Docker container
- Easy deployment to any server

### Dockerfile

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY web/ ./
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  empire:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

### Deployment

```bash
# Build and run
docker-compose up -d

# Access at http://localhost:8080
```

---

## Testing Strategy

### Windows Build
1. New game with 1, 2, 3, 6 players
2. Human vs Computer gameplay
3. All unit types function correctly
4. Save/load game works
5. Sound effects play
6. City production dialogs work

### HTML5 Build
1. Same gameplay tests as Windows
2. Touch/mobile support
3. LocalStorage persistence
4. Cross-browser testing (Chrome, Firefox, Safari, Edge)

---

## Timeline Estimates

| Phase | Estimated Duration |
|-------|-------------------|
| Phase 1 | COMPLETE |
| Phase 2 | 1 week |
| Phase 3 | 1 week |
| Phase 4 | 2-3 weeks |
| Phase 5 | 2-3 days |

**Total: 5-6 weeks**

---

## Resources

- [LDC2 Compiler](https://github.com/ldc-developers/ldc)
- [DUB Package Manager](https://dub.pm/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Build Tool](https://vitejs.dev/)
- [Docker Documentation](https://docs.docker.com/)
