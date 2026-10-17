#!/bin/sh
# usage: tools/backdrop/run.sh SCRIPT OUTDIR [samples] [width] [variant]  -- renders the layers and a composite preview (OUTDIR/comp.png)
BL="/c/Users/rober/Documents/Codex/2026-10-09/b/work/tools/blender-4.5.4/blender-4.5.4-windows-x64/blender.exe"
OUT=$(cd "$(dirname "$2")" 2>/dev/null && pwd)/$(basename "$2")
mkdir -p "$OUT"
"$BL" -b -P "$1" -- "$(cygpath -m "$OUT")" "${3:-64}" "${4:-960}" "${5:-hall}" 2>&1 | grep -E "rendered|Error|error|Traceback" 
/d/dev/ComfyUI_windows_portable/python_embeded/python.exe -I "$(dirname "$0")/composite.py" "$OUT" "$OUT/comp.png"
