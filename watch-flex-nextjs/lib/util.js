export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const clean = (v, n = 300) => String(v ?? '').trim().slice(0, n);
export const pkr = (n) => 'PKR ' + Math.round(n).toLocaleString('en-US');

/** Thrown for 401/403 style responses */
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Wraps a route handler: strings thrown become 400 errors, HttpError keeps its status, anything else is a 500. */
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return Response.json(await fn(req, ctx));
    } catch (e) {
      if (typeof e === 'string') return Response.json({ error: e }, { status: 400 });
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: 'Server error. Please try again.' }, { status: 500 });
    }
  };
}
export async function readBody(req) {
  try { return (await req.json()) || {}; } catch { return {}; }
}
