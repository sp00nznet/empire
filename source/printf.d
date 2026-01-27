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


/* This file implements printf for GUI apps that sends the output
 * to logfile rather than stdout.
 * The file is closed after each printf, so that it is complete even
 * if the program subsequently crashes.
 */

import core.stdc.stdio;
import core.stdc.stdlib;
import core.stdc.string;
import core.stdc.stdarg;
import std.file;

const int LOG = 1;      // disable logging by setting this to 0

version (Windows)
{
    string logfile = r"\empire.log";
}
version (linux)
{
    string logfile = "/var/log/empire.log";
}

/*********************************************
 * Route printf() to a log file rather than stdio.
 */

enum Plog
{
    TOBITBUCKET,
    TOLOGFILE,
    TOSTDOUT,
}

Plog printf_logging = Plog.TOLOGFILE;

void printf_tologfile()
{
    printf_logging = Plog.TOLOGFILE;
}

void printf_tostdout()
{
    printf_logging = Plog.TOSTDOUT;
}

void printf_tobitbucket()
{
    printf_logging = Plog.TOBITBUCKET;
}

void LogfileAppend(const char* buffer)
{
    if (printf_logging == Plog.TOLOGFILE)
        std.file.append(logfile, buffer[0 .. strlen(buffer)]);
    else
    {
        fputs(buffer, stdout);
        fflush(stdout);
    }
}

extern (C)
{

int VPRINTF(const char* format, va_list args)
{
    if (printf_logging != Plog.TOBITBUCKET)
    {
        char[128] buffer;
        char* p;
        uint psize;
        int count;

        p = buffer.ptr;
        psize = cast(uint)buffer.length;

        version (Windows)
        {
            count = _vsnprintf(p, psize, format, args);
            if (count == -1 || count >= cast(int)psize)
            {
                // Buffer too small - for simplicity, just truncate
                buffer[psize - 1] = 0;
            }
        }
        else
        {
            count = vsnprintf(p, psize, format, args);
        }

        LogfileAppend(p);
    }
    return 0;
}

int PRINTF(const char* format, ...)
{
    int result = 0;

    if (printf_logging != Plog.TOBITBUCKET)
    {
        va_list ap;
        va_start(ap, format);
        result = VPRINTF(format, ap);
        va_end(ap);
    }
    return result;
}

}

void _printf_assert(const char* file, uint line)
{
    PRINTF("assert fail: %s(%d)\n", file, line);
    *cast(char *)null = 0; // seg fault to ensure it isn't overlooked
    exit(0);
}
