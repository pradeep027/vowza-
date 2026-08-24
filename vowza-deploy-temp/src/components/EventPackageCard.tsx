// ─── Event Package Card — Customer Display ────────────────────────────────────
import { Gift, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AdminEventPackage } from '@/hooks/useEventPackages';

interface EventPackageCardProps {
  package: AdminEventPackage;
  inclusions?: Array<{ category_id: string; is_included: boolean }>;
  onSelect: (pkg: AdminEventPackage) => void;
}

const TIER_COLORS = {
  Silver: 'bg-slate-100 text-slate-900 border-slate-300',
  Gold: 'bg-amber-100 text-amber-900 border-amber-300',
  Platinum: 'bg-purple-100 text-purple-900 border-purple-300',
};

const TIER_ACCENT = {
  Silver: 'from-slate-400 to-slate-600',
  Gold: 'from-amber-400 to-amber-600',
  Platinum: 'from-purple-400 to-purple-600',
};

export const EventPackageCard = ({ package: pkg, onSelect }: EventPackageCardProps) => {
  const basePrice = pkg.base_price;
  const discount = pkg.discount_percentage;
  const finalPrice = pkg.final_price;
  const savings = basePrice - finalPrice;

  return (
    <button
      onClick={() => onSelect(pkg)}
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#1a1a24] border border-border/60 hover:border-gold/30 hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 p-6 text-left w-full"
    >
      {/* Gradient accent */}
      <div
        className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full bg-gradient-to-bl ${TIER_ACCENT[pkg.tier]} opacity-10 group-hover:opacity-20 transition-opacity`}
      />

      {/* Icon */}
      <div className="mb-4 inline-block">
        <Gift className="w-8 h-8 text-maroon" />
      </div>

      {/* Tier Badge */}
      <div className="mb-3 inline-flex">
        <Badge className={`${TIER_COLORS[pkg.tier]} border font-bold text-[11px]`}>{pkg.tier}</Badge>
      </div>

      {/* Package Name */}
      <h3 className="text-lg font-display font-semibold text-foreground mb-2 group-hover:text-maroon transition-colors">
        {pkg.display_name}
      </h3>

      {/* Description */}
      {pkg.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{pkg.description}</p>
      )}

      {/* Pricing Section */}
      <div className="bg-secondary/50 rounded-lg p-3 mb-4 space-y-1.5">
        {/* Original Price */}
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted-foreground">Original Price</span>
          <span className="font-semibold text-foreground">₹{basePrice.toLocaleString('en-IN')}</span>
        </div>

        {/* Discount */}
        {discount > 0 && (
          <>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium text-emerald-700">Discount</span>
              <span className="font-bold text-emerald-700">{discount}%</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium text-emerald-700">You Save</span>
              <span className="font-bold text-emerald-700">₹{savings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="border-t border-border/40 pt-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-maroon">Final Price</span>
                <span className="text-lg font-bold text-maroon">
                  ₹{finalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </>
        )}

        {/* No Discount */}
        {discount === 0 && (
          <div className="flex justify-between items-baseline pt-1.5">
            <span className="text-xs font-bold text-maroon">Price</span>
            <span className="text-lg font-bold text-maroon">
              ₹{finalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>

      {/* Select Button */}
      <Button className="w-full bg-maroon text-white hover:opacity-90 group-hover:shadow-lg transition-all">
        View & Select
        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
      </Button>
    </button>
  );
};
