Surface any active advisories from the session health check.

Read the advisory cache file. The path is: `/tmp/claude-advisory-<hash>.txt` where `<hash>` is the first 8 characters of `echo "$CLAUDE_PROJECT_DIR" | shasum -a 256`.

Compute the hash by running: `echo "/Users/manu/Projects/pecking-order" | shasum -a 256 | cut -c1-8`

Then read the file at `/tmp/claude-advisory-<hash>.txt`.

The file format is:
- Line 1: advisory count (integer)
- Remaining lines: the advisory text (one advisory per line)

If the file doesn't exist or the count is 0, report "No active advisories."

If advisories exist, display each one clearly with a brief explanation of what action to take. Group them by type:
- **ACTION NEEDED** — something requires immediate attention
- **CLEANUP** — stale files or artifacts to remove
- **REVIEW** — guardrail rules or knowledge that may need promotion or updating

After displaying, ask if the user wants to address any of them now.
