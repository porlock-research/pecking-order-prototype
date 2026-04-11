#!/bin/bash
# SessionStart hook: health check on guardrails, artifacts, and knowledge freshness
# Outputs a summary via additionalContext so the agent sees it at session start

GUARDRAILS_DIR="$CLAUDE_PROJECT_DIR/.claude/guardrails"
REPORT=""

# 1. Count guardrail rules
RULE_COUNT=$(ls "$GUARDRAILS_DIR"/*.rule 2>/dev/null | wc -l | tr -d ' ')
REPORT="GUARDRAILS: $RULE_COUNT rules active"

# 2. Check for skill-update-needed.md (Stop hook flagged a skill improvement)
if [ -f "$GUARDRAILS_DIR/skill-update-needed.md" ]; then
  REPORT="$REPORT
ACTION NEEDED: skill-update-needed.md exists — a previous session flagged a skill that needs updating. Read .claude/guardrails/skill-update-needed.md and address it."
fi

# 3. Check for untracked artifacts at project root
STALE_PNGS=$(ls "$CLAUDE_PROJECT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
if [ "$STALE_PNGS" -gt 0 ]; then
  REPORT="$REPORT
CLEANUP: $STALE_PNGS stale .png files at project root — delete them."
fi

# 4. Check for test artifact directories that shouldn't exist
STALE_DIRS=""
for d in "$CLAUDE_PROJECT_DIR"/apps/*/test-results "$CLAUDE_PROJECT_DIR"/apps/*/e2e/test-results "$CLAUDE_PROJECT_DIR"/apps/*/e2e/playwright-report; do
  [ -d "$d" ] && STALE_DIRS="$STALE_DIRS $d"
done
if [ -n "$STALE_DIRS" ]; then
  REPORT="$REPORT
CLEANUP: Stale test artifact directories found:$STALE_DIRS"
fi

# 5. Check for rules that might be ready for promotion (more than 3 rules with same prefix)
for prefix in broad finite; do
  COUNT=$(ls "$GUARDRAILS_DIR"/${prefix}-*.rule 2>/dev/null | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 5 ]; then
    REPORT="$REPORT
REVIEW: $COUNT $prefix-* rules — consider promoting related rules into skills or workflows."
  fi
done

# Collect advisories (lines after the first "GUARDRAILS: N rules active" line)
ADVISORIES=""
ADVISORY_COUNT=0
while IFS= read -r line; do
  case "$line" in
    GUARDRAILS:*) ;; # skip the count line — it's info, not an advisory
    "") ;;           # skip empty lines
    *)
      ADVISORIES="${ADVISORIES}${line}
"
      ADVISORY_COUNT=$((ADVISORY_COUNT + 1))
      ;;
  esac
done <<< "$REPORT"

# Write advisory cache for statusline and /advisories command
ADVISORY_FILE="/tmp/claude-advisory-$(echo "$CLAUDE_PROJECT_DIR" | shasum -a 256 | cut -c1-8).txt"
if [ "$ADVISORY_COUNT" -gt 0 ]; then
  printf "%s\n%s" "$ADVISORY_COUNT" "$ADVISORIES" > "$ADVISORY_FILE"
else
  rm -f "$ADVISORY_FILE"
fi

# Output as additionalContext (agent sees full report including guardrail count)
if [ -n "$REPORT" ]; then
  ESCAPED=$(echo "$REPORT" | jq -Rs .)
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $ESCAPED
  }
}
EOF
fi

exit 0
