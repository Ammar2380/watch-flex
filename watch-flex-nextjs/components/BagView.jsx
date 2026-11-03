'use client';
import { NavLink, useShop } from './ShopProvider';
import Wm from './Wm';
import ImgBox from './ImgBox';
import { DECOR, DEL, pHref, pkr } from '@/lib/site';
import { subtotalOf } from '@/lib/catalog';

function EmptyBag() {
  return (
    <section className="eb">
      <div className="eb-t">
        <div className="eyebrow">Your bag is empty</div>
        <h2>No watch yet?<br /><span>Time is ticking.</span></h2>
        <p>Browse the collection and add a watch you like. Cash on delivery all over Pakistan, delivered in {DEL} days.</p>
        <div className="cobtns"><NavLink className="btn solid" href="/">Shop watches</NavLink></div>
      </div>
      <div className="eb-i"><img src={DECOR} alt="" draggable={false} loading="lazy" onError={(e) => e.currentTarget.parentElement.remove()} /></div>
    </section>
  );
}

export default function BagView() {
  const { rowsOf, okRows, changeQty, removeFromCart } = useShop();
  const rows = rowsOf();
  const ok = okRows();
  return (
    <>
      <div className="bw"><Wm text="YOUR BAG" /><div className="rule"></div></div>
      {rows.length ? (
        <>
          <div className="lines">
            {rows.map(([p, q]) => (
              <div className="ln2" key={p.id}>
                <ImgBox p={p} />
                <div>
                  <NavLink href={pHref(p.id)}>{p.name}</NavLink>
                  {p.stock === 'out' ? <><br /><small>Currently unavailable. Remove it to order.</small></> : null}
                </div>
                <div className="q">
                  <button onClick={() => changeQty(p.id, -1)} aria-label={`Fewer ${p.name}`}>−</button>
                  <span aria-label="Quantity">{q}</span>
                  <button onClick={() => changeQty(p.id, 1)} aria-label={`More ${p.name}`}>+</button>
                </div>
                <div className="lp">{pkr(p.price * q)} <button className="rm btn" onClick={() => removeFromCart(p.id)} aria-label={`Remove ${p.name}`}>Remove</button></div>
              </div>
            ))}
          </div>
          <div className="sumr">
            <span>Subtotal {pkr(subtotalOf(ok))}<br /><small>Delivery and availability are confirmed by us after you order.</small></span>
            <span>
              <NavLink className="btn" href="/">Back to shop</NavLink>
              {ok.length ? <> <NavLink className="btn solid" href="/checkout">Checkout</NavLink></> : null}
            </span>
          </div>
        </>
      ) : <EmptyBag />}
    </>
  );
}
