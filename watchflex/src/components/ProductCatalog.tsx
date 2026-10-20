import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Search } from 'lucide-react';
import type { Product } from '../types';
import { money } from '../config';
import WishButton from './WishButton';
import { ease, useCalm } from '../motion';

type Sort = 'default' | 'asc' | 'desc';
const cats = ['ALL', 'TIMEPIECE', 'ACCESSORIES'] as const;
type Cat = (typeof cats)[number];

interface Props { products: Product[]; wish: number[]; onQuick: (p: Product) => void; onWish: (id: number) => void }

function useGridColumns() {
  const [columns, setColumns] = useState(() => {
    if (typeof window === 'undefined') return 1;
    return window.matchMedia('(min-width: 1024px)').matches ? 4 : window.matchMedia('(min-width: 640px)').matches ? 2 : 1;
  });
  useEffect(() => {
    const tablet = window.matchMedia('(min-width: 640px)');
    const desktop = window.matchMedia('(min-width: 1024px)');
    const update = () => setColumns(desktop.matches ? 4 : tablet.matches ? 2 : 1);
    update();
    tablet.addEventListener('change', update);
    desktop.addEventListener('change', update);
    return () => { tablet.removeEventListener('change', update); desktop.removeEventListener('change', update); };
  }, []);
  return columns;
}

function Card({ p, i, columns, wished, onQuick, onWish }: { p: Product; i: number; columns: number; wished: boolean; onQuick: () => void; onWish: () => void }) {
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const calm = useCalm();
  const { scrollYProgress: sp } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const py = useTransform(sp, [0, 1], calm ? ['0%', '0%'] : ['-6%', '6%']);
  const row = Math.floor(i / columns);
  const column = i % columns;
  // Keep the editorial stagger in sync with the actual responsive grid.
  const from = row % 2 ? 'inset(0% 0% 100% 0%)' : 'inset(100% 0% 0% 0%)';
  const delay = column * (row % 2 ? 0.09 : 0.055);
  return (
    <motion.li ref={ref} className="group/c flex flex-col" initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease, delay }}>
      <button onClick={onQuick} aria-label={`Quick view ${p.name}`}
        className="group/q relative block w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 aspect-[4/5] mb-4 text-left active:scale-[0.98] transition-transform">
        {bad
          ? <span className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-mono uppercase text-neutral-500">{p.name}</span>
          : <motion.img style={{ y: py, scale: 1.14 }} initial={{ clipPath: from }} whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }} viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 1.1, ease, delay }} src={p.image} alt={`${p.name} — ${p.tag.toLowerCase()} (placeholder photo)`} width={800} height={1000}
              loading={i < 4 ? 'eager' : 'lazy'} decoding="async" onError={() => setBad(true)}
              className="w-full h-full object-cover object-center group-hover/q:object-[50%_30%] transition-[object-position] duration-700 ease-out" />}
        <span className="absolute inset-0 bg-black/10 group-hover/q:bg-transparent transition-colors" />
        <span className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-brandRed text-white w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-[10px] uppercase tracking-wider opacity-100 scale-100 rotate-0 md:opacity-0 md:scale-75 md:-rotate-45 md:group-hover/q:opacity-100 md:group-hover/q:scale-100 md:group-hover/q:rotate-0 md:group-focus-visible/q:opacity-100 md:group-focus-visible/q:scale-100 transition-all duration-300 shadow-2xl">
          View more
        </span>
      </button>
      <div className="flex justify-between items-start gap-2 mb-1">
        <div className="min-w-0 flex-1 transition-transform duration-500 ease-out group-hover/c:translate-x-1.5">
          <h3 className="font-bold text-sm sm:text-base tracking-tight [overflow-wrap:anywhere]">{p.name}</h3>
          <p className="text-xs text-neutral-500 font-mono [overflow-wrap:anywhere]">{p.subtitle}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap pl-1 font-bold text-sm sm:text-base text-brandRed">{money(p.price)}</span>
      </div>
      <div className="flex justify-between items-center gap-2 text-xs font-mono text-neutral-500 uppercase mt-2">
        <span>{p.tag}</span>
        <WishButton name={p.name} wished={wished} onToggle={onWish} />
      </div>
    </motion.li>
  );
}

export default function ProductCatalog({ products, wish, onQuick, onWish }: Props) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('ALL');
  const [sort, setSort] = useState<Sort>('default');
  const columns = useGridColumns();
  const active = q.trim() !== '' || cat !== 'ALL' || sort !== 'default';
  const clear = () => { setQ(''); setCat('ALL'); setSort('default'); };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = products.filter(p => (cat === 'ALL' || p.tag === cat) && (!s || `${p.name} ${p.subtitle} ${p.tag}`.toLowerCase().includes(s)));
    return sort === 'default' ? r : [...r].sort((a, b) => (sort === 'asc' ? a.price - b.price : b.price - a.price));
  }, [products, q, cat, sort]);

  return (
    <main id="shop-grid" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 scroll-mt-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between pb-10 text-xs font-mono uppercase tracking-wider">
        <label className="flex min-h-11 items-center gap-2 w-full sm:max-w-sm lg:w-72 lg:max-w-none border-b border-neutral-400 dark:border-neutral-600 focus-within:border-brandRed pb-2 transition-colors">
          <Search size={14} aria-hidden />
          <span className="sr-only">Search the collection</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
            className="bg-transparent w-full outline-none uppercase placeholder:text-neutral-500" />
        </label>
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-x-3 sm:gap-x-5 gap-y-2">
          {cats.map(c => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}
              className={`${cat === c ? 'text-brandRed underline underline-offset-4' : 'text-neutral-500 hover:text-brandRed transition-colors'} min-h-10 px-1`}>{c}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">Sort</span>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="min-h-10 bg-transparent outline-none text-brandRed uppercase [&>option]:text-black">
              <option value="default">Featured</option>
              <option value="asc">Price: low to high</option>
              <option value="desc">Price: high to low</option>
            </select>
          </label>
          {active && <button onClick={clear} className="min-h-10 px-1 text-brandRed underline underline-offset-4">Clear filters</button>}
          <span className="text-neutral-500" role="status">{list.length} of {products.length}</span>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-2xl font-black uppercase tracking-tight">Nothing matches that search.</p>
          <p className="mt-2 text-sm text-neutral-500">Try a different name or category.</p>
          <button onClick={clear} className="mt-6 min-h-11 px-2 text-xs font-mono uppercase tracking-wider text-brandRed underline underline-offset-4">Clear filters</button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-16">
          {list.map((p, i) => (
            <Card key={p.id} p={p} i={i} columns={columns} wished={wish.includes(p.id)} onQuick={() => onQuick(p)} onWish={() => onWish(p.id)} />
          ))}
        </ul>
      )}
    </main>
  );
}
