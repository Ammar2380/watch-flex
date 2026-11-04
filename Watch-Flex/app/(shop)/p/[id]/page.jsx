import { getProducts } from '@/lib/db';
import { normalize } from '@/lib/catalog';
import ProductView from '@/components/ProductView';
import { NotFoundWatch } from '@/components/InfoPage';

export const dynamic = 'force-dynamic';

async function find(params) {
  let { id } = await params;
  try { id = decodeURIComponent(id); } catch {}
  const products = await getProducts();
  return { id, p: normalize(products).find((x) => x.id === id) };
}

export async function generateMetadata({ params }) {
  const { p } = await find(params);
  return { title: p ? p.name : 'Watch not found', description: p ? `${p.name}${p.brand ? ' by ' + p.brand : ''}. Cash on delivery all over Pakistan.` : undefined };
}

export default async function Page({ params }) {
  const { id, p } = await find(params);
  return p ? <ProductView key={id} id={id} /> : <NotFoundWatch />;
}
