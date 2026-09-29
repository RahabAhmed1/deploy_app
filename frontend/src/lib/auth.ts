export type CurrentUser = {
  id: string;
  username: string;
  role: 'admin' | 'staff' | string;
  staffCode?: string;
  permissions?: string[];
};

export function getCurrentUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u || null;
  } catch {
    return null;
  }
}

export function hasPermission(perm?: string | null): boolean {
  if (!perm) return true;
  const u = getCurrentUser();
  if (!u) return false;
  if (u.role === 'admin') return true;
  const list = Array.isArray(u.permissions) ? u.permissions : [];
  return list.includes(perm);
}

export function isAdmin(): boolean {
  const u = getCurrentUser();
  return !!u && u.role === 'admin';
}
