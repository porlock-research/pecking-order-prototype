---
name: add-personas
description: Use when adding new personas to the game from roster files on disk. Triggers on "add personas", "import personas", "upload personas", "new characters", or when user points at a directory containing roster.json and persona images.
---

# Add Personas

Import new persona characters from a local directory into the game's D1 database and R2 image storage.

## Expected Directory Structure

```
<dir>/
  roster.json              # [{id, name, stereotype, description, stats?, visualPrompt?}]
  images/
    {id}_{First}_{Last}/   # e.g. 1_Felix_Stage/
      headshot.png          # 1024x1024
      medium.png            # 864x1184
      full_body.png         # 768x1344
```

## Workflow

### 1. Read and Dedup

- Read the roster.json from each provided directory
- Query existing personas: `SELECT id, name, stereotype FROM PersonaPool ORDER BY id`
- Cross-reference ALL new personas against existing ones AND against each other by stereotype
- Flag duplicates (same or very similar archetype) for user review
- Present a table of candidates with keep/skip recommendation

### 2. Assign IDs

- Find the highest existing persona ID: `SELECT id FROM PersonaPool WHERE id LIKE 'persona-%' ORDER BY id DESC LIMIT 1`
- New personas get sequential IDs starting from next available (e.g., persona-51, persona-52...)
- Map each roster entry's local ID to its new persona-NN ID

### 3. Generate Migration SQL

- Create migration file: `apps/lobby/migrations/NNNN_add_personas_XX_YY.sql`
- INSERT statements with: id, name, stereotype, description, theme='DEFAULT', created_at=now
- Escape single quotes in SQL strings (double them: `''`)

### 4. Upload Images to R2

Use the import script which accepts `--dir`, `--start-id`, and `--remote`:

```bash
cd apps/lobby

# If importing from multiple directories, create a filtered roster for subset imports:
# 1. Copy desired image folders into a temp dir, renumber as 1_Name, 2_Name...
# 2. Create a roster.json with matching sequential IDs
# 3. Use --start-id to offset to the correct persona-NN range

# Staging
npx tsx scripts/import-personas.ts --dir <path> --start-id <N> --remote staging

# Production
npx tsx scripts/import-personas.ts --dir <path> --start-id <N> --remote production
```

The script maps `full_body.png` -> `full.png` in R2 automatically.

### 5. Run D1 Migrations

```bash
cd apps/lobby

# Staging
npx wrangler d1 migrations apply pecking-order-journal-db-staging --remote --env staging

# Production
npx wrangler d1 migrations apply pecking-order-journal-db --remote --env production
```

### 6. Generate Q&A Content

Edit `apps/lobby/app/join/[code]/questions-pool.ts`:

- Add `personaAnswers` overrides to 3-5 existing generic questions per new persona
- Answers should be in-character, snarky, short (<60 chars)
- Add 1 persona-specific question (with `forPersonaId`) for the most distinctive personas
- Not every persona needs a dedicated question -- only those with a strong unique "hook"

### 7. Verify

- Check persona count: visit `/admin/personas` or query `SELECT COUNT(*) FROM PersonaPool`
- Spot-check images: `https://staging-lobby.peckingorder.ca/api/persona-image/persona-NN/headshot.png`
- Run `npm run build` in `apps/lobby` to verify questions-pool.ts compiles

## Key Constraints

- Pool must be >= 3x max players per game (currently 8 players, so >= 24 per theme)
- Each persona needs exactly 3 image variants in R2
- Persona IDs are `persona-NN` format, zero-padded to 2 digits
- All personas use theme `DEFAULT` unless explicitly creating a new theme
- The admin UI at `/admin/personas` can also create personas one at a time via form upload
