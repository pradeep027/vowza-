import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Music, Camera, Palette, Users, Sparkles, ArrowLeft, Upload, FileText, CheckCircle, XCircle, Shield, Send, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { resolveDashboard } from '@/hooks/useDashboardLink';

type ProfessionType = Database['public']['Enums']['profession_type'] | string;

const professionOptions: { value: ProfessionType; label: string; icon: React.ReactNode }[] = [
  { value: 'music_band', label: 'Music Band', icon: <Music className="w-4 h-4" /> },
  { value: 'traditional_band', label: 'Traditional Band', icon: <Music className="w-4 h-4" /> },
  { value: 'maharashtra_band', label: 'Maharashtra Band', icon: <Music className="w-4 h-4" /> },
  { value: 'dj', label: 'DJ', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'singer', label: 'Singer', icon: <Music className="w-4 h-4" /> },
  { value: 'instrumental_artist', label: 'Instrumental Artist', icon: <Music className="w-4 h-4" /> },
  { value: 'classical_musician', label: 'Classical Musician', icon: <Music className="w-4 h-4" /> },
  { value: 'photographer', label: 'Photographer', icon: <Camera className="w-4 h-4" /> },
  { value: 'videographer', label: 'Videographer', icon: <Camera className="w-4 h-4" /> },
  { value: 'cinematographer', label: 'Cinematographer', icon: <Camera className="w-4 h-4" /> },
  { value: 'drone_operator', label: 'Drone Operator', icon: <Camera className="w-4 h-4" /> },
  { value: 'dancer', label: 'Dancer', icon: <Users className="w-4 h-4" /> },
  { value: 'choreographer', label: 'Choreographer', icon: <Users className="w-4 h-4" /> },
  { value: 'kuchipudi_dancer', label: 'Kuchipudi Dancer', icon: <Users className="w-4 h-4" /> },
  { value: 'classical_dancer', label: 'Classical Dancer', icon: <Users className="w-4 h-4" /> },
  { value: 'western_dancer', label: 'Western Dancer', icon: <Users className="w-4 h-4" /> },
  { value: 'event_decorator', label: 'Event Decorator', icon: <Palette className="w-4 h-4" /> },
  { value: 'wedding_decorator', label: 'Wedding Decorator', icon: <Palette className="w-4 h-4" /> },
  { value: 'stage_decorator', label: 'Stage Decorator', icon: <Palette className="w-4 h-4" /> },
  { value: 'makeup_artist', label: 'Makeup Artist', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'mehendi_artist', label: 'Mehendi Artist', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'anchor', label: 'Anchor', icon: <Music className="w-4 h-4" /> },
  { value: 'host', label: 'Host', icon: <Music className="w-4 h-4" /> },
  { value: 'magician', label: 'Magician', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'stand_up_comedian', label: 'Stand-up Comedian', icon: <Music className="w-4 h-4" /> },
  { value: 'celebrity_artist', label: 'Celebrity Artist', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'live_performer', label: 'Live Performer', icon: <Music className="w-4 h-4" /> },
  { value: 'folk_artist', label: 'Folk Artist', icon: <Music className="w-4 h-4" /> },
  { value: 'lighting_services', label: 'Lighting Services', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'sound_services', label: 'Sound Services', icon: <Music className="w-4 h-4" /> },
  { value: 'event_planner', label: 'Event Planner', icon: <Users className="w-4 h-4" /> },
  { value: 'wedding_planner', label: 'Wedding Planner', icon: <Users className="w-4 h-4" /> },
  { value: 'catering_services', label: 'Catering Services', icon: <Users className="w-4 h-4" /> },
  { value: 'event_support', label: 'Event Support', icon: <Users className="w-4 h-4" /> },
];

interface DocumentUpload {
  type: string;
  file: File | null;
  url: string;
  number: string;
}

interface PortfolioItem {
  file: File | null;
  url: string;
  type: 'image' | 'video';
  description: string;
}

const ProviderRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [profession, setProfession] = useState<ProfessionType | ''>('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [currentOtp, setCurrentOtp] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [pricingPackages, setPricingPackages] = useState([
    { name: 'Silver Package', price: '', description: '', duration: '' },
    { name: 'Gold Package', price: '', description: '', duration: '' },
    { name: 'Premium Package', price: '', description: '', duration: '' }
  ]);
  const [travelCharges, setTravelCharges] = useState('');
  const [extraCharges, setExtraCharges] = useState('');
  const [bio, setBio] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [coverBannerUrl, setCoverBannerUrl] = useState('');
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [state, setState] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [languages, setLanguages] = useState('');
  const [availableDates, setAvailableDates] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [youtube, setYoutube] = useState('');
  const [website, setWebsite] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([
    { file: null, url: '', type: 'image', description: '' },
    { file: null, url: '', type: 'image', description: '' },
    { file: null, url: '', type: 'video', description: '' }
  ]);
  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { type: 'aadhaar', file: null, url: '', number: '' },
    { type: 'pan', file: null, url: '', number: '' },
    { type: 'government_id', file: null, url: '', number: '' }
  ]);
  const [uploadingDoc, setUploadingDoc] = useState<number | null>(null);
  const [uploadingPortfolio, setUploadingPortfolio] = useState<number | null>(null);
  const [timeSlots, setTimeSlots] = useState([
    { day: 0, start: '', end: '', active: false }, // Sunday
    { day: 1, start: '', end: '', active: false }, // Monday
    { day: 2, start: '', end: '', active: false }, // Tuesday
    { day: 3, start: '', end: '', active: false }, // Wednesday
    { day: 4, start: '', end: '', active: false }, // Thursday
    { day: 5, start: '', end: '', active: false }, // Friday
    { day: 6, start: '', end: '', active: false }, // Saturday
  ]);

  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // ── Form persistence key ───────────────────────────────────────────────────
  const FORM_KEY = 'vowza_provider_reg_draft';

  const saveFormToStorage = () => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({
        fullName, phone, organizationName, profession, experienceYears,
        priceMin, priceMax, travelCharges, extraCharges, bio,
        city, area, state, specialties, languages, gstNumber,
        instagram, facebook, youtube, website,
        bankAccount, bankName, ifscCode, upiId,
        profilePictureUrl, coverBannerUrl,
        pricingPackages, timeSlots,
      }));
    } catch { /* storage full — ignore */ }
  };

  const clearFormStorage = () => {
    try { localStorage.removeItem(FORM_KEY); } catch { /* ignore */ }
  };

  // Restore form from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORM_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.fullName)        setFullName(d.fullName);
      if (d.phone)           setPhone(d.phone);
      if (d.organizationName) setOrganizationName(d.organizationName);
      if (d.profession)      setProfession(d.profession);
      if (d.experienceYears) setExperienceYears(d.experienceYears);
      if (d.priceMin)        setPriceMin(d.priceMin);
      if (d.priceMax)        setPriceMax(d.priceMax);
      if (d.travelCharges)   setTravelCharges(d.travelCharges);
      if (d.extraCharges)    setExtraCharges(d.extraCharges);
      if (d.bio)             setBio(d.bio);
      if (d.city)            setCity(d.city);
      if (d.area)            setArea(d.area);
      if (d.state)           setState(d.state);
      if (d.specialties)     setSpecialties(d.specialties);
      if (d.languages)       setLanguages(d.languages);
      if (d.gstNumber)       setGstNumber(d.gstNumber);
      if (d.instagram)       setInstagram(d.instagram);
      if (d.facebook)        setFacebook(d.facebook);
      if (d.youtube)         setYoutube(d.youtube);
      if (d.website)         setWebsite(d.website);
      if (d.bankAccount)     setBankAccount(d.bankAccount);
      if (d.bankName)        setBankName(d.bankName);
      if (d.ifscCode)        setIfscCode(d.ifscCode);
      if (d.upiId)           setUpiId(d.upiId);
      if (d.profilePictureUrl) setProfilePictureUrl(d.profilePictureUrl);
      if (d.coverBannerUrl)  setCoverBannerUrl(d.coverBannerUrl);
      if (d.pricingPackages) setPricingPackages(d.pricingPackages);
      if (d.timeSlots)       setTimeSlots(d.timeSlots);
    } catch { /* corrupt storage — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save form whenever any field changes
  useEffect(() => {
    if (user) saveFormToStorage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, phone, organizationName, profession, experienceYears, priceMin, priceMax,
      travelCharges, extraCharges, bio, city, area, state, specialties, languages,
      gstNumber, instagram, facebook, youtube, website, bankAccount, bankName, ifscCode,
      upiId, profilePictureUrl, coverBannerUrl, pricingPackages, timeSlots]);

  useEffect(() => {
    if (!loading && !user) {      navigate('/auth');
      return;
    }

    // Check email verification
    if (user && !user.email_confirmed_at) {
      toast.error('Please verify your email before registering as a provider');
      navigate('/auth');
      return;
    }

    // Pre-fill user data if available
    if (user) {
      // Fetch user profile to pre-fill data
      fetchUserProfile();
    }
  }, [user, loading, navigate]);

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url, city, area')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setCity(profile.city || '');
        setArea(profile.area || '');
        setProfilePictureUrl(profile.avatar_url || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_DOC_TYPES   = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  const MAX_IMAGE_SIZE_MB   = 10;
  const MAX_IMAGE_SIZE      = MAX_IMAGE_SIZE_MB * 1024 * 1024;

  const handleProfilePictureUpload = async (file: File) => {
    if (!user) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP files are accepted for profile pictures.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`Profile picture must be under ${MAX_IMAGE_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }
    setUploadingProfile(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-profile.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Try artist-profile-images first, fallback to profile-pictures
      let bucket = 'artist-profile-images';
      let uploadError = null;
      
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);
        uploadError = error;
      } catch (e) {
        uploadError = e;
      }

      // Fallback to legacy bucket
      if (uploadError) {
        bucket = 'profile-pictures';
        const { error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);
        uploadError = error;
      }

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setProfilePictureUrl(publicUrl);
      toast.success('Profile picture uploaded successfully');
    } catch (error: any) {
      const msg = error?.message || error?.error_description || 'Upload failed';
      toast.error(`Profile picture upload failed: ${msg}`);
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleCoverBannerUpload = async (file: File) => {
    if (!user) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP files are accepted for cover banners.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`Cover banner must be under ${MAX_IMAGE_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }
    setUploadingBanner(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-banner.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cover-banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cover-banners')
        .getPublicUrl(filePath);

      setCoverBannerUrl(publicUrl);
      toast.success('Cover banner uploaded successfully');
    } catch (error: any) {
      const msg = error?.message || error?.error_description || 'Upload failed';
      toast.error(`Cover banner upload failed: ${msg}`);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handlePortfolioUpload = async (index: number, file: File) => {
    if (!user) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith('video/')) {
      toast.error('Only JPG, PNG, WebP images and videos are accepted for portfolio.');
      return;
    }
    if (!file.type.startsWith('video/') && file.size > MAX_IMAGE_SIZE) {
      toast.error(`Image must be under ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }
    setUploadingPortfolio(index);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-portfolio-${index}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Try portfolio-images first, fallback to portfolio
      let bucket = 'portfolio-images';
      let uploadError = null;
      
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);
        uploadError = error;
      } catch (e) {
        uploadError = e;
      }

      // Fallback to legacy bucket
      if (uploadError) {
        bucket = 'portfolio';
        const { error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);
        uploadError = error;
      }

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const newPortfolio = [...portfolioItems];
      newPortfolio[index] = {
        ...newPortfolio[index],
        file,
        url: publicUrl,
        type: file.type.startsWith('video') ? 'video' : 'image'
      };
      setPortfolioItems(newPortfolio);

      toast.success('Portfolio item uploaded successfully');
    } catch (error: any) {
      const msg = error?.message || error?.error_description || 'Upload failed';
      toast.error(`Portfolio upload failed: ${msg}`);
    } finally {
      setUploadingPortfolio(null);
    }
  };

  const handleDocumentUpload = async (index: number, file: File) => {
    if (!user) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, WebP, and PDF files are accepted for documents.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`Document must be under ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }
    setUploadingDoc(index);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath);

      const newDocuments = [...documents];
      newDocuments[index] = {
        ...newDocuments[index],
        file,
        url: publicUrl
      };
      setDocuments(newDocuments);

      toast.success('Document uploaded successfully');
    } catch (error: any) {
      const msg = error?.message || error?.error_description || 'Upload failed';
      toast.error(`Document upload failed: ${msg}`);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSendOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setSendingOtp(true);
    try {
      // Store phone-bound OTP in sessionStorage only (never localStorage for security)
      const digits = Math.floor(100000 + Math.random() * 900000).toString();
      setCurrentOtp(digits);
      sessionStorage.setItem(
        `otp_${phone}`,
        JSON.stringify({ otp: digits, expiresAt: Date.now() + 10 * 60 * 1000 })
      );

      // In production: replace this with your SMS API call (Twilio / MSG91 / etc.)
      // await fetch('/api/send-otp', { method: 'POST', body: JSON.stringify({ phone }) });
      toast.success(
        `OTP sent to ${phone}. (Demo — your OTP is: ${digits})`,
        { duration: 15000 }
      );
      setOtpSent(true);
      setResendCountdown(60);
      const interval = setInterval(() => {
        setResendCountdown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    setVerifyingOtp(true);
    try {
      const stored = sessionStorage.getItem(`otp_${phone}`);
      if (!stored) {
        toast.error('OTP expired or not found. Please request a new one.');
        return;
      }
      const { otp: saved, expiresAt } = JSON.parse(stored);
      if (Date.now() > expiresAt) {
        sessionStorage.removeItem(`otp_${phone}`);
        toast.error('OTP has expired. Please request a new one.');
        return;
      }
      if (saved !== otp) {
        toast.error('Incorrect OTP. Please try again.');
        return;
      }
      sessionStorage.removeItem(`otp_${phone}`);
      setOtpVerified(true);
      toast.success('✓ Phone number verified successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = () => {
    if (resendCountdown === 0) {
      setOtp('');
      setOtpSent(false);
      handleSendOtp();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login first');
      return;
    }

    if (!profession) {
      toast.error('Please select your profession');
      return;
    }

    if (!organizationName.trim()) {
      toast.error('Organization / Artist Name is required');
      return;
    }

    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!otpVerified) {
      toast.error('Please verify your phone number with OTP');
      return;
    }

    if (!city.trim()) {
      toast.error('Please enter your city');
      return;
    }

    if (!bio.trim()) {
      toast.error('Please write something about yourself in the "About You" section');
      return;
    }

    // Document upload is optional for now (remove this check if you want to make it required)
    // const uploadedDocs = documents.filter(d => d.url);
    // if (uploadedDocs.length === 0) {
    //   toast.error('Please upload at least one verification document');
    //   return;
    // }

    setIsLoading(true);

    try {
      // Step 1: Update user profile with complete information
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          phone,
          avatar_url: profilePictureUrl || null,
          city, 
          area,
          state,
          organization_name: organizationName || null,
          phone_verified: true
        } as any)
        .eq('id', user.id);

      if (profileError) {
        toast.error('We could not update your profile. Please check your details and try again.');
        throw profileError;
      }

      // Step 2: Create provider profile with all details
      const { data: providerData, error: providerError } = await supabase
        .from('provider_profiles')
        .insert({
          user_id: user.id,
          profession,
          experience_years: parseInt(experienceYears) || 0,
          price_min: parseInt(priceMin) || null,
          price_max: parseInt(priceMax) || null,
          bio,
          specialties: specialties.trim()
            ? specialties.split(',').map(s => s.trim()).filter(Boolean)
            : [],
          languages: languages.trim()
            ? languages.split(',').map(l => l.trim()).filter(Boolean)
            : [],
          available_dates: null,
          gst_number: gstNumber || null,
          instagram: instagram || null,
          facebook: facebook || null,
          youtube: youtube || null,
          website: website || null,
          cover_banner_url: coverBannerUrl || null,
          travel_charges: parseInt(travelCharges) || 0,
          extra_charges: parseInt(extraCharges) || 0,
          verification_status: 'pending'
        } as any)
        .select()
        .single();

      if (providerError) {
        // Rollback profile phone_verified
        await supabase.from('profiles').update({ phone_verified: false } as any).eq('id', user.id);
        if (providerError.code === '23505') {
          toast.error('You have already submitted a registration request. Please wait for review.');
        } else {
          toast.error('Registration could not be completed. Please try again or contact support.');
        }
        return;
      }

      // Save pricing packages
      for (const pkg of pricingPackages) {
        if (pkg.price) {
          await supabase
            .from('pricing_packages' as any)
            .insert({
              provider_id: providerData.id,
              name: pkg.name,
              price: parseInt(pkg.price),
              duration: pkg.duration || null,
              description: pkg.description || null
            } as any);
        }
      }

      // Save time slots
      for (const slot of timeSlots) {
        if (slot.active && slot.start && slot.end) {
          await supabase
            .from('provider_time_slots' as any)
            .insert({
              provider_id: providerData.id,
              day_of_week: slot.day,
              start_time: slot.start,
              end_time: slot.end,
              is_active: true
            } as any);
        }
      }

      // Save bank details separately if provided
      if (bankName && bankAccount && ifscCode) {
        await supabase
          .from('bank_details' as any)
          .insert({
            provider_id: providerData.id,
            bank_name: bankName,
            account_number: bankAccount,
            ifsc_code: ifscCode,
            upi_id: upiId || null
          } as any);
      }

      // Upload portfolio items to database with correct field names
      for (const item of portfolioItems) {
        if (item.url) {
          await supabase
            .from('portfolio_items')
            .insert({
              provider_id: providerData.id,
              media_url: item.url,
              media_type: item.type,
              title: `${profession} portfolio item`,
              description: item.description || null
            } as any);
        }
      }

      // Upload documents to worker_documents table
      for (const doc of documents) {
        if (doc.url) {
          await supabase
            .from('worker_documents' as any)
            .insert({
              worker_id: user.id,
              document_type: doc.type === 'aadhaar' ? 'government_id' : doc.type === 'pan' ? 'government_id' : 'government_id',
              document_url: doc.url,
              document_number: doc.number || null,
              verification_status: 'pending',
            } as any);
        }
      }

      toast.success('🎉 Registration submitted! Your profile is under review. You\'ll be notified once approved.');
      clearFormStorage();
      // Fetch latest roles (user may be provider+admin) and route to correct dashboard
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const roles = rolesData?.map(r => r.role as string) ?? ['customer'];
      navigate(resolveDashboard(roles));
    } catch (error: any) {
      toast.error('Registration failed. Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <Card className="shadow-elegant border-gold/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
              Join as a Professional
            </CardTitle>
            <CardDescription>
              Register your talent and start receiving bookings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Personal Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="border-border focus:border-gold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={otpVerified}
                      required
                      className="border-border focus:border-gold"
                    />
                    {!otpVerified && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendOtp}
                        disabled={sendingOtp || !phone || resendCountdown > 0}
                        className="whitespace-nowrap"
                      >
                        {sendingOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : resendCountdown > 0 ? (
                          `Resend in ${resendCountdown}s`
                        ) : (
                          'Send OTP'
                        )}
                      </Button>
                    )}
                    {otpVerified && (
                      <div className="flex items-center gap-1 text-green-600 px-3 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Verified</span>
                      </div>
                    )}
                  </div>
                  
                  {/* OTP Input Field - Only show after OTP is sent */}
                  {otpSent && !otpVerified && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700 mb-2">
                        Enter the 6-digit OTP sent to your phone
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          className="border-blue-300 focus:border-blue-500"
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={verifyingOtp || otp.length !== 6}
                          className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                        >
                          {verifyingOtp ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            'Verify OTP'
                          )}
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-blue-600">
                        OTP shown in the toast notification above.
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization / Artist Name *</Label>
                  <Input
                    id="organizationName"
                    type="text"
                    placeholder="Enter your organization or artist name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    className="border-border focus:border-gold"
                  />
                  {!organizationName.trim() && organizationName !== '' && (
                    <p className="text-xs text-destructive">This field is required.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      type="text"
                      placeholder="e.g., Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      className="border-border focus:border-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="languages">Languages Known *</Label>
                    <Input
                      id="languages"
                      type="text"
                      placeholder="e.g., Hindi, English, Marathi"
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                      required
                      className="border-border focus:border-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Profile Picture & Cover Banner */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Profile Images</h3>
                
                {/* Cover Banner */}
                <div className="space-y-2">
                  <Label htmlFor="coverBanner">Cover Banner</Label>
                  <Input
                    id="coverBanner"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleCoverBannerUpload(file);
                      }
                    }}
                    disabled={uploadingBanner}
                    className="border-border focus:border-gold"
                  />
                  {uploadingBanner && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gold" />
                  )}
                  {coverBannerUrl && (
                    <div className="mt-2">
                      <img 
                        src={coverBannerUrl} 
                        alt="Cover Banner Preview" 
                        className="w-full h-32 object-cover rounded-lg border-2 border-gold"
                      />
                    </div>
                  )}
                </div>

                {/* Profile Picture */}
                <div className="space-y-2">
                  <Label htmlFor="profilePicture">Profile Picture *</Label>
                  <Input
                    id="profilePicture"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleProfilePictureUpload(file);
                      }
                    }}
                    disabled={uploadingProfile}
                    className="border-border focus:border-gold"
                  />
                  {uploadingProfile && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gold" />
                  )}
                  {profilePictureUrl && (
                    <div className="mt-2">
                      <img 
                        src={profilePictureUrl} 
                        alt="Profile Preview" 
                        className="w-24 h-24 rounded-full object-cover border-2 border-gold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Profession Selection */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Professional Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="profession">Profession *</Label>
                  <Select value={profession} onValueChange={(value) => setProfession(value as ProfessionType)}>
                    <SelectTrigger className="border-border focus:border-gold">
                      <SelectValue placeholder="Select your profession" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {option.icon}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Experience */}
                <div className="space-y-2">
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Input
                    id="experience"
                    type="number"
                    min="0"
                    placeholder="e.g., 5"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="border-border focus:border-gold"
                  />
                </div>

                {/* Pricing Packages */}
                <div className="space-y-4">
                  <Label>Pricing Packages</Label>
                  {pricingPackages.map((pkg, index) => (
                    <Card key={index} className="border-gold/20">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-gold" />
                          <span className="font-semibold">{pkg.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`pkg-price-${index}`} className="text-sm">Price (₹)</Label>
                            <Input
                              id={`pkg-price-${index}`}
                              type="number"
                              min="0"
                              placeholder="10000"
                              value={pkg.price}
                              onChange={(e) => {
                                const newPackages = [...pricingPackages];
                                newPackages[index].price = e.target.value;
                                setPricingPackages(newPackages);
                              }}
                              className="border-border focus:border-gold"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`pkg-duration-${index}`} className="text-sm">Duration</Label>
                            <Input
                              id={`pkg-duration-${index}`}
                              type="text"
                              placeholder="e.g., 4 hours"
                              value={pkg.duration}
                              onChange={(e) => {
                                const newPackages = [...pricingPackages];
                                newPackages[index].duration = e.target.value;
                                setPricingPackages(newPackages);
                              }}
                              className="border-border focus:border-gold"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`pkg-desc-${index}`} className="text-sm">Description</Label>
                          <Textarea
                            id={`pkg-desc-${index}`}
                            placeholder="What's included in this package?"
                            value={pkg.description}
                            onChange={(e) => {
                              const newPackages = [...pricingPackages];
                              newPackages[index].description = e.target.value;
                              setPricingPackages(newPackages);
                            }}
                            rows={2}
                            className="border-border focus:border-gold resize-none"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Additional Charges */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="travelCharges">Travel Charges (₹)</Label>
                    <Input
                      id="travelCharges"
                      type="number"
                      min="0"
                      placeholder="e.g., 2000"
                      value={travelCharges}
                      onChange={(e) => setTravelCharges(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extraCharges">Extra Charges (₹)</Label>
                    <Input
                      id="extraCharges"
                      type="number"
                      min="0"
                      placeholder="e.g., 1000"
                      value={extraCharges}
                      onChange={(e) => setExtraCharges(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                </div>

                {/* Service Locations */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="e.g., Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="border-border focus:border-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">Area</Label>
                    <Input
                      id="area"
                      type="text"
                      placeholder="e.g., Andheri West"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                </div>

                {/* Specialties */}
                <div className="space-y-2">
                  <Label htmlFor="specialties">Specialties (comma-separated)</Label>
                  <Input
                    id="specialties"
                    type="text"
                    placeholder="e.g., Wedding, Corporate, Birthday"
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    className="border-border focus:border-gold"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="bio">About You *</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell customers about your experience, style, and what makes you unique..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    required
                    rows={4}
                    className="border-border focus:border-gold resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availableDates">Available Dates</Label>
                  <Textarea
                    id="availableDates"
                    placeholder="List your available dates or any blackout dates"
                    value={availableDates}
                    onChange={(e) => setAvailableDates(e.target.value)}
                    rows={2}
                    className="border-border focus:border-gold resize-none"
                  />
                </div>

                {/* Weekly Availability */}
                <div className="space-y-3">
                  <Label>Weekly Availability</Label>
                  <div className="space-y-2">
                    {timeSlots.map((slot, index) => (
                      <div key={slot.day} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 w-32">
                          <input
                            type="checkbox"
                            checked={slot.active}
                            onChange={(e) => {
                              const newSlots = [...timeSlots];
                              newSlots[index].active = e.target.checked;
                              setTimeSlots(newSlots);
                            }}
                            className="w-4 h-4 accent-gold"
                          />
                          <span className="text-sm font-medium">
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slot.day]}
                          </span>
                        </div>
                        {slot.active && (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="time"
                              value={slot.start}
                              onChange={(e) => {
                                const newSlots = [...timeSlots];
                                newSlots[index].start = e.target.value;
                                setTimeSlots(newSlots);
                              }}
                              className="border-border focus:border-gold"
                            />
                            <span className="text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={slot.end}
                              onChange={(e) => {
                                const newSlots = [...timeSlots];
                                newSlots[index].end = e.target.value;
                                setTimeSlots(newSlots);
                              }}
                              className="border-border focus:border-gold"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Business Details */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Business Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="gstNumber">GST Number (Optional)</Label>
                  <Input
                    id="gstNumber"
                    type="text"
                    placeholder="e.g., 27ABCDE1234F1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    className="border-border focus:border-gold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram (Optional)</Label>
                    <Input
                      id="instagram"
                      type="text"
                      placeholder="@username"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook (Optional)</Label>
                    <Input
                      id="facebook"
                      type="text"
                      placeholder="Page URL"
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="youtube">YouTube (Optional)</Label>
                    <Input
                      id="youtube"
                      type="text"
                      placeholder="Channel URL"
                      value={youtube}
                      onChange={(e) => setYoutube(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website (Optional)</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Bank Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    type="text"
                    placeholder="e.g., State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="border-border focus:border-gold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankAccount">Account Number</Label>
                  <Input
                    id="bankAccount"
                    type="text"
                    placeholder="Enter your account number"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="border-border focus:border-gold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      type="text"
                      placeholder="e.g., SBIN0001234"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upiId">UPI ID (Optional)</Label>
                    <Input
                      id="upiId"
                      type="text"
                      placeholder="e.g., name@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="border-border focus:border-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Portfolio Upload */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Portfolio</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload unlimited images and videos to showcase your work
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPortfolioItems([
                        ...portfolioItems,
                        { file: null, url: '', type: 'image', description: '' }
                      ]);
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {portfolioItems.map((item, index) => (
                  <div key={index} className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center justify-between">
                      <Label>
                        {item.type === 'image' ? 'Portfolio Image' : 'Portfolio Video'} {index + 1}
                      </Label>
                      {portfolioItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newPortfolio = portfolioItems.filter((_, i) => i !== index);
                            setPortfolioItems(newPortfolio);
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select 
                        value={item.type} 
                        onValueChange={(value: 'image' | 'video') => {
                          const newPortfolio = [...portfolioItems];
                          newPortfolio[index].type = value;
                          setPortfolioItems(newPortfolio);
                        }}
                      >
                        <SelectTrigger className="border-border focus:border-gold">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="file"
                        accept={item.type === 'image' ? 'image/*' : 'video/*'}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handlePortfolioUpload(index, file);
                          }
                        }}
                        disabled={uploadingPortfolio === index}
                        className="border-border focus:border-gold"
                      />
                    </div>
                    {uploadingPortfolio === index && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gold" />
                    )}
                    <Input
                      type="text"
                      placeholder="Description (optional)"
                      value={item.description}
                      onChange={(e) => {
                        const newPortfolio = [...portfolioItems];
                        newPortfolio[index].description = e.target.value;
                        setPortfolioItems(newPortfolio);
                      }}
                      className="border-border focus:border-gold"
                    />
                    {item.url && (
                      <div className="mt-2">
                        {item.type === 'image' ? (
                          <img src={item.url} alt="Portfolio" className="w-full h-32 object-cover rounded" />
                        ) : (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                            View Video
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Social Media Links — removed duplicate (already in Business Details) */}
              </div>

              {/* Document Upload Section */}
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="text-base font-semibold">Verification Documents *</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload at least one government ID for KYC verification
                  </p>
                </div>

                {documents.map((doc, index) => (
                  <div key={doc.type} className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {doc.type === 'aadhaar' ? 'Aadhaar Card' : 
                         doc.type === 'pan' ? 'PAN Card' : 'Government ID'}
                      </Label>
                      {doc.url && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>

                    <Input
                      type="text"
                      placeholder={doc.type === 'aadhaar' ? '12-digit Aadhaar number' : doc.type === 'pan' ? 'PAN number (e.g. ABCDE1234F)' : 'Document number (optional)'}
                      value={doc.number}
                      onChange={(e) => {
                        const newDocs = [...documents];
                        newDocs[index].number = e.target.value;
                        setDocuments(newDocs);
                      }}
                      className="border-border focus:border-gold"
                    />
                    {doc.type === 'aadhaar' && doc.number && !/^\d{12}$/.test(doc.number.replace(/\s/g, '')) && (
                      <p className="text-xs text-destructive">Please enter a valid 12-digit Aadhaar number.</p>
                    )}
                    {doc.type === 'pan' && doc.number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(doc.number.toUpperCase()) && (
                      <p className="text-xs text-destructive">Please enter a valid PAN number (e.g. ABCDE1234F).</p>
                    )}

                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleDocumentUpload(index, file);
                          }
                        }}
                        disabled={uploadingDoc === index}
                        className="border-border focus:border-gold flex-1"
                      />
                      {uploadingDoc === index && (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gold" />
                      )}
                    </div>

                    {doc.url && (
                      <div className="flex items-center justify-between text-sm">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:underline"
                        >
                          View uploaded document
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newDocs = [...documents];
                            newDocs[index] = { ...newDocs[index], file: null, url: '' };
                            setDocuments(newDocs);
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-gold hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProviderRegistration;
