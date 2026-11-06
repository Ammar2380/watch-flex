import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
const SEED = path.join(process.cwd(), 'data', 'seed-products.json');
const G = globalThis;
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const serverKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
export const hasSupabase = !!(process.env.SUPABASE_URL && serverKey());

function assertBackend() {
  if (hasSupabase) return;
  if (isProduction) throw new Error('Supabase is required in production. Configure SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy service-role key).');
}

function supabaseUrl(pathname) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('SUPABASE_URL is not configured.');
  return `${base}/rest/v1/${pathname}`;
}

async function sb(pathname, options = {}) {
  if (!hasSupabase) throw new Error('Supabase is not configured.');
  const key = serverKey();
  const auth = key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {};
  const response = await fetch(supabaseUrl(pathname), {
    ...options,
    cache: 'no-store',
    headers: {
      apikey: key,
      ...auth,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.text();
  let data = null;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }
  if (!response.ok) {
    const message = data?.message || data?.error || data?.hint || `Supabase request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function rpc(name, args) {
  return sb(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
}

/** Fetches full table result sets across PostgREST's configured per-request row cap. */
async function sbAll(pathname, pageSize = 1000) {
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await sb(pathname, { headers: { Range: `${offset}-${offset + pageSize - 1}`, 'Range-Unit': 'items' } });
    if (!Array.isArray(page)) throw new Error('Unexpected database response while reading a paginated table.');
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

function readLocal() {
  if (G.__wfDb) return G.__wfDb;
  let db;
  if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  else {
    const products = fs.existsSync(SEED) ? JSON.parse(fs.readFileSync(SEED, 'utf8')) : [];
    db = { products, orders: [], promos: [{ code: 'WELCOME10', type: 'percent', value: 10, min: 0, max: 0, used: 0, active: true }], settings: { delivery_fee: 0 } };
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 1));
  }
  db.settings ||= { delivery_fee: 0 };
  G.__wfDb = db;
  return db;
}

/**
 * Normalizes both the current Watch Flex product columns and the earlier
 * public.products(id, data) JSONB shape. Keeping this compatibility layer
 * means the original product rows can be upgraded in place without losing data.
 */
function productFromRow(row) {
  const data = row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
  const { data: _data, is_new, stock_quantity, ...columns } = row || {};
  const product = { ...data, ...columns };
  product.id = columns.id || data.id || '';
  product.name = columns.name ?? data.name ?? '';
  product.brand = columns.brand ?? data.brand ?? '';
  product.model = columns.model ?? data.model ?? '';
  product.price = columns.price ?? data.price ?? 0;
  const legacyImages = Array.isArray(data.images) ? data.images : (data.image ? [data.image] : []);
  product.images = Array.isArray(columns.images) && columns.images.length ? columns.images : legacyImages;
  product.category = columns.category ?? data.category ?? 'Watches';
  product.specs = Array.isArray(columns.specs) ? columns.specs : Array.isArray(data.specs) ? data.specs : (typeof data.specs === 'string' ? data.specs.split(',').map((x) => x.trim()).filter(Boolean) : []);
  product.stock = columns.stock ?? data.stock ?? 'unknown';
  product.stockQuantity = stock_quantity ?? data.stockQuantity ?? data.stock_quantity ?? null;
  product.featured = columns.featured ?? data.featured ?? false;
  product.isNew = is_new ?? data.isNew ?? data.is_new ?? false;
  return product;
}

async function readProductRows() {
  try {
    return await sbAll('products?select=*&order=sort_order.asc,created_at.asc');
  } catch (error) {
    // Before the compatibility migration is applied, existing projects may
    // still expose only id + data (+ created_at). Read those rows for the shop
    // while the owner applies the supplied additive SQL migration.
    const message = String(error?.message || '');
    if (!/sort_order|column .* does not exist|schema cache|PGRST204/i.test(message)) throw error;
    return sbAll('products?select=id,data,created_at&order=created_at.asc');
  }
}

/** Storefront-only product read: never loads order or customer PII. */
export async function getProducts() {
  assertBackend();
  if (!hasSupabase) return readLocal().products;
  return (await readProductRows()).map(productFromRow);
}

/** Reads private business data for the authenticated admin API only. */

/** Reads private business data for the authenticated admin API only. */
export async function getDb() {
  assertBackend();

  if (!hasSupabase) return readLocal();

  const [products, orders, promos, settings] = await Promise.all([
    readProductRows(),
    sbAll('orders?select=*&order=created_at.desc'),
    sbAll('promos?select=*&order=code.asc'),
    sb('site_settings?select=key,value'),
  ]);

  return {
    products: products.map(productFromRow),

    orders: orders.map((o) => ({
      ...o,
      date: o.created_at,
      shipping: o.shipping || {},
    })),

    promos: promos.map((p) => ({
      code: p.code,
      type: p.type,
      value: p.value,
      min: p.min_amount,
      max: p.max_uses,
      used: p.used_count,
      active: p.active,
    })),

    settings: Object.fromEntries(
      settings.map((x) => [x.key, x.value])
    ),
  };
}

/** Kept solely for the local development JSON fallback. */
export function saveDb() {
  assertBackend();
  if (hasSupabase) throw new Error('saveDb is disabled for Supabase; use a specific database operation.');
  fs.writeFileSync(FILE, JSON.stringify(readLocal(), null, 1));
}

export async function saveProduct(product) {
  assertBackend();
  if (!hasSupabase) {
    const db = readLocal();
    const index = db.products.findIndex((p) => p.id === product.id);
    if (index < 0) db.products.push(product); else db.products[index] = product;
    saveDb();
    return product;
  }
  const row = {
    id: product.id, name: product.name, brand: product.brand, model: product.model,
    price: product.price, images: product.images, category: product.category,
    specs: product.specs, stock: product.stock, stock_quantity: product.stockQuantity ?? null,
    featured: product.featured, is_new: product.isNew,
  };
  const result = await sb('products?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) });
  if (!Array.isArray(result) || !result[0]) throw new Error('Supabase did not return the saved product.');
  return productFromRow(result[0]);
}

export async function deleteProduct(id) {
  assertBackend();
  if (!hasSupabase) {
    const db = readLocal();
    db.products = db.products.filter((p) => p.id !== id);
    saveDb();
    return;
  }
  await sb(`products?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function savePromo(promo) {
  assertBackend();
  if (!hasSupabase) {
    const db = readLocal();
    const old = db.promos.find((p) => p.code === promo.code);
    if (old) Object.assign(old, promo); else db.promos.push(promo);
    saveDb();
    return promo;
  }
  const row = { code: promo.code, type: promo.type, value: promo.value, min_amount: promo.min, max_uses: promo.max, used_count: promo.used, active: promo.active };
  const result = await sb('promos?on_conflict=code', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row) });
  const p = result[0];
  return { code: p.code, type: p.type, value: p.value, min: p.min_amount, max: p.max_uses, used: p.used_count, active: p.active };
}

export async function deletePromo(code) {
  assertBackend();
  if (!hasSupabase) {
    const db = readLocal();
    db.promos = db.promos.filter((p) => p.code !== code);
    saveDb();
    return;
  }
  await sb(`promos?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE' });
}

const cleanMarqueeItems = (value) => {
  let items = value;

  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }

  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 12);
};

const settingEnabled = (value) =>
  value === true || value === 'true' || value === '1' || value === 1;

const cleanMarqueeSpeed = (value) =>
  ['slow', 'normal', 'fast'].includes(value) ? value : 'normal';

export async function getStoreSettings() {
  assertBackend();

  let saved = {};

  if (!hasSupabase) {
    saved = readLocal().settings || {};
  } else {
    const rows = await sb('site_settings?select=key,value');
    saved = Object.fromEntries(
      rows.map((row) => [row.key, row.value])
    );
  }

  return {
    delivery_fee: Math.max(0, Number(saved.delivery_fee) || 0),

    marquee_enabled:
      saved.marquee_enabled == null
        ? true
        : settingEnabled(saved.marquee_enabled),

    marquee_items: cleanMarqueeItems(saved.marquee_items),

    marquee_speed: cleanMarqueeSpeed(saved.marquee_speed),
  };
}

export async function saveStoreSettings(settings = {}) {
  assertBackend();

  const cleanSettings = {};

  if (Object.prototype.hasOwnProperty.call(settings, 'delivery_fee')) {
    cleanSettings.delivery_fee = Math.max(
      0,
      Math.round(Number(settings.delivery_fee) || 0)
    );
  }

  if (Object.prototype.hasOwnProperty.call(settings, 'marquee_enabled')) {
    cleanSettings.marquee_enabled = settingEnabled(settings.marquee_enabled);
  }

  if (Object.prototype.hasOwnProperty.call(settings, 'marquee_items')) {
    cleanSettings.marquee_items = cleanMarqueeItems(settings.marquee_items);
  }

  if (Object.prototype.hasOwnProperty.call(settings, 'marquee_speed')) {
    cleanSettings.marquee_speed = cleanMarqueeSpeed(settings.marquee_speed);
  }

  if (Object.keys(cleanSettings).length === 0) {
    return getStoreSettings();
  }

  if (!hasSupabase) {
    const db = readLocal();
    db.settings = { ...db.settings, ...cleanSettings };
    saveDb();
    return getStoreSettings();
  }

  await sb('site_settings?on_conflict=key', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(
      Object.entries(cleanSettings).map(([key, value]) => ({
        key,
        value,
      }))
    ),
  });

  return getStoreSettings();
}
export async function createOrder({ items, customer, promo, idempotencyKey }) {
  assertBackend();
  if (hasSupabase) {
    return rpc('wf_create_order', {
      p_items: items.map((i) => ({ id: i.id, qty: i.qty })),
      p_customer: customer,
      p_promo: promo || null,
      p_idempotency_key: idempotencyKey,
    });
  }
  const db = readLocal();
  const prior = db.orders.find((o) => o.idempotencyKey === idempotencyKey);
  if (prior) {
    if (String(prior.customer?.email || '').toLowerCase() !== String(customer?.email || '').toLowerCase()) throw new Error('Invalid checkout request key.');
    return { ref: prior.ref, discount: prior.discount, delivery_fee: prior.deliveryFee || 0, total: prior.total };
  }
  if (!Array.isArray(items) || !items.length || items.length > 30) throw new Error('Your bag is empty.');
  const quantities = new Map();
  for (const item of items) {
    const qty = Math.floor(Number(item.qty));
    if (!item?.id || !(qty >= 1 && qty <= 99)) throw new Error('An item in your bag is no longer available.');
    quantities.set(String(item.id), (quantities.get(String(item.id)) || 0) + qty);
  }
  const rows = [...quantities.entries()].map(([id, qty]) => {
    const p = db.products.find((x) => x.id === id);
    if (!p || p.stock === 'out' || qty > 99 || (Number.isFinite(+p.stockQuantity) && +p.stockQuantity < qty)) throw new Error('An item in your bag is no longer available.');
    return { id: p.id, name: p.name, price: p.price, qty };
  });
  const subtotal = rows.reduce((sum, r) => sum + r.price * r.qty, 0);
  let discount = 0, code = '';
  if (promo) {
    const p = db.promos.find((x) => x.code === String(promo).toUpperCase());
    if (!p || !p.active || (p.max && p.used >= p.max) || subtotal < p.min) throw new Error('This promo code is not valid for this order.');
    discount = Math.min(subtotal, p.type === 'percent' ? Math.round(subtotal * p.value / 100) : p.value);
    code = p.code;
    p.used += 1;
  }
  const deliveryFee = Math.max(0, Number(db.settings?.delivery_fee || 0));
  const ref = `WF-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(db.orders.length + 1).padStart(5, '0')}`;
  const order = { ref, date: new Date().toISOString(), status: 'pending', customer, items: rows, subtotal, discount, promo: code, deliveryFee, total: subtotal - discount + deliveryFee, payment: 'Cash on delivery', paymentStatus: 'pending', shipping: {}, idempotencyKey };
  db.orders.unshift(order);
  for (const r of rows) {
    const p = db.products.find((x) => x.id === r.id);
    if (p.stockQuantity !== undefined && p.stockQuantity !== null && Number.isFinite(+p.stockQuantity)) {
      p.stockQuantity = Math.max(0, +p.stockQuantity - r.qty);
      if (p.stockQuantity === 0) p.stock = 'out';
    }
  }
  saveDb();
  return { ref, discount, delivery_fee: deliveryFee, total: order.total };
}

export async function cancelOrder(ref, customerEmail = null) {
  assertBackend();
  if (!hasSupabase) {
    const db = readLocal();
    const order = db.orders.find((o) => o.ref === ref);
    if (!order) return null;
    if (customerEmail && String(order.customer?.email || '').toLowerCase() !== customerEmail.toLowerCase()) return null;
    if (!['pending', 'confirmed'].includes(order.status)) throw new Error('Only pending or confirmed orders can be cancelled.');
    order.status = 'cancelled';
    for (const item of order.items || []) {
      const product = db.products.find((p) => p.id === item.id);
      if (product && product.stockQuantity !== undefined && product.stockQuantity !== null && Number.isFinite(+product.stockQuantity)) {
        product.stockQuantity = Math.max(0, +product.stockQuantity + Number(item.qty || 0));
        if (product.stockQuantity > 0) product.stock = 'in';
      }
    }
    if (order.promo) {
      const promo = db.promos.find((p) => p.code === order.promo);
      if (promo) promo.used = Math.max(0, Number(promo.used || 0) - 1);
    }
    saveDb();
    return order;
  }
  const result = await rpc('wf_cancel_order', { p_ref: ref, p_customer_email: customerEmail });
  if (!result) return null;
  return result;
}

export async function updateOrder(ref, patch) {
  assertBackend();
  if (!hasSupabase) {
    const db = readLocal();
    const order = db.orders.find((o) => o.ref === ref);
    if (!order) return null;
    Object.assign(order, patch);
    saveDb();
    return order;
  }
  const rows = await sb(`orders?ref=eq.${encodeURIComponent(ref)}&select=*`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
  return rows[0] || null;
}

export async function getOrderByRef(ref) {
  assertBackend();
  if (!hasSupabase) return readLocal().orders.find((o) => o.ref === ref) || null;
  const rows = await sb(`orders?ref=eq.${encodeURIComponent(ref)}&select=*`);
  return rows[0] || null;
}

export async function getPromoByCode(code) {
  assertBackend();
  const normalized = String(code || '').toUpperCase();
  if (!hasSupabase) return readLocal().promos.find((p) => p.code === normalized) || null;
  const rows = await sb(`promos?code=eq.${encodeURIComponent(normalized)}&select=*`);
  const p = rows[0];
  return p ? { code: p.code, type: p.type, value: p.value, min: p.min_amount, max: p.max_uses, used: p.used_count, active: p.active } : null;
}

const localCodes = G.__wfEmailCodes || (G.__wfEmailCodes = new Map());
export async function issueEmailCode(email, codeHash) {
  assertBackend();
  if (hasSupabase) return rpc('wf_issue_email_code', { p_email: email, p_code_hash: codeHash });
  const previous = localCodes.get(email) || { sent: [] };
  previous.sent = previous.sent.filter((t) => t > Date.now() - 3600000);
  if (previous.sent.length >= 5) return 'rate_limited';
  previous.codeHash = codeHash;
  previous.expires = Date.now() + 600000;
  previous.tries = 0;
  previous.sent.push(Date.now());
  localCodes.set(email, previous);
  return 'ok';
}

export async function consumeEmailCode(email, codeHash) {
  assertBackend();
  if (hasSupabase) return rpc('wf_consume_email_code', { p_email: email, p_code_hash: codeHash });
  const record = localCodes.get(email);
  if (!record || record.expires < Date.now()) { localCodes.delete(email); return 'expired'; }
  if (++record.tries > 5) { localCodes.delete(email); return 'rate_limited'; }
  if (record.codeHash !== codeHash) {
    if (record.tries >= 5) { localCodes.delete(email); return 'rate_limited'; }
    return 'invalid';
  }
  localCodes.delete(email);
  return 'ok';
}

export async function invalidateEmailCode(email) {
  if (hasSupabase) return rpc('wf_invalidate_email_code', { p_email: email });
  localCodes.delete(email);
}


const localRateLimits = G.__wfRateLimits || (G.__wfRateLimits = new Map());
export async function checkRateLimit(bucket, subjectHash, limit, windowSeconds, blockSeconds) {
  assertBackend();
  if (hasSupabase) return rpc('wf_check_rate_limit', {
    p_bucket: bucket, p_subject_hash: subjectHash, p_limit: limit,
    p_window_seconds: windowSeconds, p_block_seconds: blockSeconds,
  });
  const key = `${bucket}:${subjectHash}`;
  const now = Date.now();
  const record = localRateLimits.get(key) || { started: now, attempts: 0, blockedUntil: 0 };
  if (record.blockedUntil > now) return 'rate_limited';
  if (now - record.started >= windowSeconds * 1000) { record.started = now; record.attempts = 0; record.blockedUntil = 0; }
  record.attempts += 1;
  if (record.attempts > limit) record.blockedUntil = now + blockSeconds * 1000;
  localRateLimits.set(key, record);
  return record.blockedUntil > now ? 'rate_limited' : 'ok';
}

export async function resetRateLimit(bucket, subjectHash) {
  assertBackend();
  if (hasSupabase) return rpc('wf_reset_rate_limit', { p_bucket: bucket, p_subject_hash: subjectHash });
  localRateLimits.delete(`${bucket}:${subjectHash}`);
}
