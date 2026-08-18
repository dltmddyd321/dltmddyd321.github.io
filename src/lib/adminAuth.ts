/**
 * Shared client-side constants/helpers for the token-gated admin actions
 * (`/write`, and the edit/delete controls on post pages). Centralized so
 * `ALLOWED_USERS` has one source of truth instead of drifting between files.
 */

export const OWNER = 'dltmddyd321';
export const REPO = 'dltmddyd321.github.io';
export const BRANCH = 'main';
export const TOKEN_KEY = 'gh_pat';
export const API_ROOT = 'https://api.github.com';

/** GitHub accounts allowed to publish — the repo owner plus any invited collaborator. */
export const ALLOWED_USERS = ['dltmddyd321', 'LeeSeungYongg'];

export function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function validateToken(token: string): Promise<string> {
  const res = await fetch(`${API_ROOT}/user`, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(res.status === 401 ? 'invalid-token' : `http-${res.status}`);
  const data = (await res.json()) as { login: string };
  if (!ALLOWED_USERS.includes(data.login)) throw new Error('wrong-user');
  return data.login;
}
