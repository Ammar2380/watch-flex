'use client';

import { NavLink, useShop } from './ShopProvider';
import { DEL, MARQUEE } from '@/lib/site';

const DOTS = [
  ['black', '#000', '#ebe5dd', 'Black theme'],
  ['cream', '#ece5dc', '#000', 'Cream theme'],
  ['navy', '#0a1f44', '#ebe5dd', 'Navy theme'],
];

const SPEEDS = {
  slow: '60s',
  normal: '40s',
  fast: '25s',
};

export default function Header() {
  const { cnt, theme, setTheme, pathname, marquee } = useShop();

  const bagActive = pathname === '/bag' || pathname === '/checkout';

  // Use admin messages, or the original messages as fallback.
  const messages = marquee.items.length ? marquee.items : MARQUEE;

  const duration = SPEEDS[marquee.speed] || '40s';

  const group = (hidden) => (
    <div className="g" aria-hidden={hidden ? 'true' : undefined}>
      {[0, 1, 2].flatMap((r) =>
        messages.map((m, i) => (
          <span key={r + '-' + i}>{m}</span>
        ))
      )}
    </div>
  );

  return (
    <header>
      {marquee.enabled && (
        <div className="mq" role="region" aria-label="Store information">
          <span className="vh">
            {messages.join('. ')}
          </span>

          <div
            id="mqt"
            aria-hidden="true"
            style={{ '--mq-duration': duration }}
          >
            {group(false)}
            {group(true)}
          </div>
        </div>
      )}

      <NavLink className="mk" href="/" aria-label="Watch Flex home">
        <i></i><i></i>
      </NavLink>

      <div className="rt">
        <nav>
          <NavLink
            href="/"
            data-k="shop"
            aria-current={!bagActive ? 'page' : undefined}
          >
            Shop
          </NavLink>

          <NavLink
            href="/bag"
            data-k="bag"
            aria-current={bagActive ? 'page' : undefined}
          >
            Bag (<span id="cnt">{cnt}</span>)
          </NavLink>
        </nav>

        <div className="dots" role="group" aria-label="Theme">
          {DOTS.map(([t, bg, ci, label]) => (
            <button
              key={t}
              className="dot"
              style={{ background: bg, '--ci': ci }}
              aria-label={label}
              aria-pressed={theme === t ? 'true' : 'false'}
              onClick={() => setTheme(t)}
            />
          ))}
        </div>
      </div>
    </header>
  );
}