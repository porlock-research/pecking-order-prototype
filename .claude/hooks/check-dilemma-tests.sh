#!/bin/bash
# PreToolUse hook: remind to run dilemma tests when committing dilemma cartridge changes
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
if ! echo "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Check if any dilemma cartridge files are staged
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if echo "$STAGED" | grep -qE 'cartridges/dilemmas/.*\.(ts|tsx)$'; then
  # Check if dilemma tests were run recently (within last 5 minutes)
  TEST_LOG="/tmp/pecking-order-dilemma-tests-last-run"
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
    "permissionDecisionReason": "Dilemma cartridge files are staged. Run dilemma unit tests first: npx vitest run apps/game-server/src/machines/cartridges/dilemmas/__tests__/dilemma-machine.test.ts"
  }
}
EOF
fi

exit 0
