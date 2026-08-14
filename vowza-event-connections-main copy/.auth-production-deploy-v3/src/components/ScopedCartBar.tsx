import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

interface ScopedCartBarProps {
  providerId: string;
  category: string;
}

/**
 * Compact "View Cart (X) — Checkout" button.
 * Shows only when the current vendor+category scope has items in cart.
 * Reusable across ALL category menus — compact, centered design.
 */
export default function ScopedCartBar({ providerId, category }: ScopedCartBarProps) {
  const { getScopedCount, getScopedTotal } = useCart();
  const navigate = useNavigate();

  const count = getScopedCount(providerId, category);
  const total = getScopedTotal(providerId, category);

  if (count === 0) return null;

  return (
    <div className="flex justify-center mt-5 mb-2">
      <button
        onClick={() => navigate(`/cart?vendor=${providerId}&category=${category}`)}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#8B1538] text-white text-sm font-semibold shadow-md hover:bg-[#70102d] transition-all active:scale-[0.97]"
      >
        <ShoppingBag className="w-4 h-4" />
        <span>View Cart ({count}) — ₹{total.toLocaleString('en-IN')}</span>
      </button>
    </div>
  );
}
