import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { BasicInfoStep } from '@/components/onboarding/steps/BasicInfoStep';
import { CategoryStep } from '@/components/onboarding/steps/CategoryStep';
import { PricingStep } from '@/components/onboarding/steps/PricingStep';
import { PortfolioStep } from '@/components/onboarding/steps/PortfolioStep';
import { ReviewStep } from '@/components/onboarding/steps/ReviewStep';
import { resolveDashboard } from '@/hooks/useDashboardLink';
import { useImageUpload } from '@/hooks/useImageUpload';
import type { ProfessionType } from '@/data/artistCategories';

const steps = [
  { title: 'Basic Info', description: 'Your profile details' },
  { title: 'Category', description: 'Select your talent' },
  { title: 'Pricing', description: 'Set your rates' },
  { title: 'Portfolio', description: 'Showcase work' },
  { title: 'Review', description: 'Final check' },
];

interface PortfolioItem {
  id: string;
  file?: File;
  url: string;
  type: 'image' | 'video' | 'audio';
  title: string;
}

const ArtistOnboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const { uploadImage, isUploading: isUploadingAvatar } = useImageUpload({ bucket: 'provider-media', folder: 'avatars' });
  const { uploadImage: uploadCover, isUploading: isUploadingCover } = useImageUpload({ bucket: 'provider-media', folder: 'covers' });
  const { uploadMultiple, isUploading: isUploadingPortfolio } = useImageUpload({ bucket: 'provider-media', folder: 'portfolio' });
  const { uploadMultiple: uploadGallery, isUploading: isUploadingGallery } = useImageUpload({ bucket: 'provider-media', folder: 'gallery' });

  // Form state
  const [basicInfo, setBasicInfo] = useState({
    fullName: '',
    stageName: '',
    phone: '',
    city: '',
    state: '',
    area: '',
    experienceYears: '',
    languages: [] as string[],
    bio: '',
    avatarUrl: '',
    coverImageUrl: '',
  });

  const [selectedCategory, setSelectedCategory] = useState<ProfessionType | ''>('');
  const [categoryDetails, setCategoryDetails] = useState<Record<string, any>>({});

  const [pricingInfo, setPricingInfo] = useState({
    pricingType: 'per_event',
    priceMin: '',
    priceMax: '',
    specialties: [] as string[],
    isAvailable: true,
    whatsapp: '',
    serviceRadius: 50,
    instantBooking: false,
  });

  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [pendingGalleryFiles, setPendingGalleryFiles] = useState<File[]>([]);
  const [enableNotifications, setEnableNotifications] = useState(true);

  // Pending file uploads
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Load existing profile data
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setBasicInfo(prev => ({
              ...prev,
              fullName: data.full_name || '',
              phone: data.phone || '',
              city: data.city || '',
              area: data.area || '',
              avatarUrl: data.avatar_url || '',
            }));
          }
        });
    }
  }, [user]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!basicInfo.fullName.trim()) {
          toast.error('Please enter your full name');
          return false;
        }
        if (!basicInfo.city.trim()) {
          toast.error('Please enter your city');
          return false;
        }
        return true;
      case 1:
        if (!selectedCategory) {
          toast.error('Please select a category');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    setIsSubmitting(true);

    try {
      let avatarUrl = basicInfo.avatarUrl;
      let coverUrl = basicInfo.coverImageUrl;

      // Upload pending files
      if (pendingAvatarFile) {
        const result = await uploadImage(pendingAvatarFile, user.id);
        if (result) avatarUrl = result.url;
      }

      if (pendingCoverFile) {
        const result = await uploadCover(pendingCoverFile, user.id);
        if (result) coverUrl = result.url;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: basicInfo.fullName,
          phone: basicInfo.phone,
          city: basicInfo.city,
          area: basicInfo.area,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Upload gallery images
      let uploadedGalleryUrls: string[] = [...galleryUrls];
      if (pendingGalleryFiles.length > 0) {
        const results = await uploadGallery(pendingGalleryFiles, user.id);
        uploadedGalleryUrls = [...uploadedGalleryUrls, ...results.map(r => r.url)];
      }

      // Create provider profile
      const { data: providerData, error: providerError } = await supabase
        .from('provider_profiles')
        .insert({
          user_id: user.id,
          profession: selectedCategory as ProfessionType,
          stage_name: basicInfo.stageName || null,
          cover_image_url: coverUrl || null,
          experience_years: parseInt(basicInfo.experienceYears) || 0,
          languages: basicInfo.languages,
          bio: basicInfo.bio,
          pricing_type: pricingInfo.pricingType,
          price_min: parseInt(pricingInfo.priceMin) || null,
          price_max: parseInt(pricingInfo.priceMax) || null,
          specialties: pricingInfo.specialties,
          is_available: pricingInfo.isAvailable,
          category_details: categoryDetails,
          onboarding_completed: true,
          // New fields
          whatsapp: pricingInfo.whatsapp || null,
          service_radius: pricingInfo.serviceRadius || 50,
          instant_booking: pricingInfo.instantBooking,
          gallery_urls: uploadedGalleryUrls.length > 0 ? uploadedGalleryUrls : null,
        } as any)
        .select()
        .single();

      if (providerError) {
        if (providerError.code === '23505') {
          toast.error('You are already registered as a provider');
        } else {
          throw providerError;
        }
        return;
      }

      // Upload portfolio items
      if (portfolioItems.length > 0 && providerData) {
        const portfolioFiles = portfolioItems.filter(item => item.file).map(item => item.file!);
        const uploadedUrls = await uploadMultiple(portfolioFiles, user.id);
        
        if (uploadedUrls.length > 0) {
          const portfolioInserts = uploadedUrls.map((result, idx) => ({
            provider_id: providerData.id,
            media_url: result.url,
            media_type: portfolioItems[idx]?.type || 'image',
            title: portfolioItems[idx]?.title || null,
          }));

          await supabase.from('portfolio_items').insert(portfolioInserts);
        }
      }

      // Add provider role
      await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'provider' });

      // Insert provider role then navigate to the correct dashboard
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = rolesData?.map(r => r.role as string) ?? ['provider'];
      const destination = resolveDashboard(roles);

      toast.success('🎉 Welcome to Vowza! Your profile is now live.');
      navigate(destination);
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-maroon border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((currentStep / (steps.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-surface-2">
      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border/60 shadow-xs">
        <div className="container px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AppLogo size="sm" />
            <span className="hidden sm:inline text-muted-foreground mx-1">·</span>
            <span className="hidden sm:inline text-sm text-muted-foreground">Artist Registration</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-gradient-maroon rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <span>{progressPct}% complete</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </header>

      <div className="pt-14 min-h-screen flex">
        {/* ── Left sidebar — step list (desktop) ── */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-border/50 bg-surface-1 p-8 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-lg font-display font-bold text-foreground mb-1">Join as an Artist</h2>
            <p className="text-sm text-muted-foreground">Complete your profile in 5 easy steps</p>
          </div>

          <div className="space-y-2 flex-1">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                  i === currentStep
                    ? "bg-maroon/8 border border-maroon/20"
                    : i < currentStep
                    ? "opacity-70"
                    : "opacity-40"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all",
                  i < currentStep
                    ? "bg-emerald-500 text-white"
                    : i === currentStep
                    ? "bg-gradient-maroon text-white shadow-maroon"
                    : "bg-secondary text-muted-foreground border border-border"
                )}>
                  {i < currentStep ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", i === currentStep ? "text-maroon" : "text-foreground")}>{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="mt-8 p-4 rounded-2xl bg-surface-2 border border-border/50 space-y-3">
            {[
              "Free to register",
              "Appear in marketplace after approval",
              "No commission until first booking",
            ].map(t => (
              <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main form area ── */}
        <main className="flex-1 flex flex-col items-center justify-start px-4 py-8 md:py-12">
          <div className="w-full max-w-2xl">
            {/* Mobile step indicator */}
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              {steps.map((_, i) => (
                <div key={i} className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-500",
                  i <= currentStep ? "bg-maroon" : "bg-secondary"
                )} />
              ))}
            </div>

            {/* Step label */}
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Step {currentStep + 1} of {steps.length}
              </p>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                {steps[currentStep].title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{steps[currentStep].description}</p>
            </div>

            {/* Form card */}
            <div className="bg-surface-1 rounded-3xl border border-border/60 shadow-lg p-6 md:p-8">
              {currentStep === 0 && (
                <BasicInfoStep
                  data={basicInfo}
                  onChange={(data) => setBasicInfo((prev) => ({ ...prev, ...data }))}
                  onAvatarFile={setPendingAvatarFile}
                  onCoverFile={setPendingCoverFile}
                  isUploadingAvatar={isUploadingAvatar}
                  isUploadingCover={isUploadingCover}
                />
              )}
              {currentStep === 1 && (
                <CategoryStep
                  selectedCategory={selectedCategory}
                  categoryDetails={categoryDetails}
                  onCategoryChange={setSelectedCategory}
                  onDetailsChange={setCategoryDetails}
                />
              )}
              {currentStep === 2 && (
                <PricingStep
                  data={pricingInfo}
                  onChange={(data) => setPricingInfo((prev) => ({ ...prev, ...data }))}
                />
              )}
              {currentStep === 3 && (
                <PortfolioStep
                  items={portfolioItems}
                  onChange={setPortfolioItems}
                  onUpload={async () => {}}
                  isUploading={isUploadingPortfolio}
                  onGalleryFiles={setPendingGalleryFiles}
                />
              )}
              {currentStep === 4 && (
                <ReviewStep
                  data={{
                    ...basicInfo,
                    profession: selectedCategory,
                    ...pricingInfo,
                    portfolioCount: portfolioItems.length,
                    galleryCount: pendingGalleryFiles.length + galleryUrls.length,
                    enableNotifications,
                  }}
                  onNotificationChange={setEnableNotifications}
                  onEdit={setCurrentStep}
                />
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                <button
                  type="button"
                  onClick={currentStep === 0 ? () => navigate('/') : handleBack}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {currentStep === 0 ? 'Cancel' : 'Back'}
                </button>

                {currentStep < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="btn-primary flex items-center gap-2 py-2.5 px-6 text-sm"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="btn-gold flex items-center gap-2 py-2.5 px-6 text-sm"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating Profile…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Complete Registration</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ArtistOnboarding;
