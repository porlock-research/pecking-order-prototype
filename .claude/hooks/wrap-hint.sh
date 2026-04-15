#!/bin/bash
# UserPromptSubmit hook: scans the recent transcript for session-wrapping
# cues (in user OR assistant messages) and injects a gentle hint
# suggesting `/reflect` via hookSpecificOutput.additionalContext.
#
# Fires at most once per session via a marker file so it doesn't nag.

set -euo pipefail

input=$(cat)
transcript_path=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("transcript_path",""))' 2>/dev/null || echo "")
session_id=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null || echo "")
current_prompt=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("prompt",""))' 2>/dev/null || echo "")

if [[ -z "$transcript_path" || ! -f "$transcript_path" ]]; then
  exit 0
fi

marker_dir="${TMPDIR:-/tmp}/pecking-order-wrap-hint"
mkdir -p "$marker_dir"
marker="$marker_dir/$session_id"
if [[ -f "$marker" ]]; then
  exit 0
fi

hit=$(python3 <<PY
import json, re, sys
path = "$transcript_path"
current = """$current_prompt"""
phrases = [
    r"\bwrapping up\b",
    r"\bwrap up\b",
    r"\bcalling it\b",
    r"\bcall it a (day|night)\b",
    r"\bgood stopping point\b",
    r"\bstopping point\b",
    r"\bgoodnight\b",
    r"\bgood night\b",
    r"\beod\b",
    r"\bdone for (the day|today|tonight)\b",
    r"\bthat'?s a wrap\b",
    r"\bsigning off\b",
    r"\blet'?s wrap\b",
]
rx = re.compile("|".join(phrases), re.IGNORECASE)

if rx.search(current or ""):
    print("hit"); sys.exit(0)

try:
    lines = open(path, encoding="utf-8").read().splitlines()
except Exception:
    sys.exit(0)

for line in lines[-40:]:
    try:
        d = json.loads(line)
    except Exception:
        continue
    t = d.get("type")
    if t == "user":
        content = d.get("message", {}).get("content", "")
        text = content if isinstance(content, str) else json.dumps(content)
    elif t == "assistant":
        parts = []
        for item in d.get("message", {}).get("content", []) or []:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        text = " ".join(parts)
    else:
        continue
    if rx.search(text):
        print("hit"); sys.exit(0)
PY
)

if [[ "$hit" != "hit" ]]; then
  exit 0
fi

touch "$marker"

cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Session-wrap cue detected. If you're winding down, consider running /reflect to capture learnings, draft a handoff if a plan is mid-flight, check for new ADRs, and commit — then /exit. (This hint fires once per session.)"
  }
}
JSON
