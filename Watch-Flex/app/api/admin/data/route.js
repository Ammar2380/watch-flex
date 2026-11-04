import { handler } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => { requireAdmin(req); return getDb(); });
