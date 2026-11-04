import { handler } from '@/lib/util';
import { getStoreSettings } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => getStoreSettings());
