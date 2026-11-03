'use client';
import { useState } from 'react';
import { NavLink, useShop } from './ShopProvider';
import ImgBox from './ImgBox';
import { pkr } from '@/lib/site';

export default function ProductView({ id }) {
  const { map, addToCart } = useShop();
  const p = map.get(id);
  const [cur, setCur] = useState('');
  const [added, setAdded] = useState(false);
  if (!p) return null;
  const out = p.stock === 'out';
  const dl = [['Brand', p.brand], ['Model', p.model], ['Category', p.category]].filter((r) => r[1]);
  return (
    <section className="pd">
      <div className="gal">
        <ImgBox p={p} src={cur} />
        {p.images.length > 1 ? (
          <div className="th">
            {p.images.map((u, i) => (
              <button key={u + i} onClick={() => setCur(u)} aria-label={`Show photo ${i + 1}`}><img src={u} alt="" /></button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="inf">
        <NavLink href="/">← Back to shop</NavLink>
        <h1>{p.name}</h1>
        <div className="price">{pkr(p.price)}</div>
        {dl.length ? <dl>{dl.map((r) => <div key={r[0]} style={{ display: 'contents' }}><dt>{r[0]}</dt><dd>{r[1]}</dd></div>)}</dl> : null}
        {p.specs.length ? <ul className="sp">{p.specs.map((s) => <li key={s}>{s}</li>)}</ul> : null}
        <div className="st">{out ? 'Out of stock' : p.stock === 'in' ? 'In stock' : 'Availability confirmed after you order'}</div>
        {out ? null : (
          <>
            <button className="btn" onClick={() => { addToCart(p.id); setAdded(true); }}>{added ? 'Added — add another' : 'Add to bag'}</button>
            <NavLink className="btn" id="goBag" href="/bag" hidden={!added}>Go to bag</NavLink>
          </>
        )}
      </div>
    </section>
  );
}
