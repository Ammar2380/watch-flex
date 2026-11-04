import { handler, readBody } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getStoreSettings, saveStoreSettings } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => { requireAdmin(req); return getStoreSettings(); });
export const PUT = handler(async (req) => { requireAdmin(req); return saveStoreSettings(await readBody(req)); });
