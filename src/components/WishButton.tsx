import { motion } from 'motion/react';
import { Heart } from 'lucide-react';

export default function WishButton({ name, wished, onToggle, size = 16 }: { name: string; wished: boolean; onToggle: () => void; size?: number }) {
  return (
    <button onClick={onToggle} aria-pressed={wished} aria-label={wished ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      className="p-2.5 -m-2.5 hover:text-brandRed active:scale-90 transition-transform">
      <motion.span key={String(wished)} className="block" initial={{ scale: wished ? 0.6 : 1 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
        <Heart size={size} className={wished ? 'fill-brandRed text-brandRed' : ''} />
      </motion.span>
    </button>
  );
}
