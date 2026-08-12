import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';

/**
 * Floating "Book an Artist" CTA — bottom-right.
 * Hidden on /ai-planner route on mobile (interferes with planner input).
 */
export default function BookAnArtistFloat() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Hide on AI Planner page (mobile only handled via CSS below)
  const isPlanner = pathname === '/ai-planner';

  return (
    <button
      onClick={() => navigate('/artists')}
      className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[hsl(40,95%,56%)] to-[hsl(36,85%,44%)] text-[#1a1200] font-bold text-sm shadow-[0_4px_20px_hsl(40,95%,52%,0.4)] hover:shadow-[0_6px_28px_hsl(40,95%,52%,0.55)] hover:scale-[1.04] active:scale-[0.97] transition-all duration-200 max-sm:px-4 max-sm:py-2.5 max-sm:text-xs ${isPlanner ? 'max-lg:hidden' : ''}`}
      aria-label="Book an Artist"
    >
      <CalendarDays className="w-4 h-4 max-sm:w-3.5 max-sm:h-3.5" />
      <span className="max-[380px]:hidden">Book an Artist</span>
      <span className="hidden max-[380px]:inline">Book</span>
      <ArrowRight className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3" />
    </button>
  );
}
