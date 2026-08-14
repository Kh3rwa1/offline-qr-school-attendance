export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };

  // Attach CSRF token on state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCookie('XSRF-TOKEN') || getCookie('csrfToken');
    if (csrfToken && !headers['x-csrf-token'] && !headers['X-CSRF-Token']) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      ...init,
      headers,
    });
  } catch {
    throw new ApiError('NETWORK_UNAVAILABLE', 0, 'NETWORK_UNAVAILABLE');
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = body.message || body.error || `REQUEST_FAILED_${response.status}`;
    const errorCode = body.error || `HTTP_${response.status}`;
    throw new ApiError(errorMsg, response.status, errorCode);
  }

  return body;
}
