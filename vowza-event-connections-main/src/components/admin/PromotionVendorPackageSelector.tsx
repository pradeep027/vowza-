// ─── Promotion Vendor/Package Selector Component ────────────────────────────
// Allows admin to select main category → vendor → package for homepage promotions
// Uses the AUTHORITATIVE main category mapping (15 main marketplace categories)
// Groups profession types correctly (e.g., "Photography & Videography" includes photographers, videographers, cinematographers)
// Validates vendor/package relationships before saving

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MAIN_CATEGORIES, getProfessionTypesForMainCategory } from '@/config/mainCategoryMapping';
import { ChevronDown, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VendorOption {
  id: string;
  name: string;
  business_name?: string;
  stage_name?: string;
  profession: string;  // The profession type for this vendor
}

interface PackageOption {
  id: string;
  name: string;
  price?: number;
  price_per_plate?: number;
}

interface PromotionVendorPackageSelectorProps {
  onSelect: (data: {
    category: string;           // Main category ID (e.g., "photography-videography")
    provider_id: string;
    package_id: string;
    package_table: string;      // The specific table (e.g., "photography_packages")
    vendor_name: string;
    package_name: string;
  }) => void;
  disabled?: boolean;
}

export default function PromotionVendorPackageSelector({
  onSelect,
  disabled = false,
}: PromotionVendorPackageSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load vendors when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setVendors([]);
      setSelectedVendor('');
      setPackages([]);
      setSelectedPackage('');
      return;
    }

    const loadVendors = async () => {
      setLoading(true);
      setError('');
      try {
        // Get all profession types for this main category
        const professionTypes = getProfessionTypesForMainCategory(selectedCategory);
        
        if (professionTypes.length === 0) {
          setError(`Category not found or has no profession types`);
          setVendors([]);
          return;
        }

        console.log('[PromotionSelector] Loading vendors for category:', selectedCategory);
        console.log('[PromotionSelector] Profession types:', professionTypes);

        // Query providers matching ANY of these profession types (they all belong to the same main category)
        const { data: providers, error: provErr } = await supabase
          .from('provider_profiles')
          .select('id, user_id, profession, stage_name')
          .in('profession', professionTypes)  // Match ANY profession type in this main category
          .eq('verification_status', 'approved')
          .order('stage_name', { ascending: true })
          .limit(100);

        if (provErr) {
          console.error('[PromotionSelector] Provider query error:', provErr);
          throw provErr;
        }

        console.log('[PromotionSelector] Found', providers?.length, 'providers across profession types');

        if (!providers || providers.length === 0) {
          setError(`No vendors found for this category. Please ensure vendors exist and are verified.`);
          setVendors([]);
          return;
        }

        // Fetch profiles for these vendors
        const userIds = providers.map((p: any) => p.user_id);
        console.log('[PromotionSelector] Fetching profiles for', userIds.length, 'users');

        const { data: profilesData, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profileErr) {
          console.error('[PromotionSelector] Profile query error:', profileErr);
          throw profileErr;
        }

        console.log('[PromotionSelector] Fetched', profilesData?.length, 'profiles');

        // Map profiles by user_id
        const profileMap: Record<string, any> = {};
        (profilesData || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });

        // Combine provider + profile data
        const vendorOptions: VendorOption[] = providers
          .filter((p: any) => p.id)
          .map((p: any) => {
            const profile = profileMap[p.user_id];
            const vendorName = p.stage_name || profile?.full_name || 'Unnamed Vendor';
            return {
              id: p.id,
              name: vendorName,
              business_name: p.stage_name,
              stage_name: p.stage_name,
              profession: p.profession,
            };
          });

        console.log('[PromotionSelector] Processed vendor options:', vendorOptions);

        if (vendorOptions.length === 0) {
          setError(`No vendors found for this category. Please ensure vendors exist and are verified.`);
          setVendors([]);
        } else {
          setVendors(vendorOptions);
          setError('');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load vendors';
        console.error('[PromotionSelector] Vendor loading error:', err);
        setError(errorMsg);
        setVendors([]);
      } finally {
        setLoading(false);
      }
    };

    loadVendors();
  }, [selectedCategory]);

  // Load packages when vendor changes
  useEffect(() => {
    if (!selectedVendor || !selectedCategory) {
      setPackages([]);
      setSelectedPackage('');
      return;
    }

    const loadPackages = async () => {
      setLoading(true);
      setError('');
      try {
        // Get the vendor's profession type to determine which package table to query
        const vendor = vendors.find(v => v.id === selectedVendor);
        if (!vendor) {
          setError('Vendor not found');
          setPackages([]);
          return;
        }

        const profession = vendor.profession;
        
        // Map profession to package table
        const packageTableMap: Record<string, string> = {
          'photographer': 'photography_packages',
          'videographer': 'videography_packages',
          'cinematographer': 'videography_packages',
          'drone_operator': 'drone_packages',
          'music_band': 'band_packages',
          'maharashta_band': 'band_packages',
          'traditional_band': 'band_packages',
          'instrumental_artist': 'band_packages',
          'classical_musician': 'band_packages',
          'dj': 'dj_packages',
          'dancer': 'dancer_packages',
          'kuchipudi_dancer': 'dancer_packages',
          'classical_dancer': 'dancer_packages',
          'western_dancer': 'dancer_packages',
          'wedding_decorator': 'decoration_packages',
          'stage_decorator': 'decoration_packages',
          'event_decorator': 'decoration_packages',
          'makeup_artist': 'makeup_packages',
          'mehendi_artist': 'mehendi_packages',
          'anchor': 'anchor_packages',
          'catering_services': 'catering_packages',
        };

        const packageTable = packageTableMap[profession];
        
        if (!packageTable) {
          setError(`No packages available for ${profession}`);
          setPackages([]);
          return;
        }

        console.log('[PromotionSelector] Loading packages from table:', packageTable, 'for provider:', selectedVendor, 'profession:', profession);

        // Query packages from the appropriate table
        const { data, error: err } = await supabase
          .from(packageTable)
          .select('*')
          .eq('provider_id', selectedVendor)
          .in('status', ['active', 'draft'])
          .order('name', { ascending: true })
          .limit(50);

        if (err) {
          console.error('[PromotionSelector] Package query error:', err);
          throw err;
        }

        console.log('[PromotionSelector] Package query returned:', data?.length, 'packages');

        // Extract price from whichever field exists
        const packageOptions: PackageOption[] = (data || []).map((p: any) => {
          let displayPrice: number | undefined;

          if (p.package_price) displayPrice = p.package_price;
          else if (p.starting_price) displayPrice = p.starting_price;
          else if (p.price_per_plate) displayPrice = p.price_per_plate;
          else if (p.price) displayPrice = p.price;
          else if (p.full_day_price) displayPrice = p.full_day_price;
          else if (p.hourly_rate) displayPrice = p.hourly_rate;

          return {
            id: p.id,
            name: p.name,
            price: displayPrice,
          };
        });

        if (packageOptions.length === 0) {
          setError(`No packages found for this vendor. Please ensure the vendor has created packages.`);
          setPackages([]);
        } else {
          setPackages(packageOptions);
          setError('');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load packages';
        console.error('[PromotionSelector] Package loading error:', err);
        setError(errorMsg);
        setPackages([]);
      } finally {
        setLoading(false);
      }
    };

    loadPackages();
  }, [selectedVendor, selectedCategory, vendors]);

  // Notify parent when vendor and package are selected
  useEffect(() => {
    if (selectedVendor && selectedPackage && selectedCategory) {
      const vendor = vendors.find((v) => v.id === selectedVendor);
      const pkg = packages.find((p) => p.id === selectedPackage);

      if (vendor && pkg) {
        // Determine the package table from vendor's profession
        const packageTableMap: Record<string, string> = {
          'photographer': 'photography_packages',
          'videographer': 'videography_packages',
          'cinematographer': 'videography_packages',
          'drone_operator': 'drone_packages',
          'music_band': 'band_packages',
          'maharashta_band': 'band_packages',
          'traditional_band': 'band_packages',
          'instrumental_artist': 'band_packages',
          'classical_musician': 'band_packages',
          'dj': 'dj_packages',
          'dancer': 'dancer_packages',
          'kuchipudi_dancer': 'dancer_packages',
          'classical_dancer': 'dancer_packages',
          'western_dancer': 'dancer_packages',
          'wedding_decorator': 'decoration_packages',
          'stage_decorator': 'decoration_packages',
          'event_decorator': 'decoration_packages',
          'makeup_artist': 'makeup_packages',
          'mehendi_artist': 'mehendi_packages',
          'anchor': 'anchor_packages',
          'catering_services': 'catering_packages',
        };

        const packageTable = packageTableMap[vendor.profession];

        if (packageTable) {
          onSelect({
            category: selectedCategory,
            provider_id: selectedVendor,
            package_id: selectedPackage,
            package_table: packageTable,
            vendor_name: vendor.name,
            package_name: pkg.name,
          });
        }
      }
    }
  }, [selectedVendor, selectedPackage, selectedCategory, vendors, packages, onSelect]);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-1 p-4">
      <h3 className="text-sm font-semibold">Link to Main Category & Vendor/Package</h3>

      {error && (
        <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main Category Selector */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-2">
          Main Category
        </label>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedVendor('');
              setSelectedPackage('');
              setPackages([]);
            }}
            disabled={disabled}
            className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium pr-9 cursor-pointer disabled:opacity-50"
          >
            <option value="">Select Main Category</option>
            {MAIN_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
        </div>
        {selectedCategory && (
          <p className="text-xs text-muted-foreground mt-2">
            {MAIN_CATEGORIES.find(c => c.id === selectedCategory)?.description}
          </p>
        )}
      </div>

      {/* Vendor Selector */}
      {selectedCategory && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">
            Vendor {loading && vendors.length === 0 && <Loader2 className="inline h-3 w-3 animate-spin text-yellow-600 ml-1" />}
          </label>
          <div className="relative">
            <select
              value={selectedVendor}
              onChange={(e) => {
                setSelectedVendor(e.target.value);
                setSelectedPackage('');
                setPackages([]);
              }}
              disabled={disabled || vendors.length === 0 || loading}
              className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium pr-9 cursor-pointer disabled:opacity-50"
            >
              <option value="">Select Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Package Selector */}
      {selectedVendor && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">
            Package {loading && packages.length === 0 && <Loader2 className="inline h-3 w-3 animate-spin text-yellow-600 ml-1" />}
          </label>
          <div className="relative">
            <select
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              disabled={disabled || packages.length === 0 || loading}
              className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium pr-9 cursor-pointer disabled:opacity-50"
            >
              <option value="">Select Package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.price && ` (₹${p.price.toLocaleString('en-IN')})`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </div>
      )}

      {selectedVendor && selectedPackage && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          ✓ Promotion will link to exact vendor and package in {MAIN_CATEGORIES.find(c => c.id === selectedCategory)?.name}
        </div>
      )}
    </div>
  );
}
