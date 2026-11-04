import { handler } from '@/lib/util';
import { requireAdmin } from '@/lib/auth';
import { getDb, hasSupabase } from '@/lib/db';
import { mailConfigured, verifyMailConnection } from '@/lib/mail';
import { storageConfigured, verifyStorageConnection } from '@/lib/storage';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => {
  requireAdmin(req);
  const result = { database: 'not_configured', email: 'not_configured', storage: storageConfigured() ? 'configured' : 'not_configured', payments: 'cash_on_delivery_only', whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ? 'configured' : 'using_site_default' };
  if (hasSupabase) { await getDb(); result.database = 'connected'; }
  if (storageConfigured()) { try { await verifyStorageConnection(); result.storage = 'connected'; } catch (error) { result.storage = error.message.includes('does not exist') ? 'bucket_missing' : 'connection_failed'; } }
  if (mailConfigured()) { try { await verifyMailConnection(); result.email = 'connected'; } catch { result.email = 'connection_failed'; } }
  return result;
});
