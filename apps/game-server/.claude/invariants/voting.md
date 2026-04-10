# Voting Invariants

These rules come from playtesting. Violating them causes game-breaking bugs.

## Every vote must eliminate

- Every voting mechanism MUST eliminate exactly one player
- `eliminatedId` must NEVER be null
- If no one votes → eliminate player with lowest silver
- If tied → eliminate player with lowest silver among tied
- Only exception: FINALS picks a winner instead of eliminating

## Results must be immediate

- Show voting results as soon as the phase closes
- Never delay results to night summary
- This is an async game — players check in hours apart and shouldn't wait

## Result summaries must be complete

- Vote tallies per player
- Who voted for whom
- Elimination outcome
- Each mechanism stores tallies under different keys — see `CompletedSummary.tsx`
