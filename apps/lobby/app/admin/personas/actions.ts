'use server';

import { getDB, getEnv } from '@/lib/db';
import type { Persona } from '../../actions';

export interface PersonaWithImage extends Persona {
  headshotUrl: string;
}

function personaImageUrl(id: string, variant: 'headshot' | 'medium' | 'full'): string {
  return `/api/persona-image/${id}/${variant}.png`;
}

export async function listPersonas(theme?: string): Promise<PersonaWithImage[]> {
  const db = await getDB();

  const query = theme
    ? 'SELECT id, name, stereotype, description, theme FROM PersonaPool WHERE theme = ? ORDER BY id'
    : 'SELECT id, name, stereotype, description, theme FROM PersonaPool ORDER BY id';

  const stmt = theme ? db.prepare(query).bind(theme) : db.prepare(query);
  const { results } = await stmt.all<Persona>();

  return results.map((p) => ({
    ...p,
    headshotUrl: personaImageUrl(p.id, 'headshot'),
  }));
}

export async function createPersona(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const name = (formData.get('name') as string)?.trim();
  const stereotype = (formData.get('stereotype') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const theme = (formData.get('theme') as string)?.trim() || 'DEFAULT';

  if (!name || !stereotype || !description) {
    return { success: false, error: 'Name, stereotype, and description are required' };
  }

  const headshot = formData.get('headshot') as File | null;
  const medium = formData.get('medium') as File | null;
  const full = formData.get('full') as File | null;

  if (!headshot || !medium || !full) {
    return { success: false, error: 'All 3 image variants are required (headshot, medium, full)' };
  }

  const db = await getDB();
  const env = await getEnv();
  const bucket = env.PERSONA_BUCKET as any;

  if (!bucket) {
    return { success: false, error: 'R2 bucket not configured' };
  }

  // Generate next ID
  const last = await db
    .prepare("SELECT id FROM PersonaPool WHERE id LIKE 'persona-%' ORDER BY id DESC LIMIT 1")
    .first<{ id: string }>();

  let nextNum = 1;
  if (last) {
    const match = last.id.match(/persona-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const id = `persona-${String(nextNum).padStart(2, '0')}`;

  // Insert into D1
  await db
    .prepare(
      'INSERT INTO PersonaPool (id, name, stereotype, description, theme, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, name, stereotype, description, theme, Date.now())
    .run();

  // Upload images to R2
  const uploads: [string, File][] = [
    [`personas/${id}/headshot.png`, headshot],
    [`personas/${id}/medium.png`, medium],
    [`personas/${id}/full.png`, full],
  ];

  for (const [key, file] of uploads) {
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }

  return { success: true };
}

export async function deletePersona(id: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDB();
  const env = await getEnv();
  const bucket = env.PERSONA_BUCKET as any;

  // Check persona exists
  const persona = await db.prepare('SELECT id FROM PersonaPool WHERE id = ?').bind(id).first();
  if (!persona) {
    return { success: false, error: 'Persona not found' };
  }

  // Check not in active games
  const inUse = await db
    .prepare(
      `SELECT i.id FROM Invites i
       JOIN GameSessions gs ON gs.id = i.game_id
       WHERE i.persona_id = ? AND gs.status IN ('RECRUITING', 'READY', 'STARTED')`
    )
    .bind(id)
    .first();

  if (inUse) {
    return { success: false, error: 'Cannot delete — persona is in an active game' };
  }

  // Delete from D1
  await db.prepare('DELETE FROM PersonaPool WHERE id = ?').bind(id).run();

  // Delete images from R2
  if (bucket) {
    for (const variant of ['headshot.png', 'medium.png', 'full.png']) {
      try {
        await bucket.delete(`personas/${id}/${variant}`);
      } catch {
        // R2 delete is best-effort
      }
    }
  }

  return { success: true };
}
