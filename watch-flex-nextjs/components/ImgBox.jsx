'use client';
import { PHW } from '@/lib/site';

export const onImgError = (e) => {
  if (e.currentTarget.src !== PHW) e.currentTarget.src = PHW;
};

export default function ImgBox({ p, src, ar = '4/5' }) {
  return (
    <div className="im" role="img" aria-label={p.name} style={{ '--ar': ar }}>
      <img src={src || p.images[0] || PHW} alt="" draggable={false} onError={onImgError} />
    </div>
  );
}
