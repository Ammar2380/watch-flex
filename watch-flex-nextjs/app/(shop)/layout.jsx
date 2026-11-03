import './globals.css';
import { getDb } from '@/lib/db';
import ShopProvider from '@/components/ShopProvider';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { default: 'WATCH FLEX PK', template: '%s – Watch Flex PK' },
  description: 'Watch Flex PK. Watches with cash on delivery all over Pakistan.',
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#000000' };

// sets the saved theme before the first paint (no flash)
const THEME_JS = `try{var t=localStorage.getItem('of-theme');if(t==='red')t='navy';if(!/^(black|cream|navy)$/.test(t))t='black';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='black'}`;

export default function ShopLayout({ children }) {
  const products = getDb().products;
  return (
    <html lang="en" data-theme="black" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: THEME_JS }} />
      </head>
      <body>
        <ShopProvider products={products}>
          <Shell>{children}</Shell>
        </ShopProvider>
      </body>
    </html>
  );
}
