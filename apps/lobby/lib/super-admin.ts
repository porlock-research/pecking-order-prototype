'use server';

import { getSession } from './auth';
import { getEnv } from './db';

/**
 * Check if the current session user is a super admin.
 * Reads the SUPER_ADMIN_IDS environment variable (comma-separated user IDs).
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const env = await getEnv();
  const raw = (env.SUPER_ADMIN_IDS as string) || '';
  if (!raw) return false;

  const allowedIds = raw.split(',').map((id) => id.trim()).filter(Boolean);
  return allowedIds.includes(session.userId);
}

/**
 * Require the current session user to be a super admin.
 * Throws an error if not authorized.
 */
export async function requireSuperAdmin(): Promise<void> {
  const allowed = await isSuperAdmin();
  if (!allowed) {
    throw new Error('Forbidden: super admin access required');
  }
}
