@echo off
REM Empire Build Script for Windows
REM Requires: LDC2 (https://github.com/ldc-developers/ldc/releases)
REM           Windows SDK (for rc.exe resource compiler)

echo ========================================
echo Empire: Wargame of the Century
echo Build Script for Windows 11
echo ========================================
echo.

REM Check for LDC2
where ldc2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: LDC2 not found in PATH
    echo Please install LDC2 from:
    echo https://github.com/ldc-developers/ldc/releases
    exit /b 1
)

REM Check for resource compiler
where rc >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: rc.exe (Resource Compiler) not found in PATH
    echo You may need to run from a Visual Studio Developer Command Prompt
    echo or install Windows SDK
)

REM Build type
set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=debug

echo Building %BUILD_TYPE% configuration...
echo.

REM Compile resources first
echo Compiling resources...
rc /nologo /fo empire.res empire.rc
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Resource compilation failed
    exit /b 1
)

REM Build with DUB
echo Building with DUB...
dub build --build=%BUILD_TYPE%
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed
    exit /b 1
)

echo.
echo ========================================
echo Build successful!
echo Run: empire.exe
echo ========================================
