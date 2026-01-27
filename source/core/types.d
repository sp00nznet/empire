/*
 * Empire, the Wargame of the Century (tm)
 * Copyright (C) 1978-2004 by Walter Bright
 * All Rights Reserved
 *
 * Core Game Types
 * These types are shared between all platform implementations.
 *
 * Ported to D2/LDC2 for Windows 11 compatibility.
 */

module core.types;

// ========== Type Aliases ==========

alias loc_t = uint;     // Map location (0 to MAPSIZE-1)
alias dir_t = int;      // Direction (-1 to 7)

// ========== Constants ==========

enum int Mrowmx = 59;           // Maximum row index
enum int Mcolmx = 99;           // Maximum column index
enum int MAPSIZE = (Mrowmx + 1) * (Mcolmx + 1);  // 6000 total locations

enum int CITMAX = 70;           // Maximum number of cities
enum int UPTS = 700;            // Maximum number of units
enum int TYPMAX = 8;            // Number of unit types
enum int PLYMAX = 6;            // Maximum number of players
enum int LOCMAX = 20;           // Maximum locations tracked for AI

enum int MAPMAX = 74;           // Maximum map value

// ========== Unit Type Constants ==========

enum int A = 0;     // Army
enum int F = 1;     // Fighter
enum int D = 2;     // Destroyer
enum int T = 3;     // Troop Transport
enum int S = 4;     // Submarine
enum int R = 5;     // Cruiser
enum int C = 6;     // Aircraft Carrier
enum int B = 7;     // Battleship
enum int X = 8;     // City (not a unit type, but used in map)

// ========== Unit Type Masks (for AI targeting) ==========

enum int mA = 1;
enum int mF = 2;
enum int mD = 4;
enum int mT = 8;
enum int mS = 16;
enum int mR = 32;
enum int mC = 64;
enum int mB = 128;

// ========== Map Values ==========

enum int MAPunknown = 0;    // Unexplored
enum int MAPedge = 1;       // Edge of map (impassable)
enum int MAPsea = 2;        // Sea/water
enum int MAPland = 3;       // Land

// ========== Display Attributes ==========

enum ubyte DAnone = 0;
enum ubyte DAwindows = 1;

// ========== IFO (Information/Orders) Constants ==========

// These define what a unit is currently doing

enum int IFOnone = 0;       // No orders
enum int IFOgotoT = 1;      // Army going to transport
enum int IFOdirkam = 2;     // Fighter kamikaze direction
enum int IFOdir = 3;        // Moving in direction
enum int IFOtarkam = 4;     // Fighter kamikaze to target
enum int IFOtar = 5;        // Moving to target location
enum int IFOgotoC = 6;      // Fighter going to carrier
enum int IFOcity = 7;       // Going to city
enum int IFOdamaged = 8;    // Ship damaged, going to port
enum int IFOstation = 9;    // Carrier stationed
enum int IFOgstation = 10;  // Going to station
enum int IFOcitytar = 11;   // Ship targeting city
enum int IFOescort = 12;    // Escorting transport
enum int IFOshipexplor = 13;// Ship exploring
enum int IFOloadarmy = 14;  // Transport loading armies
enum int IFOacitytar = 15;  // Army targeting city
enum int IFOfolshore = 16;  // Following shoreline
enum int IFOonboard = 17;   // Army on transport

// Human player function codes
enum int fnAW = 0;          // Awake (no automatic movement)
enum int fnSE = 1;          // Sentry mode
enum int fnRA = 2;          // Random movement
enum int fnMO = 3;          // Move to location
enum int fnDI = 4;          // Move in direction
enum int fnFI = 5;          // Fill (load troops/fighters)

// ========== Mode Constants ==========

enum int mdNONE = 0;
enum int mdMOVE = 1;
enum int mdSURV = 2;        // Survey mode
enum int mdDIR = 3;         // Direction input
enum int mdTO = 4;          // To (destination) mode
enum int mdPHAS = 5;        // Phase selection

// ========== Key Constants ==========

enum int ESC = 27;

// ========== Structures ==========

/**
 * Unit type definition.
 * Contains static properties for each unit type.
 */
struct Type
{
    char unichr;        // Display character (A, F, D, T, S, R, C, B)
    ubyte hittab;       // Hit points / fuel capacity
    ubyte phstart;      // Production start delay (rounds)
    ubyte prodtime;     // Production time (rounds)
    const(char)* name;  // Full name
}

/**
 * Unit instance.
 * Represents a single game unit (army, ship, fighter, etc.)
 */
struct Unit
{
    loc_t loc;          // Current location (0 if destroyed)
    ubyte own;          // Owner player number (1-6)
    ubyte typ;          // Unit type (A, F, D, T, S, R, C, B)
    ubyte hit;          // Current hit points / fuel remaining
    ubyte ifo;          // Current orders (IFO* constant)
    uint ila;           // Order parameter (location, direction, or unit#)
    int dir;            // Preferred turn direction (-1 or 1)
    ubyte mov;          // Has moved this round?
    int fuel;           // Fuel remaining (fighters)
    int abd;            // Units aboard (transports/carriers)

    /**
     * Destroy this unit.
     */
    void destroy()
    {
        loc = 0;
    }
}

/**
 * City instance.
 * Represents a city on the map.
 */
struct City
{
    loc_t loc;          // Location on map
    ubyte own;          // Owner player number (0=neutral, 1-6=player)
    byte phs;           // Production phase (-1=none, 0-7=unit type)
    uint fnd;           // Round when current production completes
    loc_t fipath;       // Fighter patrol destination
    int round;          // Used by AI for various purposes
}

// ========== Helper Functions ==========

/**
 * Convert location to row number.
 */
pure int ROW(loc_t loc)
{
    return loc / (Mcolmx + 1);
}

/**
 * Convert location to column number.
 */
pure int COL(loc_t loc)
{
    return loc % (Mcolmx + 1);
}

/**
 * Convert row,col to location.
 */
pure loc_t LOC(int row, int col)
{
    return row * (Mcolmx + 1) + col;
}

/**
 * Check if location is on map border.
 */
pure bool border(loc_t loc)
{
    int row = ROW(loc);
    int col = COL(loc);
    return row == 0 || row == Mrowmx || col == 0 || col == Mcolmx;
}

/**
 * Validate location is within map bounds.
 */
pure bool chkloc(loc_t loc)
{
    return loc < MAPSIZE;
}

/**
 * Get location offset for a direction.
 * Directions: 0=E, 1=NE, 2=N, 3=NW, 4=W, 5=SW, 6=S, 7=SE, -1=stay
 */
pure int arrowOffset(dir_t dir)
{
    static immutable int[9] offsets = [
        1,                      // 0: East
        -(Mcolmx + 1) + 1,      // 1: Northeast
        -(Mcolmx + 1),          // 2: North
        -(Mcolmx + 1) - 1,      // 3: Northwest
        -1,                     // 4: West
        (Mcolmx + 1) - 1,       // 5: Southwest
        (Mcolmx + 1),           // 6: South
        (Mcolmx + 1) + 1,       // 7: Southeast
        0                       // -1/8: Stay put
    ];

    if (dir < 0 || dir > 7)
        return 0;
    return offsets[dir];
}
