export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function readJson(request) {
  try {
    const body = await request.json();
    if (body && typeof body === 'object') return body;
  } catch {}
  throw new HttpError(400, 'Invalid request body');
}

/** Trimmed string field, or a 400 naming the field. */
export function str(body, key, { min = 1, max = 200, optional = false } = {}) {
  const v = typeof body[key] === 'string' ? body[key].trim() : '';
  if (!v && optional) return '';
  if (v.length < min || v.length > max) {
    throw new HttpError(400, min > 1 ? `${key} must be ${min}-${max} characters` : `${key} is required`);
  }
  return v;
}

/** Positive rand amount from the body, returned in cents. */
export function rands(body, key, { max = 1_000_000 } = {}) {
  const n = Number(body[key]);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new HttpError(400, `${key} must be a positive amount`);
  return Math.round(n * 100);
}

export const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
export const now = () => Date.now();
export const zar = (cents) => (cents == null ? null : cents / 100);
export const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

export async function limited(limiter, request) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (limiter && !(await limiter.limit({ key: ip })).success) {
    throw new HttpError(429, 'Too many requests, try again in a minute');
  }
}
