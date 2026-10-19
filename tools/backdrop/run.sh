#!/bin/sh
# usage: tools/backdrop/run.sh SCRIPT OUTDIR [samples] [width] [variant] [chapter]  -- renders the layers and a composite preview (OUTDIR/comp.png)
BL="/c/Users/rober/Documents/Codex/2026-10-09/b/work/tools/blender-4.5.4/blender-4.5.4-windows-x64/blender.exe"
mkdir -p "$2"
OUT=$(cd "$2" && pwd)
"$BL" -b -P "$1" -- "$(cygpath -m "$OUT")" "${3:-64}" "${4:-960}" "${5:-hall}" "${6:-1}" 2>&1 | grep -E "rendered|Error|error|Traceback" 
/d/dev/ComfyUI_windows_portable/python_embeded/python.exe -I "$(dirname "$0")/composite.py" "$OUT" "$OUT/comp.png"
