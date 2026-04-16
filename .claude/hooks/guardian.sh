#!/bin/bash
# Guardian Hook: advisory-only orchestrator that scans guardrail rules
# Fires on tool calls, matches rules, outputs advisories. Never blocks.
#
# Rule files live in .claude/guardrails/*.rule
# Format:
#   MATCH_TOOL: <regex matching tool name, e.g. Bash|Edit>
#   MATCH_PATTERN: <regex matching tool input (command or file path)>
#   MATCH_CONTENT: <optional regex matching proposed edit content — fires
#                   only when the new_string (Edit) / content (Write) body
#                   matches. Lets rules be content-aware, not path-only.>
#   ADVISORY: |
#     Advisory text shown to the agent
#     Can be multiline

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

GUARDRAILS_DIR="$CLAUDE_PROJECT_DIR/.claude/guardrails"

if [ ! -d "$GUARDRAILS_DIR" ]; then
  exit 0
fi

ADVISORIES=""

for rule in "$GUARDRAILS_DIR"/*.rule; do
  [ -f "$rule" ] || continue

  # Parse rule fields
  MATCH_TOOL=$(grep '^MATCH_TOOL:' "$rule" | sed 's/^MATCH_TOOL: *//')
  MATCH_PATTERN=$(grep '^MATCH_PATTERN:' "$rule" | sed 's/^MATCH_PATTERN: *//')
  MATCH_CONTENT=$(grep '^MATCH_CONTENT:' "$rule" | sed 's/^MATCH_CONTENT: *//')

  # Check tool name match (skip rule if tool doesn't match)
  if [ -n "$MATCH_TOOL" ]; then
    if ! echo "$TOOL_NAME" | grep -qE "$MATCH_TOOL"; then
      continue
    fi
  fi

  # Check pattern match against command, file path, or full input.
  # Suppress grep stderr so a malformed pattern in one rule doesn't pollute
  # every invocation; it just fails-closed (treated as no-match) for that rule.
  if [ -n "$MATCH_PATTERN" ]; then
    MATCHED=false
    if [ -n "$COMMAND" ] && echo "$COMMAND" | grep -qE "$MATCH_PATTERN" 2>/dev/null; then
      MATCHED=true
    elif [ -n "$FILE_PATH" ] && echo "$FILE_PATH" | grep -qE "$MATCH_PATTERN" 2>/dev/null; then
      MATCHED=true
    fi

    if [ "$MATCHED" = false ]; then
      continue
    fi
  fi

  # Optional: content-aware filter. Fires only when the proposed edit body
  # (new_string for Edit, content for Write) matches MATCH_CONTENT. Gives
  # rules a way to be precise about *what changed*, not just *where*.
  if [ -n "$MATCH_CONTENT" ]; then
    CONTENT=""
    case "$TOOL_NAME" in
      Edit) CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty' 2>/dev/null) ;;
      Write) CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty' 2>/dev/null) ;;
    esac
    if [ -z "$CONTENT" ] || ! echo "$CONTENT" | grep -qE "$MATCH_CONTENT" 2>/dev/null; then
      continue
    fi
  fi

  # Extract advisory text: everything from the "ADVISORY: |" line to EOF,
  # with the 2-space YAML block-scalar indent stripped. Reading to EOF (not
  # stopping at the first blank line) lets advisories contain empty lines
  # between paragraphs. Rule files have ADVISORY as the last field by
  # convention.
  ADVISORY=$(sed -n '/^ADVISORY:/,$ { /^ADVISORY:/d; s/^  //; p; }' "$rule")

  if [ -n "$ADVISORY" ]; then
    RULE_NAME=$(basename "$rule" .rule)
    ADVISORIES="${ADVISORIES}
--- [$RULE_NAME] ---
${ADVISORY}
"
  fi
done

if [ -n "$ADVISORIES" ]; then
  # Use additionalContext to inject advisory text into the model's context
  # permissionDecisionReason only shows in UI; additionalContext reaches the agent
  ESCAPED=$(echo "$ADVISORIES" | jq -Rs .)
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "additionalContext": $ESCAPED
  }
}
EOF
fi

exit 0
