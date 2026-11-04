import { randomUUID } from 'node:crypto';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const serverKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
export const storageConfigured = () => !!(process.env.SUPABASE_URL && serverKey());

function storageHeaders(extra = {}) {
  const key = serverKey();
  return { apikey: key, ...(key?.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), ...extra };
}

export async function deleteProductImageByUrl(url) {
  if (!storageConfigured() || !url) return false;
  const base = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(base)) return false;
  const objectPath = decodeURIComponent(url.slice(base.length));
  if (!objectPath || objectPath.includes('..')) return false;
  const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE', headers: storageHeaders(),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Image deletion failed (${response.status}).`);
  return true;
}

export async function uploadProductImage({ productId, file, bytes, contentType, extension }) {
  if (!storageConfigured()) throw new Error('Supabase Storage is not configured.');
  const safeId = String(productId).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 70) || 'product';
  const objectPath = `${safeId}/${randomUUID()}.${extension}`;
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: storageHeaders({ 'Content-Type': contentType, 'x-upsert': 'false' }),
    body: bytes,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Image upload failed (${response.status}): ${detail.slice(0, 250)}`);
  }
  return { path: objectPath, url: `${base}/storage/v1/object/public/${BUCKET}/${objectPath}` };
}

export async function verifyStorageConnection() {
  if (!storageConfigured()) throw new Error('Supabase Storage credentials are missing.');
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const response = await fetch(`${base}/storage/v1/bucket/${BUCKET}`, { headers: storageHeaders() });
  if (!response.ok) throw new Error(response.status === 404 ? `Storage bucket '${BUCKET}' does not exist.` : `Storage check failed (${response.status}).`);
  return true;
}
