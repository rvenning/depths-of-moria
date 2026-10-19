#!/bin/sh
# Render and pack every chapter's hall and boss arena (public/backdrops).  usage: tools/backdrop/all.sh [samples] [chapters...]
S="${1:-160}"; shift
CHS="${*:-1 2 3 4 5 6 7 8 9 10}"
cd "$(dirname "$0")/../.."
for c in $CHS; do
  for v in hall arena; do
    tools/backdrop/run.sh tools/backdrop/hall.py ".scratch/final/c$c-$v" "$S" 960 "$v" "$c" | grep -i -E "error|Traceback"
    /d/dev/ComfyUI_windows_portable/python_embeded/python.exe -I tools/backdrop/pack.py ".scratch/final/c$c-$v" "$c" "$v"
  done
done
