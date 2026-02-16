@echo off
set SDK_ROOT=C:\Program Files (x86)\Windows Kits\10
set SDK_VERSION=10.0.26100.0
set SDK_INC=%SDK_ROOT%\Include\%SDK_VERSION%
set SDK_BIN=%SDK_ROOT%\bin\%SDK_VERSION%\x64

echo Compiling resources...
"%SDK_BIN%\rc.exe" /nologo /I"%SDK_INC%\um" /I"%SDK_INC%\shared" /fo empire.res empire.rc
if %ERRORLEVEL% EQU 0 (
    echo Success! Created empire.res
) else (
    echo Failed with error code %ERRORLEVEL%
)
