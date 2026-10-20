import { motion } from 'motion/react';
import { Heart } from 'lucide-react';

export default function WishButton({ name, wished, onToggle, size = 16 }: { name: string; wished: boolean; onToggle: () => void; size?: number }) {
  return (
    <button onClick={onToggle} aria-pressed={wished} aria-label={wished ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      className="min-w-10 min-h-10 inline-flex items-center justify-center hover:text-brandRed active:scale-90 transition-transform rounded-full">
      <motion.span key={String(wished)} className="block" initial={{ scale: wished ? 0.6 : 1 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
        <Heart size={size} className={wished ? 'fill-brandRed text-brandRed' : ''} />
      </motion.span>
    </button>
  );
}
