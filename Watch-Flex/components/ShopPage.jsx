'use client';
import { useMemo, useState } from 'react';
import { NavLink, useShop } from './ShopProvider';
import Wm from './Wm';
import Mark from './Mark';
import { onImgError } from './ImgBox';
import { budgets, viewOf } from '@/lib/catalog';
import { DEL, PHW, REV, STEP, WA, pHref, pkr, sm } from '@/lib/site';

const WAI = (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-1.5-.7-2.5-1.3-3.5-2.9-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.2.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>
);
const svgp = { viewBox: '0 0 24 24', width: 38, height: 38, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' };
const ICO = {
  q: <svg {...svgp}><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20M9 3l3 6 3-6M12 21 9 9m3 12 3-12" /></svg>,
  c: <svg {...svgp}><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>,
  d: <svg {...svgp}><path d="M2 6h12v10H2zM14 9h4l4 3v4h-8" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>,
  s: <svg {...svgp}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /><path d="M19 20c0 1.5-2 2-5 2" /></svg>,
};

function Card({ p }) {
  const { addToCart } = useShop();
  const [added, setAdded] = useState(false);
  const out = p.stock === 'out';
  const img = p.images[0];
  const tag = out ? 'Out of stock' : p.featured ? 'Featured' : p.isNew ? 'New' : '';
  const h = pHref(p.id);
  return (
    <article className="pc">
      <NavLink className="pimg" href={h} aria-label={p.name}>
        <img src={img ? sm(img) : PHW} alt={p.name} loading="lazy" decoding="async" draggable={false} onError={onImgError} />
        {tag ? <span className="badge">{tag}</span> : null}
      </NavLink>
      <div className="pm"><NavLink className="pn" href={h}>{p.name}</NavLink><span className="pp">{pkr(p.price)}</span></div>
      {p.specs.length ? <div className="ps">{p.specs.join(' | ')}</div> : null}
      <div className="pa">
        {out ? <button className="cta" disabled>Out of stock</button> : (
          <button className="cta" onClick={() => { addToCart(p.id); setAdded(true); setTimeout(() => setAdded(false), 1500); }}>
            {added ? 'Added ✓' : 'Add to cart'}
          </button>
        )}
      </div>
    </article>
  );
}

function Catalogue() {
  const { items, filters: S, setFilters } = useShop();
  const [panel, setPanel] = useState(false);
  const r = useMemo(() => viewOf(items, S), [items, S]);
  const n = Math.min(S.shown, r.length);
  const brandCount = useMemo(() => {
    const br = {};
    items.forEach((p) => p.brand && (br[p.brand] = (br[p.brand] || 0) + 1));
    return br;
  }, [items]);
  const bd = useMemo(() => budgets(items), [items]);
  const categoryCount = useMemo(() => { const c = {}; items.forEach((p) => { c[p.category] = (c[p.category] || 0) + 1; }); return c; }, [items]);

  const act = !!(S.q.trim() || S.brands.length || (S.categories || []).length || S.min !== '' || S.max !== '');
  const nf = S.brands.length + (S.categories || []).length + (S.min !== '' || S.max !== '' ? 1 : 0);
  const bad = S.min !== '' && S.max !== '' && +S.min > +S.max;
  const clear = () => setFilters({ q: '', brands: [], categories: [], min: '', max: '', sort: 'featured' });
  const toggleBrand = (b) => setFilters({ brands: S.brands.includes(b) ? S.brands.filter((x) => x !== b) : [...S.brands, b] });
  const toggleCategory = (c) => setFilters({ categories: (S.categories || []).includes(c) ? S.categories.filter((x) => x !== c) : [...(S.categories || []), c] });
  const pickBudget = (b) => {
    const same = S.min === b.lo && S.max === b.hi;
    setFilters({ min: same ? '' : b.lo, max: same ? '' : b.hi });
  };
  const rc = !items.length ? '' : r.length
    ? `Showing ${n} of ${r.length} watch${r.length > 1 ? 'es' : ''}` + (act ? ` (${items.length} in catalogue)` : '')
    : 'No watches match';
  const f = [
    S.q.trim() && `“${S.q.trim()}”`,
    S.brands.length && S.brands.join(', '),
    (S.categories || []).length && S.categories.join(', '),
    (S.min !== '' || S.max !== '') && `${S.min !== '' ? pkr(+S.min) : 'any price'} to ${S.max !== '' ? pkr(+S.max) : 'any price'}`,
  ].filter(Boolean).join(' · ');

  return (
    <section className="sec" id="shopgrid">
      <div className="sh">
        <div><div className="eyebrow">The collection</div><h2>Shop Watches</h2></div>
        <p className="rc" id="rc" role="status" aria-live="polite">{rc}</p>
      </div>
      <div className="tb">
        <label className="vh" htmlFor="q">Search watches</label>
        <input id="q" type="search" placeholder="Search name, brand, model or spec" autoComplete="off" value={S.q} onChange={(e) => setFilters({ q: e.target.value })} />
        <label className="vh" htmlFor="so">Sort by</label>
        <select id="so" value={S.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
          <option value="featured">Featured</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
          <option value="name">Name: A to Z</option>
        </select>
        <button className="chip tgl" id="ft" aria-expanded={panel ? 'true' : 'false'} aria-controls="fpnl" onClick={() => setPanel((o) => !o)}>
          {nf ? `Filters (${nf})` : 'Filters'}
        </button>
      </div>
      <div className={'fpnl' + (panel ? ' open' : '')} id="fpnl">
        <div className="fg"><b>Brand</b>
          <div className="chips bs" id="bc">
            {Object.keys(brandCount).sort((a, b) => a.localeCompare(b)).map((b) => (
              <button key={b} className="chip" aria-pressed={S.brands.includes(b) ? 'true' : 'false'} onClick={() => toggleBrand(b)}>{b} ({brandCount[b]})</button>
            ))}
            {!Object.keys(brandCount).length ? <small>No brands yet</small> : null}
          </div>
        </div>
        <div className="fg"><b>Category</b><div className="chips">
          {Object.keys(categoryCount).sort((a, b) => a.localeCompare(b)).map((c) => <button key={c} className="chip" aria-pressed={(S.categories || []).includes(c) ? 'true' : 'false'} onClick={() => toggleCategory(c)}>{c} ({categoryCount[c]})</button>)}
        </div></div>
        <div className="fg"><b>Price (PKR)</b>
          <div className="pr">
            <label className="vh" htmlFor="mn">Minimum price</label>
            <input id="mn" type="number" min="0" step="500" inputMode="numeric" placeholder="Min" value={S.min} onChange={(e) => setFilters({ min: e.target.value })} />
            <span>–</span>
            <label className="vh" htmlFor="mx">Maximum price</label>
            <input id="mx" type="number" min="0" step="500" inputMode="numeric" placeholder="Max" value={S.max} onChange={(e) => setFilters({ max: e.target.value })} />
          </div>
          <small id="pn">{bad ? `Minimum is higher than maximum, so showing ${pkr(+S.max)} to ${pkr(+S.min)}.` : ''}</small>
        </div>
        <div className="fg" id="bdg" hidden={!bd.length}><b>Shop by budget</b>
          <div className="chips" id="bd">
            {bd.map((b) => (
              <button key={b.lo + '-' + b.hi} className="chip" aria-pressed={S.min === b.lo && S.max === b.hi ? 'true' : 'false'} onClick={() => pickBudget(b)}>{b.label} ({b.n})</button>
            ))}
          </div>
        </div>
        <button className="chip" id="cl" hidden={!(act || S.sort !== 'featured')} onClick={clear}>Clear filters</button>
      </div>
      <div className="pgrid" id="pgrid">{r.slice(0, n).map((p) => <Card key={p.id} p={p} />)}</div>
      <div className="em" id="em" hidden={!!r.length}>
        {items.length ? (
          <>
            <b>No watches found</b>
            <p>Nothing matches {f || 'these filters'}. Try fewer words, another brand or a wider price range.</p>
            <button className="btn" onClick={clear}>Clear filters</button>
          </>
        ) : (
          <><b>New watches are on the way</b><p>Please check back soon.</p></>
        )}
      </div>
      <div className="more">
        <button className="btn" id="lm" hidden={n >= r.length} onClick={() => setFilters({ shown: S.shown + STEP })}>Load more ({r.length - n} remaining)</button>
      </div>
    </section>
  );
}

function Why() {
  const W = [[ICO.q, 'Premium Quality', 'Carefully selected watches'], [ICO.c, 'Cash on Delivery', 'All over Pakistan'],
    [ICO.d, 'Fast Delivery', `${DEL} days delivery time`], [ICO.s, 'Dedicated Support', 'We’re here to help on WhatsApp']];
  return (
    <section className="why">
      <div className="eyebrow">Why Watch Flex</div>
      <h2>More Than Just a Watch</h2>
      <div className="wg">{W.map((w) => <div className="wi fx" key={w[1]}>{w[0]}<b>{w[1]}</b><span>{w[2]}</span></div>)}</div>
    </section>
  );
}

function Revs() {
  if (!REV.length) return null;
  return (
    <section className="sec">
      <div className="sh c"><div><div className="eyebrow">Customer reviews</div><h2>What Our Customers Say</h2></div></div>
      <div className="revs">
        {REV.map((r) => (
          <div className="rev fx" key={r[0] + r[2]}>
            <div className="stars" aria-label="5 out of 5 stars">★★★★★</div>
            <p>“{r[2]}”</p>
            <div className="who"><span className="av">{r[0][0]}</span><span><b>{r[0]}</b><br /><em>{r[1]}</em></span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ShopPage() {
  return (
    <>
      <Wm text="WATCH FLEX" reg />
      <Mark />
      <Catalogue />
      <Why />
      <Revs />
    </>
  );
}
