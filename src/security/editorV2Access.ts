export interface Editor2AccessUser {
  username?: string | null;
}

const ALLOWED_EDITOR2_EMAIL = 'elamlagos3@gmail.com';

export function canSeeEditor2Card(user: Editor2AccessUser | null | undefined): boolean {
  if (typeof user?.username !== 'string') return false;
  return user.username.trim().toLowerCase() === ALLOWED_EDITOR2_EMAIL;
}
