const TOKEN_KEY = 'credo_admin_token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function adminLogin(email: string, passwort: string): Promise<{ name: string; email: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwort }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Anmeldung fehlgeschlagen' }));
    throw new Error(err.error);
  }

  const data = await res.json();
  setToken(data.token);
  return { name: data.name, email: data.email };
}

export async function adminLogout() {
  const token = getToken();
  if (token) {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearToken();
}

export async function checkSession(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  const res = await fetch('/api/admin/check', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    clearToken();
    return false;
  }
  return true;
}

export function adminFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
}
