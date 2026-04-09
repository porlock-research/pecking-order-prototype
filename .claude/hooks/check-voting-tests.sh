#!/bin/bash
# PreToolUse hook: remind to run voting tests when committing voting cartridge changes
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Check if any voting cartridge files are staged
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if echo "$STAGED" | grep -qE 'cartridges/voting/.*\.(ts|tsx)$'; then
  # Check if voting tests were run recently (within last 5 minutes)
  TEST_LOG="/tmp/pecking-order-voting-tests-last-run"
  if [ -f "$TEST_LOG" ]; then
    LAST_RUN=$(cat "$TEST_LOG")
    NOW=$(date +%s)
    DIFF=$((NOW - LAST_RUN))
    if [ "$DIFF" -lt 300 ]; then
      exit 0  # Tests were run recently, allow commit
    fi
  fi

  cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "Voting cartridge files are staged. Run voting unit tests first: npx vitest run apps/game-server/src/machines/cartridges/voting/__tests__/voting-machines.test.ts"
  }
}
EOF
fi

exit 0
