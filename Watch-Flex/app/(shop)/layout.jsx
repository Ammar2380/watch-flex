
import './globals.css';
import { getProducts } from '@/lib/db';
import ShopProvider from '@/components/ShopProvider';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export const metadata = {
  metadataBase: new URL('https://thewatchflex.com'),

  title: {
    default: "Men's Watches in Pakistan | Watch Flex PK",
    template: '%s | Watch Flex PK',
  },

  description:
    "Shop stylish men's watches at Watch Flex PK. Explore quality designs at affordable prices with cash on delivery across Pakistan.",

  // Website favicon
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },

  alternates: {
    canonical: '/',
  },

  openGraph: {
    title: "Men's Watches in Pakistan | Watch Flex PK",
    description:
      "Explore stylish men's watches with cash on delivery across Pakistan.",
    url: 'https://thewatchflex.com',
    siteName: 'Watch Flex PK',
    locale: 'en_PK',
    type: 'website',
  },

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

const THEME_JS = `try{var t=localStorage.getItem('of-theme');if(t==='red')t='navy';if(!/^(black|cream|navy)$/.test(t))t='black';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='black'}`;

export default async function ShopLayout({ children }) {
  const products = await getProducts();

  return (
    <html lang="en" data-theme="black" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&display=swap"
        />
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
