import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://mock-watchflex.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_mock_for_tests_only';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const calls = [];
let failNext = false;
let legacyProductTable = false;
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (failNext) { failNext = false; return new Response(JSON.stringify({ message: 'mock failure' }), { status: 503 }); }
  if (String(url).includes('/storage/v1/bucket/')) return new Response('{}', { status: 200 });
  if (String(url).includes('/storage/v1/object/')) return new Response('{}', { status: options.method === 'DELETE' ? 200 : 201 });
  if (String(url).includes('/rpc/wf_create_order')) return new Response(JSON.stringify({ ref: 'WF-261104-000001', discount: 50, delivery_fee: 200, total: 1150 }), { status: 200 });
  if (String(url).includes('/rpc/wf_check_rate_limit')) return new Response(JSON.stringify('ok'), { status: 200 });
  if (String(url).includes('/rpc/wf_reset_rate_limit')) return new Response('null', { status: 200 });
  if (String(url).includes('/products?')) {
    if (legacyProductTable && String(url).includes('sort_order')) return new Response(JSON.stringify({ message: 'column products.sort_order does not exist' }), { status: 400 });
    if (legacyProductTable) return new Response(JSON.stringify([{ id: 'f-tissot-gentleman', created_at: '2026-11-04T00:00:00Z', data: { id: 'f-tissot-gentleman', name: 'Tissot Gentleman', brand: 'Tissot', price: 144999, image: 'https://images.example/watch.webp', specs: 'Automatic, Sapphire Glass', isNew: false, stock: 'unknown' } }]), { status: 200 });
    return new Response(JSON.stringify([{ id: 'p1', name: 'Test Watch', price: 1000, images: [], category: 'Watches', specs: [], stock: 'in', is_new: true, stock_quantity: 7 }]), { status: 200 });
  }
  if (String(url).includes('/orders?')) return new Response(JSON.stringify([{ ref: 'WF-261104-000001', customer: { email: 'a@example.com' }, date: '2026-11-04T00:00:00Z', items: [], subtotal: 1000, discount: 50, delivery_fee: 200, total: 1150 }]), { status: 200 });
  if (String(url).includes('/promos?')) return new Response(JSON.stringify([]), { status: 200 });
  if (String(url).includes('/site_settings?')) return new Response(JSON.stringify([{ key: 'delivery_fee', value: 200 }]), { status: 200 });
  return new Response('[]', { status: 200 });
};

try {
  const db = await import('../lib/db.js');
  const products = await db.getProducts();
  assert.equal(products[0].isNew, true, 'database snake_case fields map to storefront fields');
  assert.equal(products[0].stockQuantity, 7);
  const productCall = calls.find((x) => x.url.includes('/products?'));
  assert.equal(productCall.options.headers.apikey, 'sb_secret_mock_for_tests_only');
  assert.equal(productCall.options.headers.Authorization, undefined, 'new secret key is not sent as a JWT bearer token');

  const all = await db.getDb();
  assert.equal(all.orders[0].ref, 'WF-261104-000001');
  const ranged = calls.filter((x) => x.url.includes('/orders?'))[0];
  assert.equal(ranged.options.headers.Range, '0-999', 'admin reads request a paginated range');
  assert.equal(all.settings.delivery_fee, 200);

  const order = await db.createOrder({ items: [{ id: 'p1', qty: 1 }], customer: { email: 'a@example.com' }, promo: 'SAVE', idempotencyKey: 'mock-idempotency-000001' });
  assert.equal(order.ref, 'WF-261104-000001');
  const rpcCall = calls.find((x) => x.url.includes('/rpc/wf_create_order'));
  const rpcBody = JSON.parse(rpcCall.options.body);
  assert.deepEqual(rpcBody.p_items, [{ id: 'p1', qty: 1 }]);
  assert.equal(rpcBody.p_idempotency_key, 'mock-idempotency-000001');

  assert.equal(await db.checkRateLimit('admin-login', 'hashed-subject-value-123456', 5, 900, 900), 'ok');
  await db.resetRateLimit('admin-login', 'hashed-subject-value-123456');

  const storage = await import('../lib/storage.js');
  assert.equal(await storage.verifyStorageConnection(), true);
  const uploaded = await storage.uploadProductImage({ productId: 'test-product', bytes: Buffer.from('mock image'), contentType: 'image/png', extension: 'png' });
  assert.match(uploaded.url, /^https:\/\/mock-watchflex\.supabase\.co\/storage\/v1\/object\/public\/product-images\//);
  assert.equal(await storage.deleteProductImageByUrl(uploaded.url), true);
  const storageCall = calls.find((x) => x.url.includes('/storage/v1/bucket/'));
  assert.equal(storageCall.options.headers.apikey, 'sb_secret_mock_for_tests_only');
  assert.equal(storageCall.options.headers.Authorization, undefined);

  // Backward compatibility with the legacy service_role JWT adds Authorization: Bearer.
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJlegacy_test_jwt';
  calls.length = 0;
  await db.getProducts();
  const legacyCall = calls.find((x) => x.url.includes('/products?'));
  assert.equal(legacyCall.options.headers.Authorization, 'Bearer eyJlegacy_test_jwt');

  // Older project table: products(id, data, created_at). The storefront retries
  // with the legacy shape and keeps names, prices, old single-image URLs and specs.
  legacyProductTable = true;
  const oldProducts = await db.getProducts();
  assert.equal(oldProducts.length, 1);
  assert.equal(oldProducts[0].name, 'Tissot Gentleman');
  assert.equal(oldProducts[0].price, 144999);
  assert.deepEqual(oldProducts[0].images, ['https://images.example/watch.webp']);
  assert.deepEqual(oldProducts[0].specs, ['Automatic', 'Sapphire Glass']);
  assert.equal(oldProducts[0].stock, 'unknown');
  legacyProductTable = false;

  failNext = true;
  await assert.rejects(() => db.getProducts(), /mock failure/, 'database request failures propagate to the route error handler');

  console.log('PASS: Supabase adapter, current/legacy key headers, RPC shape, paginated reads, legacy id+data product compatibility (including single images), storage operations and provider error propagation (mock HTTP transport).');
} finally {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}
