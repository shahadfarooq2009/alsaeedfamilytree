import type { AuthUser } from '../types/auth';

export const TREE_ADMIN_EMAIL = (
  import.meta.env.VITE_TREE_ADMIN_EMAIL ?? 'meshoosha88@gmail.com'
).trim().toLowerCase();

export function isTreeAdminUser(user?: AuthUser | null): boolean {
  if (!user?.email) return false;
  return user.email.trim().toLowerCase() === TREE_ADMIN_EMAIL;
}

export function canManageFamilyTree(user?: AuthUser | null): boolean {
  return isTreeAdminUser(user);
}
