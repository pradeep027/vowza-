// ─── Event Package Selector — Customer Package Selection & Customization ──────
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, ShoppingCart, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventPackageCard } from '@/components/EventPackageCard';
import { useEventPackagesByEventType, useCreateEventPackageBooking, type AdminEventPackage } from '@/hooks/useEventPackages';

interface EventPackageSelectorProps {
  eventTypeId: string;
  eventTypeName: string;
}

interface CategoryInclusion {
  id: string;
  category_id: string;
  is_included: boolean;
  category_name?: string;
  category_icon?: string;
}

export const EventPackageSelector = ({ eventTypeId, eventTypeName }: EventPackageSelectorProps) => {
  const { user } = useAuth();
  const { data: packages, isLoading } = useEventPackagesByEventType(eventTypeId);
  const createBooking = useCreateEventPackageBooking();

  const [selectedPackage, setSelectedPackage] = useState<AdminEventPackage | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [inclusions, setInclusions] = useState<CategoryInclusion[]>([]);
  const [removedInclusions, setRemovedInclusions] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [loadingInclusions, setLoadingInclusions] = useState(false);

  // Load inclusions when package is selected
  useEffect(() => {
    if (selectedPackage && showModal) {
      loadInclusions();
    }
  }, [selectedPackage?.id, showModal]);

  const loadInclusions = async () => {
    if (!selectedPackage) return;
    setLoadingInclusions(true);
    try {
      const { data, error } = await supabase
        .from('admin_event_package_inclusions')
        .select(
          `
          id,
          category_id,
          is_included,
          artist_categories:category_id(name, icon)
        `
        )
        .eq('package_id', selectedPackage.id);

      if (error) throw error;

      const formatted = (data || []).map((inc: any) => ({
        id: inc.id,
        category_id: inc.category_id,
        is_included: inc.is_included,
        category_name: inc.artist_categories?.name || 'Unknown',
        category_icon: inc.artist_categories?.icon || '📦',
      }));

      setInclusions(formatted);
      setRemovedInclusions([]);
    } catch (err) {
      toast.error('Failed to load package details');
    } finally {
      setLoadingInclusions(false);
    }
  };

  const mandatoryInclusions = inclusions.filter((inc) => inc.is_included);
  const optionalInclusions = inclusions.filter((inc) => !inc.is_included);
  const canRemoveMore = removedInclusions.length < 2;

  const handleToggleRemoval = (categoryId: string) => {
    setRemovedInclusions((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      if (canRemoveMore) {
        return [...prev, categoryId];
      }
      return prev;
    });
  };

  const calculateFinalPrice = () => {
    if (!selectedPackage) return 0;

    // Base package price (already includes discount from database)
    let price = selectedPackage.final_price;

    // Subtract optional items that were removed (they're typically not charged if removed)
    // Note: This assumes optional items add to the price. Adjust logic if needed.
    // For now, we keep the package final_price as-is

    return price;
  };

  const handleBookPackage = async () => {
    if (!user) {
      toast.error('Please log in to book');
      return;
    }

    if (!selectedPackage || !eventDate) {
      toast.error('Please select a date and complete all required fields');
      return;
    }

    try {
      const finalPrice = calculateFinalPrice();

      await createBooking.mutateAsync({
        customer_id: user.id,
        package_id: selectedPackage.id,
        event_date: eventDate,
        event_location: eventLocation || null,
        guest_count: guestCount ? parseInt(guestCount) : null,
        package_price: selectedPackage.base_price,
        discount_applied: selectedPackage.discount_percentage,
        final_price: finalPrice,
        status: 'pending',
        payment_status: 'unpaid',
      });

      setShowModal(false);
      setSelectedPackage(null);
      setEventDate('');
      setEventLocation('');
      setGuestCount('');
      setRemovedInclusions([]);
      setInclusions([]);
    } catch (err) {
      console.error(err);
    }
  };

  if (!packages || packages.length === 0) {
    return null;
  }

  return (
    <>
      {/* Package Cards Grid */}
      <section className="py-12 md:py-16 bg-secondary/30 rounded-2xl p-6 mb-8">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
            {eventTypeName} Packages
          </h2>
          <p className="text-muted-foreground">Choose the perfect package for your event</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-64 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <EventPackageCard
                key={pkg.id}
                package={pkg}
                onSelect={(selected) => {
                  setSelectedPackage(selected);
                  setShowModal(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Package Detail Modal */}
      {showModal && selectedPackage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-[#1a1a24] border-b border-border/40 p-6 flex items-center justify-between">
              <div>
                <div className="inline-block mb-2 px-3 py-1 rounded-full bg-maroon/10 text-maroon text-[11px] font-bold">
                  {selectedPackage.tier}
                </div>
                <h2 className="text-2xl font-bold">{selectedPackage.display_name}</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Pricing */}
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Price</span>
                  <span className="font-semibold">₹{selectedPackage.base_price.toLocaleString('en-IN')}</span>
                </div>
                {selectedPackage.discount_percentage > 0 && (
                  <>
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-medium">Discount ({selectedPackage.discount_percentage}%)</span>
                      <span className="font-bold">
                        -₹{(selectedPackage.base_price * (selectedPackage.discount_percentage / 100)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </>
                )}
                <div className="border-t border-border/40 pt-2 flex justify-between">
                  <span className="text-lg font-bold">Final Price</span>
                  <span className="text-2xl font-bold text-maroon">
                    ₹{selectedPackage.final_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Inclusions */}
              {!loadingInclusions && inclusions.length > 0 && (
                <div className="space-y-4">
                  {/* Mandatory */}
                  {mandatoryInclusions.length > 0 && (
                    <div>
                      <h3 className="font-bold text-foreground mb-2">✓ Included Services</h3>
                      <div className="space-y-1">
                        {mandatoryInclusions.map((inc) => (
                          <div key={inc.category_id} className="flex items-center gap-2 text-sm p-2 bg-emerald-50 rounded-lg">
                            <span className="text-base">{inc.category_icon}</span>
                            <span className="text-emerald-900 font-medium">{inc.category_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optional */}
                  {optionalInclusions.length > 0 && (
                    <div>
                      <h3 className="font-bold text-foreground mb-2">
                        ◇ Optional Services
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          (You can remove up to 2)
                        </span>
                      </h3>
                      <div className="space-y-1">
                        {optionalInclusions.map((inc) => {
                          const isRemoved = removedInclusions.includes(inc.category_id);
                          return (
                            <button
                              key={inc.category_id}
                              onClick={() => handleToggleRemoval(inc.category_id)}
                              disabled={isRemoved === false && !canRemoveMore}
                              className={`w-full flex items-center gap-2 text-sm p-2 rounded-lg transition-all ${
                                isRemoved
                                  ? 'bg-red-50 border border-red-200 line-through opacity-50'
                                  : 'bg-amber-50 border border-amber-200 hover:border-amber-300'
                              } ${!canRemoveMore && !isRemoved ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className="text-base">{inc.category_icon}</span>
                              <span className="flex-1 text-amber-900">{inc.category_name}</span>
                              {isRemoved ? (
                                <Minus className="w-4 h-4 text-red-500" />
                              ) : (
                                <Plus className="w-4 h-4 text-amber-600" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Event Details Form */}
              <div className="border-t border-border/40 pt-6 space-y-4">
                <h3 className="font-bold">Event Details</h3>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Event Date *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="input-premium w-full text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Location</label>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Event venue/location"
                    className="input-premium w-full text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Guest Count</label>
                  <input
                    type="number"
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    placeholder="Expected guests"
                    className="input-premium w-full text-sm"
                  />
                </div>
              </div>

              {/* Book Button */}
              <Button
                onClick={handleBookPackage}
                disabled={createBooking.isPending || !eventDate}
                className="w-full bg-maroon text-white h-12 text-base font-bold"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Book Package Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
