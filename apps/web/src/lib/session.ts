import type { AuthUser, LoginResponse } from '@blackstation/shared';

const STORAGE_KEY = 'bs-token';

export type Session = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.token === 'string' &&
    typeof v.expiresAt === 'string' &&
    typeof v.user === 'object' &&
    v.user !== null
  );
}

/** Sesión admin vigente, o `null` si no hay o está vencida (en ese caso la borra). */
export function getSession(): Session | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    parsed = null;
  }
  if (!isSession(parsed)) return null;
  if (Date.parse(parsed.expiresAt) <= Date.now()) {
    clearSession();
    return null;
  }
  return parsed;
}

export function saveSession({ token, expiresAt, user }: LoginResponse): void {
  const session: Session = { token, expiresAt, user };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
