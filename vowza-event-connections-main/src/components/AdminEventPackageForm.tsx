// ─── Admin Event Package Form ─────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AdminEventPackage } from '@/hooks/useEventPackages';

interface EventType {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface AdminEventPackageFormProps {
  package?: AdminEventPackage;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const TIERS = ['Silver', 'Gold', 'Platinum'] as const;

export const AdminEventPackageForm = ({ package: pkg, onSave, onCancel, isLoading }: AdminEventPackageFormProps) => {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTier, setSelectedTier] = useState<'Silver' | 'Gold' | 'Platinum'>(pkg?.tier || 'Silver');
  const [formData, setFormData] = useState({
    event_type_id: pkg?.event_type_id || '',
    display_name: pkg?.display_name || '',
    description: pkg?.description || '',
    base_price: pkg?.base_price?.toString() || '',
    discount_percentage: pkg?.discount_percentage?.toString() || '0',
    max_category_selections: pkg?.max_category_selections?.toString() || '3',
    max_professionals_per_category: pkg?.max_professionals_per_category?.toString() || '2',
    is_active: pkg?.is_active ?? true,
  });
  const [selectedCategories, setSelectedCategories] = useState<{ [key: string]: 'mandatory' | 'optional' | null }>({});
  const [loadingData, setLoadingData] = useState(true);

  // Load event types and categories
  useEffect(() => {
    const loadData = async () => {
      try {
        const [etRes, catRes] = await Promise.all([
          supabase.from('event_types').select('id, name').order('name'),
          supabase.from('artist_categories').select('id, name, icon').order('name'),
        ]);

        if (etRes.data) setEventTypes(etRes.data);
        if (catRes.data) setCategories(catRes.data);

        // Load existing inclusions if editing
        if (pkg?.id) {
          const { data: inclusions } = await supabase
            .from('admin_event_package_inclusions')
            .select('category_id, is_included')
            .eq('package_id', pkg.id);

          if (inclusions) {
            const map: { [key: string]: 'mandatory' | 'optional' } = {};
            inclusions.forEach((inc) => {
              map[inc.category_id] = inc.is_included ? 'mandatory' : 'optional';
            });
            setSelectedCategories(map);
          }
        }
      } catch (err) {
        toast.error('Failed to load form data');
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [pkg?.id]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) => {
      const current = prev[categoryId];
      if (current === 'mandatory') {
        const { [categoryId]: _, ...rest } = prev;
        return rest;
      } else if (current === 'optional') {
        return { ...prev, [categoryId]: 'mandatory' };
      } else {
        return { ...prev, [categoryId]: 'optional' };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.event_type_id || !formData.display_name || !formData.base_price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const basePrice = parseFloat(formData.base_price);
      const discountPct = parseFloat(formData.discount_percentage) || 0;

      if (basePrice <= 0) {
        toast.error('Base price must be greater than 0');
        return;
      }

      if (discountPct < 0 || discountPct > 100) {
        toast.error('Discount must be between 0 and 100%');
        return;
      }

      const submitData = {
        ...formData,
        tier: selectedTier,
        base_price: basePrice,
        discount_percentage: discountPct,
        max_category_selections: parseInt(formData.max_category_selections) || 3,
        max_professionals_per_category: parseInt(formData.max_professionals_per_category) || 2,
        selected_categories: selectedCategories,
      };

      await onSave(submitData);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  if (loadingData) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  const finalPrice = parseFloat(formData.base_price || '0') * (1 - (parseFloat(formData.discount_percentage || '0') / 100));

  return (
    <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-gold/30 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{pkg ? 'Edit Package' : 'New Package'}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Type */}
        <div>
          <Label className="text-xs font-bold">Event Type *</Label>
          <select
            value={formData.event_type_id}
            onChange={(e) => setFormData({ ...formData, event_type_id: e.target.value })}
            className="input-premium w-full text-sm mt-1"
          >
            <option value="">Select event type</option>
            {eventTypes.map((et) => (
              <option key={et.id} value={et.id}>
                {et.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tier Selection */}
        <div>
          <Label className="text-xs font-bold">Tier *</Label>
          <div className="flex gap-3 mt-2">
            {TIERS.map((tier) => (
              <label key={tier} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tier"
                  value={tier}
                  checked={selectedTier === tier}
                  onChange={(e) => setSelectedTier(e.target.value as any)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">{tier}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Display Name */}
        <div>
          <Label className="text-xs font-bold">Package Name *</Label>
          <Input
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g., Silver Wedding Package"
            className="text-sm mt-1"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="text-xs font-bold">Description</Label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of this package"
            rows={3}
            className="input-premium w-full text-sm mt-1 resize-none"
          />
        </div>

        {/* Pricing Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold">Base Price (₹) *</Label>
            <Input
              type="number"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
              placeholder="0"
              className="text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-bold">Discount (%)</Label>
            <Input
              type="number"
              value={formData.discount_percentage}
              onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
              min="0"
              max="100"
              placeholder="0"
              className="text-sm mt-1"
            />
          </div>
        </div>

        {/* Final Price Display */}
        <div className="bg-secondary p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">
            Base: ₹{parseFloat(formData.base_price || '0').toLocaleString('en-IN')}
            {parseFloat(formData.discount_percentage || '0') > 0 && (
              <>
                {' '}
                → Discount: {formData.discount_percentage}% → You Save: ₹
                {(parseFloat(formData.base_price || '0') * (parseFloat(formData.discount_percentage || '0') / 100)).toLocaleString('en-IN')}
              </>
            )}
          </div>
          <div className="text-lg font-bold text-foreground">
            Final Price: ₹{finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Customization Limits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-bold">Max Categories to Select</Label>
            <Input
              type="number"
              value={formData.max_category_selections}
              onChange={(e) => setFormData({ ...formData, max_category_selections: e.target.value })}
              min="1"
              className="text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-bold">Max Vendors per Category</Label>
            <Input
              type="number"
              value={formData.max_professionals_per_category}
              onChange={(e) => setFormData({ ...formData, max_professionals_per_category: e.target.value })}
              min="1"
              className="text-sm mt-1"
            />
          </div>
        </div>

        {/* Category Inclusions */}
        <div>
          <Label className="text-xs font-bold mb-3 block">Service Inclusions</Label>
          <div className="space-y-2 max-h-64 overflow-y-auto border border-border/60 rounded-lg p-3">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories available</p>
            ) : (
              categories.map((cat) => {
                const status = selectedCategories[cat.id];
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryToggle(cat.id)}
                    className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                      status === 'mandatory'
                        ? 'bg-maroon/10 border border-maroon/30 text-maroon'
                        : status === 'optional'
                          ? 'bg-amber-50 border border-amber-200 text-amber-900'
                          : 'bg-secondary border border-border/40 text-muted-foreground hover:bg-secondary/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cat.icon}</span>
                      <span className="flex-1">{cat.name}</span>
                      <span className="text-[10px] font-bold">
                        {status === 'mandatory' ? '✓ MANDATORY' : status === 'optional' ? '◇ OPTIONAL' : '—'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Click to toggle: MANDATORY (red) → OPTIONAL (amber) → NONE (gray)
          </p>
        </div>

        {/* Active Status */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-foreground">Publish (active)</span>
        </label>

        {/* Submit Button */}
        <Button onClick={handleSubmit} disabled={isLoading} className="w-full bg-maroon text-white">
          <Save className="w-4 h-4 mr-2" />
          {pkg ? 'Save Changes' : 'Create Package'}
        </Button>
      </form>
    </div>
  );
};
