import fs from 'fs';
import path from 'path';

const FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
const SEED = path.join(process.cwd(), 'data', 'seed-products.json');
const G = globalThis;

/** One JSON file, kept in memory and written on every change. Needs a server that stays running (see README). */
export function getDb() {
  if (G.__wfDb) return G.__wfDb;
  let db;
  if (fs.existsSync(FILE)) {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } else {
    const products = fs.existsSync(SEED) ? JSON.parse(fs.readFileSync(SEED, 'utf8')) : [];
    db = {
      products,
      orders: [],
      promos: [{ code: 'WELCOME10', type: 'percent', value: 10, min: 0, max: 0, used: 0, active: true }],
    };
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 1));
  }
  G.__wfDb = db;
  return db;
}
export function saveDb() {
  fs.writeFileSync(FILE, JSON.stringify(getDb(), null, 1));
}
