import { handler, clean } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { storageConfigured, uploadProductImage, deleteProductImageByUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const MAX_BYTES = 4 * 1024 * 1024;
function detectedImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ['image/jpeg','jpg'];
  if (bytes.length >= 8 && bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a') return ['image/png','png'];
  if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return ['image/webp','webp'];
  if (bytes.length >= 12 && bytes.toString('ascii',4,8) === 'ftyp' && /^(avif|avis)$/.test(bytes.toString('ascii',8,12))) return ['image/avif','avif'];
  return null;
}
export const POST = handler(async (req) => {
  requireAdmin(req);
  if (!storageConfigured()) throw 'Supabase Storage is not configured.';
  const form = await req.formData();
  const file = form.get('file');
  const productId = clean(form.get('productId'), 80);
  if (!file || typeof file.arrayBuffer !== 'function' || !productId) throw 'Choose a product and an image file.';
  if (file.size <= 0 || file.size > MAX_BYTES) throw 'Image must be 4 MB or smaller.';
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectedImage(bytes);
  if (!detected || detected[0] !== file.type) throw 'Only valid JPG, PNG, WebP and AVIF images are allowed.';
  return uploadProductImage({ productId, file, bytes, contentType: detected[0], extension: detected[1] });
});
export const DELETE = handler(async (req) => {
  requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  const url = clean(body.url, 2000);
  const deleted = await deleteProductImageByUrl(url);
  if (!deleted) throw 'Only images stored in this store’s Supabase bucket can be deleted here.';
  return { ok: true };
});
