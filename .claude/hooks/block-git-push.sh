#!/bin/bash
# PreToolUse hook: require explicit user approval for git push/merge to main
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE 'git (push|merge)'; then
  cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "Git push/merge requires explicit user approval."
  }
}
EOF
fi

exit 0
