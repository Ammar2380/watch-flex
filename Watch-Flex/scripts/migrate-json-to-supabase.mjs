import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Load local environment files for a one-command Windows/macOS/Linux migration. Shell env wins.
for (const envName of ['.env.local', '.env']) {
  const envPath = path.join(root, envName);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
const file = path.resolve(process.env.DATA_FILE || path.join(root, 'data.json'));
const seedFile = path.join(root, 'data', 'seed-products.json');
const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const authHeaders = key?.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {};
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) before running the migration.');

const force = process.argv.includes('--force');
async function targetHasRows(table, column) {
  const response = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=1`, {
    headers: { apikey: key, ...authHeaders },
  });
  if (!response.ok) throw new Error(`Preflight check for ${table} failed: ${response.status} ${await response.text()}`);
  return (await response.json()).length > 0;
}
const occupied = [];
for (const [table, column] of [['products','id'], ['orders','ref'], ['customers','email']]) {
  if (await targetHasRows(table, column)) occupied.push(table);
}
if (occupied.length && !force) {
  throw new Error(`Refusing to import over non-empty Supabase tables: ${occupied.join(', ')}. Back up the target first, then rerun with --force only if merging/upserting these records is intentional.`);
}
if (occupied.length) console.warn(`WARNING: --force supplied. Existing rows in ${occupied.join(', ')} may be updated by this import.`);

let data;
if (fs.existsSync(file)) {
  const backup = `${file}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, backup);
  console.log(`Created source backup: ${backup}`);
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} else {
  data = { products: JSON.parse(fs.readFileSync(seedFile, 'utf8')), orders: [], promos: [] };
  console.log('No legacy data.json found; importing only data/seed-products.json.');
}

const publicDir = path.join(root, 'public');
function detectImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ['image/jpeg','jpg'];
  if (bytes.length >= 8 && bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a') return ['image/png','png'];
  if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return ['image/webp','webp'];
  if (bytes.length >= 12 && bytes.toString('ascii',4,8) === 'ftyp' && /^(avif|avis)$/.test(bytes.toString('ascii',8,12))) return ['image/avif','avif'];
  return null;
}
async function storeImage(product, bytes, detected) {
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new Error(`An image for '${product.name}' must be non-empty and no larger than 4 MB.`);
  if (!detected) throw new Error(`An image for '${product.name}' is not a supported JPEG, PNG, WebP or AVIF file.`);
  const safeId = String(product.id).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 70) || 'product';
  const objectPath = `migrated/${safeId}/${crypto.randomUUID()}.${detected[1]}`;
  const uploaded = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST', headers: { apikey: key, ...authHeaders, 'Content-Type': detected[0], 'x-upsert': 'false' }, body: bytes,
  });
  if (!uploaded.ok) throw new Error(`Image upload failed for '${product.name}': ${uploaded.status} ${await uploaded.text()}`);
  return `${url}/storage/v1/object/public/${bucket}/${objectPath}`;
}
async function migrateImages(product) {
  const images = [];
  for (const image of (product.images || []).filter(Boolean)) {
    const source = String(image);
    let bytes;
    if (/^https:\/\//i.test(source)) {
      const downloaded = await fetch(source);
      if (!downloaded.ok) throw new Error(`Could not download image '${source}' for '${product.name}' (${downloaded.status}). Re-upload it from Admin after setup.`);
      bytes = Buffer.from(await downloaded.arrayBuffer());
    } else {
      if (/^http:\/\//i.test(source)) throw new Error(`Product '${product.name}' has an insecure http image URL. Replace it with https before migration.`);
      const relative = source.replace(/^\/?public\//, '').replace(/^\/+/, '');
      const localPath = path.resolve(publicDir, relative);
      if (!localPath.startsWith(publicDir + path.sep) || !fs.existsSync(localPath)) {
        throw new Error(`Local image '${source}' for product '${product.name}' is not present under public/. Copy it into public/ or re-upload it from Admin after setup.`);
      }
      bytes = fs.readFileSync(localPath);
    }
    const detected = detectImage(bytes);
    images.push(await storeImage(product, bytes, detected));
    console.log(`Stored permanent image for ${product.name}.`);
  }
  return images;
}

async function request(table, rows, conflict) {
  if (!rows?.length) return;
  const response = await fetch(`${url}/rest/v1/${table}${conflict ? `?on_conflict=${conflict}` : ''}`, {
    method: 'POST',
    headers: { apikey: key, ...authHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  console.log(`Imported ${rows.length} ${table}.`);
}

const products = await Promise.all((data.products || []).map(async (p, i) => ({
  id: String(p.id), name: String(p.name), brand: p.brand || '', model: p.model || '',
  price: Math.round(Number(p.price)), images: await migrateImages(p), category: p.category || 'Watches',
  specs: p.specs || [], stock: ['in','out','unknown'].includes(p.stock) ? p.stock : 'unknown',
  stock_quantity: Number.isInteger(p.stockQuantity) ? p.stockQuantity : null,
  featured: !!p.featured, is_new: !!(p.isNew ?? p.is_new), sort_order: i,
})));
const promos = (data.promos || [{ code: 'WELCOME10', type: 'percent', value: 10, min: 0, max: 0, used: 0, active: true }]).map((p) => ({
  code: String(p.code).toUpperCase(), type: p.type === 'fixed' ? 'fixed' : 'percent', value: Math.round(Number(p.value)),
  min_amount: Math.round(Number(p.min || 0)), max_uses: Math.round(Number(p.max || 0)),
  used_count: Math.round(Number(p.used || 0)), active: p.active !== false,
}));
const orders = (data.orders || []).map((o) => ({
  ref: String(o.ref), date: o.date || new Date().toISOString(), status: ['pending','confirmed','shipped','delivered','cancelled'].includes(o.status) ? o.status : 'pending',
  customer: o.customer || {}, items: o.items || [], subtotal: Math.round(Number(o.subtotal ?? (o.items || []).reduce((s,i)=>s+Number(i.price)*Number(i.qty),0))),
  discount: Math.round(Number(o.discount || 0)), promo: o.promo || '', delivery_fee: Math.round(Number(o.deliveryFee || 0)),
  total: Math.round(Number(o.total || 0)), payment: o.payment || 'Cash on delivery',
  payment_status: ['pending','paid','failed','refunded'].includes(o.paymentStatus || o.payment_status) ? (o.paymentStatus || o.payment_status) : 'pending', shipping: o.shipping || {},
}));

await request('products', products, 'id');
await request('promos', promos, 'code');
await request('orders', orders, 'ref');
await request('site_settings', [{ key: 'delivery_fee', value: Number(data.settings?.delivery_fee || 0) }], 'key');
console.log('Migration finished. Original JSON remains in place; verify records in Supabase before switching production traffic.');
console.log(`Migration run ID: ${crypto.randomUUID()}`);
