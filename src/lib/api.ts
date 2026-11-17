const TOKEN_KEY = 'assetin_session_token';

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['x-session-token'] = token;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const errBody = (await res.json()) as { error?: string };
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }
    throw new Error(`Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}
