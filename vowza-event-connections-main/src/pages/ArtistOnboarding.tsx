import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Artist Registration</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Join Vowza as an Artist
          </h1>
          <p className="text-muted-foreground mt-2">
            Create your profile and start receiving bookings
          </p>
        </div>

        {/* Progress */}
        <OnboardingProgress currentStep={currentStep} totalSteps={steps.length} steps={steps} />

        {/* Form Card */}
        <Card className="shadow-elevated border-border/50">
          <CardContent className="p-6 md:p-8">
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

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep === 0 ? () => navigate('/') : handleBack}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {currentStep === 0 ? 'Cancel' : 'Back'}
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button onClick={handleNext} className="gap-2 bg-gradient-gold hover:opacity-90">
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="gap-2 bg-gradient-gold hover:opacity-90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Profile...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Complete Registration
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ArtistOnboarding;
