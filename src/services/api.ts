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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
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
