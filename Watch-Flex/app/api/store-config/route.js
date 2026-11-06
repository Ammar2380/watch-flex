import { handler } from '@/lib/util';
import { getStoreSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const settings = await getStoreSettings();

  return {
    marquee_enabled: settings.marquee_enabled,
    marquee_items: settings.marquee_items,
    marquee_speed: settings.marquee_speed,
  };
});