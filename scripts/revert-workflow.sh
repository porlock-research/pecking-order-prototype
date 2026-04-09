#!/bin/bash
# Revert self-learning workflow changes
set -e

echo "=== Reverting self-learning workflow ==="

# Remove guardian hook infrastructure
rm -rf .claude/guardrails/
rm -f .claude/hooks/guardian.sh

# Remove per-app CLAUDE.md files (not root)
rm -f apps/game-server/CLAUDE.md
rm -f apps/client/CLAUDE.md
rm -f apps/lobby/CLAUDE.md
rm -f packages/game-cartridges/CLAUDE.md

# Remove per-app knowledge directories
rm -rf apps/game-server/.claude/
rm -rf apps/client/.claude/
rm -rf apps/lobby/.claude/
rm -rf packages/game-cartridges/.claude/

# Restore memory backup
BACKUP="$HOME/.claude/projects/-Users-manu-Projects-pecking-order/memory-backup-2026-04-08"
MEMORY="$HOME/.claude/projects/-Users-manu-Projects-pecking-order/memory"
if [ -d "$BACKUP" ]; then
  rm -rf "$MEMORY"
  cp -r "$BACKUP" "$MEMORY"
  echo "Memory restored from backup"
else
  echo "WARNING: No memory backup found at $BACKUP"
fi

# Restore screenshots
if [ -d "/tmp/pecking-order-screenshots-backup" ]; then
  cp /tmp/pecking-order-screenshots-backup/*.png . 2>/dev/null || true
  echo "Screenshots restored"
fi

echo ""
echo "Done. Git changes can be reverted via:"
echo "  git checkout main"
echo "  git branch -D feature/self-learning-workflow"
echo ""
echo "Manual step: Remove guardian.sh hook entry from .claude/settings.local.json"
