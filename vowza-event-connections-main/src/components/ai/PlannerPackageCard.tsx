// ─── Planner Package Card — Display Admin Event Package in AI Chat ────────────
// Phase 2C: Shows matched packages after budget plan generation
//
// Features:
// - Display package tier (Silver/Gold/Platinum)
// - Show price breakdown (original → discount → final)
// - List included categories
// - "View Details" link to full package customization
// - "Book Now" button to booking flow

import React from 'react';
import { Package, ChevronRight, Tag, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminEventPackage } from '@/lib/packageMatcher';

interface PlannerPackageCardProps {
  package: AdminEventPackage;
  confidence?: number; // 0-100 match confidence
  onViewDetails?: (pkg: AdminEventPackage) => void;
  onBook?: (pkg: AdminEventPackage) => void;
}

export const PlannerPackageCard: React.FC<PlannerPackageCardProps> = ({
  package: pkg,
  confidence = 85,
  onViewDetails,
  onBook,
}) => {
  const tierColors: Record<string, string> = {
    silver: 'from-slate-100 to-slate-50 border-slate-300',
    gold: 'from-yellow-100 to-yellow-50 border-yellow-300',
    platinum: 'from-purple-100 to-purple-50 border-purple-300',
  };

  const tierBadgeColors: Record<string, string> = {
    silver: 'bg-slate-200 text-slate-800',
    gold: 'bg-yellow-200 text-yellow-900',
    platinum: 'bg-purple-200 text-purple-900',
  };

  const tierIcons: Record<string, string> = {
    silver: '💎',
    gold: '✨',
    platinum: '👑',
  };

  const discountAmount = pkg.original_price - pkg.final_price;

  return (
    <div className={`bg-gradient-to-br ${tierColors[pkg.tier.toLowerCase()]} border rounded-lg p-5 mb-3 shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header: Tier + Confidence */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tierIcons[pkg.tier.toLowerCase()]}</span>
          <div>
            <h3 className="font-bold text-lg text-gray-900">{pkg.name}</h3>
            <p className="text-sm text-gray-600">{pkg.description}</p>
          </div>
        </div>
        {confidence > 0 && (
          <div className={`${tierBadgeColors[pkg.tier.toLowerCase()]} px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap`}>
            {confidence}% match
          </div>
        )}
      </div>

      {/* Price Section */}
      <div className="bg-white/60 rounded-lg p-3 mb-3 border border-white/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-gray-600">
            <DollarSign size={16} />
            <span className="text-sm">Base Price</span>
          </div>
          <span className="text-sm text-gray-500 line-through">₹{(pkg.original_price / 100000).toFixed(1)}L</span>
        </div>

        {pkg.discount_percentage > 0 && (
          <div className="flex items-center justify-between mb-2 text-green-700 font-semibold">
            <span className="text-sm">Discount ({pkg.discount_percentage}%)</span>
            <span className="text-sm">-₹{(discountAmount / 100000).toFixed(1)}L</span>
          </div>
        )}

        <div className="border-t border-white pt-2 flex items-center justify-between">
          <span className="font-bold text-gray-900">Final Price</span>
          <span className="text-xl font-bold text-gray-900">₹{(pkg.final_price / 100000).toFixed(1)}L</span>
        </div>
      </div>

      {/* Included Items */}
      {pkg.included_items.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <Package size={14} /> Includes
          </p>
          <div className="flex flex-wrap gap-1">
            {pkg.included_items.slice(0, 4).map((item, idx) => (
              <span key={idx} className="text-xs bg-white/70 px-2 py-1 rounded border border-gray-200">
                {item}
              </span>
            ))}
            {pkg.included_items.length > 4 && (
              <span className="text-xs bg-white/70 px-2 py-1 rounded border border-gray-200">
                +{pkg.included_items.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Optional Items */}
      {pkg.optional_items.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <Tag size={14} /> Optional
          </p>
          <p className="text-xs text-gray-600">
            Choose from {pkg.optional_items.length} add-ons (e.g., {pkg.optional_items.slice(0, 2).join(', ')})
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onViewDetails?.(pkg)}
        >
          View Details
          <ChevronRight size={14} className="ml-1" />
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          onClick={() => onBook?.(pkg)}
        >
          Book Now
        </Button>
      </div>
    </div>
  );
};
