Create a real game for feature demos. Uses the same game creation flow as `/create-game` but appends `&showcase=true` to player URLs, which enables the admin panel overlay in the client.

The admin panel lets you inject timeline events (start dilemma, open voting, end day) on a real game with real machines — no separate showcase server needed.

## Usage

`/create-demo [preset] [overrides...]`

Same presets and overrides as `/create-game`. Default preset is `quick` (ADMIN mode, manual inject).

### Examples

```
/create-demo                              # 3 players, 2 days, ADMIN mode, local
/create-demo quick dilemma=SILVER_GAMBIT  # with specific dilemma type on day 1
/create-demo quick players=4 env=staging  # 4 players, staging, shareable links
/create-demo speedrun env=staging         # auto-advancing game on staging
```

## Parameters: $ARGUMENTS

## Execution

This command is a thin wrapper around `/create-game`. Run it exactly as `/create-game` would run, with one modification:

**When building the player URLs**, append `&showcase=true` to each URL. This enables the admin panel overlay in the client.

So the URL format becomes:
```
{CLIENT}/game/{INVITE_CODE}?_t={TOKEN}&shell={SHELL}&showcase=true
```

Everything else (presets, overrides, environments, script structure, persona pool, output format) is identical to `/create-game`.

### Additional output

After the standard `/create-game` output, add:

```
Admin panel enabled via ?showcase=true
Use the panel to inject timeline events: Start Dilemma, Open Voting, End Day, etc.
```

For the full script template and all details, refer to `.claude/commands/create-game.md`.
