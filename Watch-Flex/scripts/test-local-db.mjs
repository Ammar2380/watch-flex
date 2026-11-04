import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watchflex-test-'));
process.env.NODE_ENV = 'test';
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.SECRET = 'local-test-secret-with-32-characters-minimum';
process.env.ADMIN_PASSWORD = 'local-admin-test-password';

try {
  const db = await import('../lib/db.js');
  const products = await db.getProducts();
  assert.equal(products.length, 4, 'seed catalogue loads');
  assert.ok(products.every((p) => p.id && p.name && p.price > 0), 'seed products are valid');

  const { normalize, viewOf } = await import('../lib/catalog.js');
  const legacyProduct = normalize([{ id: 'legacy-watch', name: 'Legacy Watch', price: '24999', image: 'https://images.example/legacy.webp', specs: 'Quartz, Blue Dial', is_new: 'true' }]);
  assert.equal(legacyProduct.length, 1, 'legacy JSON product shape remains supported');
  assert.deepEqual(legacyProduct[0].images, ['https://images.example/legacy.webp']);
  assert.deepEqual(legacyProduct[0].specs, ['Quartz', 'Blue Dial']);
  assert.equal(legacyProduct[0].isNew, true);
  assert.equal(viewOf(legacyProduct, { q: 'blue', brands: [], categories: [], min: '', max: '', sort: 'featured' }).length, 1, 'catalogue search includes product specifications');

  const product = { ...products[0], price: 1000, stock: 'in', stockQuantity: 3 };
  await db.saveProduct(product);
  await db.saveStoreSettings({ delivery_fee: 250 });
  const before = await db.getPromoByCode('WELCOME10');
  assert.equal(before.used, 0, 'promo starts unused');

  const customer = { name: 'Test Customer', email: 'test@example.com', phone: '03001234567', city: 'Hyderabad', postal: '71000', address: '123 Test Street, Latifabad' };
  const request = { items: [{ id: product.id, qty: 2 }], customer, promo: 'WELCOME10', idempotencyKey: 'test-idempotency-000001' };
  const created = await db.createOrder(request);
  assert.equal(created.total, 2050, 'server price, promo and delivery fee are calculated');
  assert.equal(created.discount, 200);
  const duplicate = await db.createOrder(request);
  assert.equal(duplicate.ref, created.ref, 'duplicate checkout returns the original order');
  await assert.rejects(() => db.createOrder({ ...request, customer: { ...customer, email: 'other@example.com' } }), /Invalid checkout request key/, "idempotency key cannot expose another customer order");

  let state = await db.getDb();
  assert.equal(state.products.find((p) => p.id === product.id).stockQuantity, 1, 'stock decremented once');
  assert.equal((await db.getPromoByCode('WELCOME10')).used, 1, 'promo consumed once');
  const order = await db.getOrderByRef(created.ref);
  assert.equal(order.customer.email, customer.email, 'order is persisted with customer details');
  assert.equal(order.total, 2050);

  await assert.rejects(
    () => db.createOrder({ ...request, idempotencyKey: 'test-idempotency-000002', items: [{ id: product.id, qty: 2 }, { id: product.id, qty: 2 }] }),
    /no longer available/,
    'duplicate product lines cannot over-allocate stock',
  );
  await assert.rejects(
    () => db.createOrder({ ...request, items: [{ id: product.id, qty: 1 }], promo: 'INVALID', idempotencyKey: 'test-idempotency-000003' }),
    /promo code is not valid/,
    'invalid promo codes are rejected',
  );

  const cancelled = await db.cancelOrder(created.ref, customer.email);
  assert.equal(cancelled.status, 'cancelled', 'customer cancellation succeeds while pending');
  state = await db.getDb();
  assert.equal(state.products.find((p) => p.id === product.id).stockQuantity, 3, 'cancellation restores inventory');
  assert.equal((await db.getPromoByCode('WELCOME10')).used, 0, 'cancellation releases promo usage');
  await assert.rejects(() => db.cancelOrder(created.ref), /Only pending or confirmed/, 'second cancellation is rejected');

  const auth = await import('../lib/auth.js');
  assert.equal(auth.safePasswordEqual('local-admin-test-password'), true, 'configured admin password matches');
  assert.equal(auth.safePasswordEqual('not-the-password'), false, 'wrong admin password is rejected');
  assert.equal(auth.okTok('admin', auth.tok('admin')), true, 'signed admin token verifies');
  assert.equal(auth.okTok('other', auth.tok('admin')), false, 'token cannot be reused for another subject');

  const verifyEmail = 'verify@example.com';
  const verifyCodeHash = auth.hashCode(verifyEmail, '123456');
  assert.equal(await db.issueEmailCode(verifyEmail, verifyCodeHash), 'ok');
  assert.equal(await db.consumeEmailCode(verifyEmail, auth.hashCode(verifyEmail, '000000')), 'invalid');
  assert.equal(await db.consumeEmailCode(verifyEmail, verifyCodeHash), 'ok', 'correct email code is one-time use');
  assert.equal(await db.consumeEmailCode(verifyEmail, verifyCodeHash), 'expired', 'verified code cannot be replayed');

  const limitedEmail = 'limited@example.com';
  for (let i = 0; i < 5; i++) assert.equal(await db.issueEmailCode(limitedEmail, auth.hashCode(limitedEmail, String(i))), 'ok');
  assert.equal(await db.issueEmailCode(limitedEmail, auth.hashCode(limitedEmail, 'sixth')), 'rate_limited', 'sixth email code request is rate limited');

  const attemptsEmail = 'attempts@example.com';
  await db.issueEmailCode(attemptsEmail, auth.hashCode(attemptsEmail, '654321'));
  for (let i = 0; i < 4; i++) assert.equal(await db.consumeEmailCode(attemptsEmail, auth.hashCode(attemptsEmail, '000000')), 'invalid');
  assert.equal(await db.consumeEmailCode(attemptsEmail, auth.hashCode(attemptsEmail, '000000')), 'rate_limited', 'fifth invalid verification attempt locks the code');

  const expiredEmail = 'expired@example.com';
  await db.issueEmailCode(expiredEmail, auth.hashCode(expiredEmail, '111111'));
  globalThis.__wfEmailCodes.get(expiredEmail).expires = Date.now() - 1;
  assert.equal(await db.consumeEmailCode(expiredEmail, auth.hashCode(expiredEmail, '111111')), 'expired', 'expired code is rejected');

  const rateSubject = auth.hashCode('admin-login', '127.0.0.1');
  for (let i = 0; i < 5; i++) assert.equal(await db.checkRateLimit('admin-login', rateSubject, 5, 900, 900), 'ok');
  assert.equal(await db.checkRateLimit('admin-login', rateSubject, 5, 900, 900), 'rate_limited', 'login rate limit blocks after five attempts');
  await db.resetRateLimit('admin-login', rateSubject);
  assert.equal(await db.checkRateLimit('admin-login', rateSubject, 5, 900, 900), 'ok', 'successful login reset clears rate limit');

  const prod = spawnSync(process.execPath, ['--experimental-default-type=module', '--input-type=module', '-e', "import('./lib/db.js').then((m) => m.getProducts())"], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', VERCEL: '', SUPABASE_URL: '', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', DATA_FILE: path.join(dir, 'prod-data.json') },
  });
  assert.notEqual(prod.status, 0, 'production data access fails closed without Supabase');
  assert.match(prod.stderr + prod.stdout, /Supabase is required in production/);

  console.log('PASS: catalogue, persistence, trusted totals, promo use, idempotency, duplicate-line stock checks, cancel/restore, admin-token checks, email-code success/expiry/attempt and send limits, and fail-closed production guard.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
