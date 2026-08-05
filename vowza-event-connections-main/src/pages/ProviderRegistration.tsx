// ─── Provider Registration — 5-Step Premium Onboarding Wizard ────────────────
// Replaces the old single-form registration with a step-by-step flow.
// Routes: /provider/register
// Steps: Basic Info → Professional Info → Portfolio → Verification Docs → Review

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CheckCircle, ArrowLeft, ArrowRight, Sparkles, User,
  Briefcase, Image as ImageIcon, Shield, Eye,
  Camera, X, Upload, RefreshCw, Phone, Mail,
  MapPin, Languages, ChevronDown, Loader2,
  FileText, Instagram, Globe, Star,
} from 'lucide-react';
import {
  useProviderRegistration,
  type Step1, type Step2, type Step3, type Step4,
} from '@/contexts/ProviderRegistrationContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const PROFESSIONS = [
  { value: 'photographer',      label: 'Photographer'       },
  { value: 'videographer',      label: 'Videographer'       },
  { value: 'drone_operator',    label: 'Drone Photographer' },
  { value: 'music_band',        label: 'Band'               },
  { value: 'dj',                label: 'DJ'                 },
  { value: 'singer',            label: 'Singer'             },
  { value: 'dancer',            label: 'Dancer'             },
  { value: 'choreographer',     label: 'Choreographer'      },
  { value: 'wedding_decorator', label: 'Decorator'          },
  { value: 'makeup_artist',     label: 'Makeup Artist'      },
  { value: 'mehendi_artist',    label: 'Mehendi Artist'     },
  { value: 'magician',          label: 'Magician'           },
  { value: 'anchor',            label: 'Anchor / Host'      },
  { value: 'catering_services', label: 'Caterer'            },
  { value: 'banquet_hall',      label: 'Banquet Hall'       },
  { value: 'pandit',            label: 'Pandit / Priest'    },
  { value: 'rentals',           label: 'Rentals'            },
  { value: 'water_supplier',    label: 'Water Supplier'     },
  { value: 'lighting_services', label: 'Lighting Services'  },
  { value: 'sound_services',    label: 'Sound Services'     },
  { value: 'event_planner',     label: 'Event Planner'      },
  { value: 'stand_up_comedian', label: 'Stand-up Comedian'  },
  { value: 'folk_artist',       label: 'Folk Artist'        },
];

const LANGUAGES = ['Hindi','English','Telugu','Tamil','Kannada','Marathi',
  'Bengali','Gujarati','Malayalam','Punjabi','Odia','Urdu'];

const INDIAN_STATES = ['Andhra Pradesh','Assam','Bihar','Delhi','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Odisha','Punjab','Rajasthan','Tamil Nadu',
  'Telangana','Uttar Pradesh','Uttarakhand','West Bengal'];

const STEPS = [
  { id: 1, label: 'Basic Info',     icon: User      },
  { id: 2, label: 'Professional',   icon: Briefcase },
  { id: 3, label: 'Portfolio',      icon: ImageIcon },
  { id: 4, label: 'Verification',   icon: Shield    },
  { id: 5, label: 'Review',         icon: Eye       },
];

// ── Reusable field wrapper ─────────────────────────────────────────────────────
const Field = ({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-semibold text-foreground">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <div className="flex items-center gap-2">
    {STEPS.map((s, i) => {
      const done = i + 1 < current;
      const active = i + 1 === current;
      return (
        <div key={s.id} className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            done   ? 'bg-emerald-500 text-white'  :
            active ? 'bg-maroon text-white shadow-maroon' :
                     'bg-secondary text-muted-foreground border border-border'
          )}>
            {done ? <CheckCircle className="w-4 h-4" /> : s.id}
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn('h-0.5 w-8 md:w-14 rounded-full transition-all',
              done ? 'bg-emerald-500' : 'bg-border')} />
          )}
        </div>
      );
    })}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function ProviderRegistration() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // ── Registration state — lifted to ProviderRegistrationContext ──────────────
  // This survives navigating away to /terms or /privacy and back, since the
  // provider is mounted above this route and never unmounts. See
  // src/contexts/ProviderRegistrationContext.tsx for persistence details.
  const { step, setStep, s1, setS1, s2, setS2, s3, setS3, s4, setS4, resetRegistration } = useProviderRegistration();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const portfolioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
    // Prefill email from auth (only if not already filled in from a restored session)
    if (user?.email) setS1(p => (p.email ? p : { ...p, email: user.email ?? '' }));
  }, [user, loading, navigate]);

  // ── OTP (simulated — wire to real SMS provider in production) ────────────────
  const sendOTP = async () => {
    if (s1.phone.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return; }
    setOtpLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setS1(p => ({ ...p, otpSent: true }));
    toast.success(`OTP sent to +91 ${s1.phone}. Use 123456 for testing.`);
    setOtpLoading(false);
  };

  const verifyOTP = () => {
    // In production: verify via SMS provider API
    if (s1.otp === '123456' || s1.otp.length === 6) {
      setS1(p => ({ ...p, otpVerified: true }));
      toast.success('Mobile number verified ✓');
    } else {
      toast.error('Incorrect OTP. Please try again.');
    }
  };

  // ── Camera (front-facing selfie) ──────────────────────────────────────────
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 100);
    } catch {
      toast.error('Camera access denied. Please allow camera permission and try again.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width  = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    canvasRef.current.toBlob(blob => {
      if (!blob) { toast.error('Failed to capture. Try again.'); return; }
      const url = URL.createObjectURL(blob);
      setS2(p => ({ ...p, selfieUrl: url, selfieBlob: blob }));
      closeCamera();
      toast.success('Selfie captured ✓');
    }, 'image/jpeg', 0.85);
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  // ── Portfolio upload ───────────────────────────────────────────────────────
  const handlePortfolio = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 10 - s3.portfolioFiles.length);
    const processed = newFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? 'video' as const : 'image' as const,
    }));
    setS3(p => ({ ...p, portfolioFiles: [...p.portfolioFiles, ...processed] }));
  };

  const removePortfolio = (i: number) => {
    setS3(p => { const next = [...p.portfolioFiles]; next.splice(i,1); return { ...p, portfolioFiles: next }; });
  };

  // ── Document upload ────────────────────────────────────────────────────────
  const handleDoc = (key: keyof Step4, file: File | null) => {
    if (!file) return;
    const previewKey = key.replace('File','Preview') as keyof Step4;
    const url = URL.createObjectURL(file);
    setS4(p => ({ ...p, [key]: file, [previewKey]: url }));
  };

  // ── Step validation ────────────────────────────────────────────────────────
  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1: return !!(s1.fullName.trim() && s1.otpVerified && s1.email.includes('@') && s1.state && s1.city.trim() && s1.profession && s1.languages.length > 0);
      case 2: return !!(s2.experience && s2.about.trim().length >= 30 && s2.selfieBlob);
      case 3: return s3.portfolioFiles.length >= 2;
      case 4: return !!(s4.aadhaarFile && s4.govtIdFile && s4.termsAccepted);
      case 5: return true;
      default: return false;
    }
  }, [step, s1, s2, s3, s4]);

  // ── Final submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // 1. Update profiles table
      await supabase.from('profiles').update({
        full_name: s1.fullName, phone: s1.phone, city: s1.city,
        area: s1.area, state: s1.state as any,
      }).eq('id', user.id);

      // 2. Upload selfie
      let selfieUrl = '';
      if (s2.selfieBlob) {
        const path = `selfies/${user.id}_${Date.now()}.jpg`;
        const { data } = await supabase.storage.from('provider-media').upload(path, s2.selfieBlob, { upsert: true });
        if (data) {
          const { data: pub } = supabase.storage.from('provider-media').getPublicUrl(path);
          selfieUrl = pub.publicUrl;
        }
      }

      // 3. Upload portfolio
      const galleryUrls: string[] = [];
      for (const pf of s3.portfolioFiles.slice(0, 10)) {
        const path = `portfolio/${user.id}_${Date.now()}_${pf.file.name}`;
        const { data } = await supabase.storage.from('provider-media').upload(path, pf.file, { upsert: true });
        if (data) {
          const { data: pub } = supabase.storage.from('provider-media').getPublicUrl(path);
          galleryUrls.push(pub.publicUrl);
        }
      }

      // 4. Upload documents
      const uploadDoc = async (file: File, prefix: string) => {
        const path = `docs/${user.id}_${prefix}_${Date.now()}`;
        const { data } = await supabase.storage.from('provider-media').upload(path, file, { upsert: true });
        if (data) { const { data: pub } = supabase.storage.from('provider-media').getPublicUrl(path); return pub.publicUrl; }
        return '';
      };
      const aadhaarUrl = s4.aadhaarFile ? await uploadDoc(s4.aadhaarFile, 'aadhaar') : '';
      const govtIdUrl  = s4.govtIdFile  ? await uploadDoc(s4.govtIdFile,  'govtid')  : '';

      // 5. Create provider profile
      const { error } = await supabase.from('provider_profiles').insert({
        user_id: user.id,
        profession: s1.profession as any,
        experience_years: parseInt(s2.experience) || 0,
        bio: s2.about,
        languages: s1.languages,
        service_areas: s2.serviceAreas,
        gallery_urls: galleryUrls,
        social_links: { instagram: s3.instagram, website: s3.website },
        verification_status: 'pending',
        onboarding_completed: true,
        vendor_details: { selfie_url: selfieUrl, aadhaar_url: aadhaarUrl, govt_id_url: govtIdUrl, address: s1.address },
      } as any);
      if (error && error.code !== '23505') throw error;

      // 6. Add provider role
      await supabase.from('user_roles').upsert({ user_id: user.id, role: 'provider' }, { onConflict: 'user_id,role' });

      // 7. Send notification
      await supabase.from('notifications' as any).insert({
        user_id: user.id, type: 'registration',
        title: 'Application Submitted',
        message: 'Your artist application has been submitted and is under review.',
        is_read: false,
      });

      resetRegistration();
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto animate-pulse-ring">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-3">Application Submitted!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your application has been submitted successfully and is currently under review.
            Our team will verify your profile and notify you once your account has been approved.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Pending Verification
        </div>
        <div className="space-y-3">
          <button onClick={() => navigate('/')} className="btn-primary w-full justify-center py-3">
            Go to Homepage
          </button>
          <button onClick={() => navigate('/provider/dashboard')} className="btn-outline w-full justify-center py-3">
            View Dashboard
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          You'll receive a notification when your profile is approved. Usually within 24–48 hours.
        </p>
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-border/60 sticky top-0 z-40">
        <div className="container px-4 h-14 flex items-center justify-between">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> {step > 1 ? 'Back' : 'Home'}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-maroon flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-display font-bold text-foreground">Join Vowza</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">Step {step} of {STEPS.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div className="h-full bg-gradient-maroon transition-all duration-500 rounded-r-full" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="flex-1 container px-4 py-8 max-w-2xl mx-auto">
        {/* Step pills */}
        <div className="flex justify-center mb-8 overflow-x-auto pb-2 no-scrollbar">
          <ProgressBar current={step} total={STEPS.length} />
        </div>

        {/* Step title */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            {(() => { const S = STEPS[step-1]; return <S.icon className="w-5 h-5 text-maroon" />; })()}
            <h2 className="text-xl font-display font-bold text-foreground">{STEPS[step-1].label}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {step===1 && 'Tell us about yourself. This is how artists and customers will find you.'}
            {step===2 && 'Share your expertise. A strong profile gets more bookings.'}
            {step===3 && 'Show your best work. Upload at least 2 images or videos.'}
            {step===4 && 'Upload your identity documents for verification.'}
            {step===5 && 'Review everything before submitting your application.'}
          </p>
        </div>

        {/* Step content card */}
        <div className="bg-white rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
          {step === 1 && <Step1Form s1={s1} setS1={setS1} sendOTP={sendOTP} verifyOTP={verifyOTP} otpLoading={otpLoading} />}
          {step === 2 && <Step2Form s2={s2} setS2={setS2} openCamera={openCamera} retake={() => { setS2(p => ({...p, selfieUrl:null, selfieBlob:null})); openCamera(); }} />}
          {step === 3 && <Step3Form s3={s3} portfolioRef={portfolioRef} handlePortfolio={handlePortfolio} removePortfolio={removePortfolio} setS3={setS3} />}
          {step === 4 && <Step4Form s4={s4} setS4={setS4} handleDoc={handleDoc} />}
          {step === 5 && <Step5Review s1={s1} s2={s2} s3={s3} s4={s4} goTo={setStep} />}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-outline flex-1 justify-center py-3 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}
              className={cn('flex-1 justify-center py-3 text-sm flex items-center gap-2 rounded-xl font-semibold transition-all',
                canProceed()
                  ? 'btn-primary'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting || !canProceed()}
              className="btn-primary flex-1 justify-center py-3 text-sm">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><CheckCircle className="w-4 h-4" /> Submit Application</>}
            </button>
          )}
        </div>
        {step < 5 && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Your progress is saved automatically. You can continue later.
          </p>
        )}
      </main>

      {/* Camera modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-sm rounded-2xl object-cover" style={{ maxHeight:'70vh' }} />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-4 mt-6">
            <button onClick={closeCamera} className="px-6 py-3 rounded-xl bg-white/10 text-white text-sm font-semibold">
              <X className="w-4 h-4" />
            </button>
            <button onClick={capturePhoto} className="px-8 py-3 rounded-xl bg-white text-gray-900 text-sm font-bold flex items-center gap-2">
              <Camera className="w-4 h-4" /> Capture
            </button>
          </div>
          <p className="text-white/60 text-xs mt-4">Position your face clearly in the frame</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEP FORMS — all at module scope (no re-render focus loss)
// ═══════════════════════════════════════════════════════════════════

function Step1Form({ s1, setS1, sendOTP, verifyOTP, otpLoading }: {
  s1: Step1; setS1: React.Dispatch<React.SetStateAction<Step1>>;
  sendOTP: () => void; verifyOTP: () => void; otpLoading: boolean;
}) {
  const set = (k: keyof Step1) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setS1(p => ({ ...p, [k]: e.target.value }));
  const toggleLang = (l: string) => setS1(p => ({
    ...p, languages: p.languages.includes(l) ? p.languages.filter(x=>x!==l) : [...p.languages, l],
  }));

  return (
    <>
      <Field label="Full Name" required>
        <input value={s1.fullName} onChange={set('fullName')} placeholder="Your full name"
          className="input-premium text-sm w-full" autoComplete="name" />
      </Field>

      <Field label="Mobile Number" required>
        <div className="flex gap-2">
          <div className="flex items-center px-3 rounded-xl bg-secondary border border-border text-sm font-medium flex-shrink-0">
            🇮🇳 +91
          </div>
          <input value={s1.phone} onChange={set('phone')} placeholder="10-digit mobile number"
            maxLength={10} className="input-premium text-sm flex-1" type="tel" disabled={s1.otpVerified} />
          {!s1.otpVerified && (
            <button onClick={sendOTP} disabled={otpLoading || s1.phone.length < 10}
              className="flex-shrink-0 px-4 py-2 rounded-xl bg-maroon text-white text-xs font-semibold disabled:opacity-50">
              {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : s1.otpSent ? 'Resend' : 'Send OTP'}
            </button>
          )}
          {s1.otpVerified && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 self-center" />}
        </div>
        {s1.otpSent && !s1.otpVerified && (
          <div className="flex gap-2 mt-2">
            <input value={s1.otp} onChange={set('otp')} placeholder="Enter 6-digit OTP"
              maxLength={6} className="input-premium text-sm flex-1" />
            <button onClick={verifyOTP} className="flex-shrink-0 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold">
              Verify
            </button>
          </div>
        )}
      </Field>

      <Field label="Email Address" required>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={s1.email} onChange={set('email')} placeholder="your@email.com"
            className="input-premium text-sm w-full pl-9" type="email" autoComplete="email" />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="State" required>
          <select value={s1.state} onChange={set('state')} className="input-premium text-sm w-full">
            <option value="">Select State</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="City" required>
          <input value={s1.city} onChange={set('city')} placeholder="Your city"
            className="input-premium text-sm w-full" />
        </Field>
      </div>

      <Field label="Area / Locality" required>
        <input value={s1.area} onChange={set('area')} placeholder="Area or locality name"
          className="input-premium text-sm w-full" />
      </Field>

      <Field label="House / Shop Number" >
        <input value={s1.address} onChange={set('address')} placeholder="Flat / Shop / House number"
          className="input-premium text-sm w-full" />
      </Field>

      <Field label="Your Profession / Category" required>
        <select value={s1.profession} onChange={set('profession')} className="input-premium text-sm w-full">
          <option value="">Select your profession</option>
          {PROFESSIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>

      <Field label="Languages You Speak" required>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(l => (
            <button key={l} type="button" onClick={() => toggleLang(l)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                s1.languages.includes(l) ? 'bg-maroon text-white border-maroon' : 'border-border text-muted-foreground hover:border-maroon/40')}>
              {l}
            </button>
          ))}
        </div>
      </Field>
    </>
  );
}

function Step2Form({ s2, setS2, openCamera, retake }: {
  s2: Step2; setS2: React.Dispatch<React.SetStateAction<Step2>>;
  openCamera: () => void; retake: () => void;
}) {
  const set = (k: keyof Step2) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
    setS2(p => ({ ...p, [k]: e.target.value }));

  const addArea = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const t = e.currentTarget;
    if (e.key === 'Enter' && t.value.trim()) {
      setS2(p => ({ ...p, serviceAreas: [...new Set([...p.serviceAreas, t.value.trim()])] }));
      t.value = '';
    }
  };
  const removeArea = (a: string) => setS2(p => ({ ...p, serviceAreas: p.serviceAreas.filter(x => x !== a) }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Years of Experience" required>
          <select value={s2.experience} onChange={set('experience')} className="input-premium text-sm w-full">
            <option value="">Select</option>
            {['Less than 1 year','1 year','2 years','3 years','4 years','5 years','6-10 years','10+ years'].map(e =>
              <option key={e} value={e}>{e}</option>)}
          </select>
        </Field>
      </div>

      <Field label="About Yourself" required error={s2.about.length > 0 && s2.about.length < 30 ? 'Write at least 30 characters' : ''}>
        <textarea value={s2.about} onChange={set('about')} rows={4}
          placeholder="Describe your experience, style, and what makes you unique… (min. 30 characters)"
          className="input-premium text-sm w-full resize-none" />
        <p className="text-[11px] text-muted-foreground text-right">{s2.about.length} chars</p>
      </Field>

      <Field label="Service Areas (press Enter to add)">
        <input onKeyDown={addArea} placeholder="Type a city or area and press Enter"
          className="input-premium text-sm w-full" />
        {s2.serviceAreas.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {s2.serviceAreas.map(a => (
              <span key={a} className="flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-xs font-medium border border-border">
                {a} <button onClick={() => removeArea(a)} className="text-muted-foreground hover:text-red-500 ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </Field>

      <div>
        <label className="text-sm font-semibold text-foreground block mb-1.5">
          Identity Selfie <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-3">
          Take a live selfie using your front camera. Gallery upload is not allowed for security reasons.
        </p>
        {!s2.selfieUrl ? (
          <button onClick={openCamera}
            className="w-full h-40 rounded-2xl border-2 border-dashed border-border hover:border-maroon/40 flex flex-col items-center justify-center gap-2 transition-colors group">
            <Camera className="w-8 h-8 text-muted-foreground group-hover:text-maroon transition-colors" />
            <p className="text-sm font-medium text-muted-foreground group-hover:text-maroon">Click to open camera</p>
            <p className="text-xs text-muted-foreground">Front camera · Live selfie only</p>
          </button>
        ) : (
          <div className="relative w-40 mx-auto">
            <img src={s2.selfieUrl} alt="Selfie" className="w-40 h-40 rounded-2xl object-cover border-2 border-emerald-400 shadow-md" />
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <button onClick={retake}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-border text-xs font-medium shadow hover:bg-secondary">
              <RefreshCw className="w-3 h-3" /> Retake
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Step3Form({ s3, portfolioRef, handlePortfolio, removePortfolio, setS3 }: {
  s3: Step3;
  portfolioRef: React.RefObject<HTMLInputElement>;
  handlePortfolio: (f: FileList|null) => void;
  removePortfolio: (i: number) => void;
  setS3: React.Dispatch<React.SetStateAction<Step3>>;
}) {
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); handlePortfolio(e.dataTransfer.files);
  };

  return (
    <>
      <div
        onDragOver={e => e.preventDefault()} onDrop={onDrop}
        onClick={() => portfolioRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-maroon/40 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors group"
      >
        <div className="w-12 h-12 rounded-xl bg-maroon/8 flex items-center justify-center group-hover:bg-maroon/12 transition-colors">
          <Upload className="w-6 h-6 text-maroon" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Drag & drop or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">Images (JPG, PNG, WebP) or Videos (MP4, MOV) · Max 50MB each</p>
          <p className="text-xs font-semibold text-maroon mt-1">Minimum 2 files required</p>
        </div>
        <input ref={portfolioRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => handlePortfolio(e.target.files)} />
      </div>

      {s3.portfolioFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {s3.portfolioFiles.map((pf, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-muted border border-border">
              {pf.type === 'video' ? (
                <video src={pf.preview} className="w-full h-full object-cover" />
              ) : (
                <img src={pf.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              <button onClick={() => removePortfolio(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                <X className="w-3 h-3" />
              </button>
              {pf.type === 'video' && (
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">VIDEO</div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {s3.portfolioFiles.length < 2
          ? `Upload at least ${2 - s3.portfolioFiles.length} more file${2 - s3.portfolioFiles.length > 1 ? 's' : ''}`
          : `✓ ${s3.portfolioFiles.length} file${s3.portfolioFiles.length > 1 ? 's' : ''} ready`
        }
      </p>

      <div className="border-t border-border/60 pt-5 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Links (Optional)</p>
        <Field label="Instagram Profile">
          <div className="relative">
            <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={s3.instagram} onChange={e => setS3(p => ({...p, instagram: e.target.value}))}
              placeholder="@yourusername or full URL" className="input-premium text-sm w-full pl-9" />
          </div>
        </Field>
        <Field label="Website">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={s3.website} onChange={e => setS3(p => ({...p, website: e.target.value}))}
              placeholder="https://yourwebsite.com" className="input-premium text-sm w-full pl-9" />
          </div>
        </Field>
      </div>
    </>
  );
}

function DocUpload({ label, required, preview, onChange }: {
  label: string; required?: boolean; preview: string;
  onChange: (f: File|null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="text-sm font-semibold text-foreground block mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {!preview ? (
        <button onClick={() => ref.current?.click()}
          className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-maroon/40 flex flex-col items-center justify-center gap-2 transition-colors group">
          <FileText className="w-6 h-6 text-muted-foreground group-hover:text-maroon" />
          <span className="text-xs text-muted-foreground">Click to upload · JPG, PNG, PDF</span>
          <input ref={ref} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => onChange(e.target.files?.[0] ?? null)} />
        </button>
      ) : (
        <div className="relative">
          {preview.includes('data:') || preview.startsWith('blob:')
            ? <img src={preview} alt={label} className="w-full h-28 rounded-xl object-cover border border-emerald-300 shadow-sm" />
            : <div className="w-full h-28 rounded-xl border border-emerald-300 flex items-center justify-center bg-emerald-50">
                <FileText className="w-8 h-8 text-emerald-500" />
              </div>
          }
          <button onClick={() => { onChange(null); }}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
            <X className="w-3 h-3" />
          </button>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-emerald-200 px-2 py-0.5 rounded-full shadow text-[10px] font-semibold text-emerald-700">
            <CheckCircle className="w-3 h-3" /> Uploaded
          </div>
        </div>
      )}
    </div>
  );
}

function Step4Form({ s4, setS4, handleDoc }: {
  s4: Step4; setS4: React.Dispatch<React.SetStateAction<Step4>>;
  handleDoc: (k: keyof Step4, f: File|null) => void;
}) {
  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Your documents are encrypted and stored securely. They are only used for identity verification and will not be shared publicly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DocUpload label="Aadhaar Card" required preview={s4.aadhaarPreview}
          onChange={f => handleDoc('aadhaarFile', f)} />
        <DocUpload label="Government ID" required preview={s4.govtIdPreview}
          onChange={f => handleDoc('govtIdFile', f)} />
        <DocUpload label="PAN Card (optional)" preview={s4.panPreview}
          onChange={f => handleDoc('panFile', f)} />
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-surface-2 border border-border/60 hover:border-maroon/30 transition-colors">
        <div
          onClick={() => setS4(p => ({ ...p, termsAccepted: !p.termsAccepted }))}
          className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
            s4.termsAccepted ? 'bg-maroon border-maroon' : 'border-border'
          )}
        >
          {s4.termsAccepted && <CheckCircle className="w-3.5 h-3.5 text-white" />}
        </div>
        <span className="text-sm text-foreground leading-relaxed">
          I agree to Vowza's{' '}
          <Link
            to="/terms"
            state={{ from: '/provider/register', fromLabel: 'Artist Registration' }}
            className="text-maroon underline"
          >
            Terms of Service
          </Link>{' '}and{' '}
          <Link
            to="/privacy"
            state={{ from: '/provider/register', fromLabel: 'Artist Registration' }}
            className="text-maroon underline"
          >
            Privacy Policy
          </Link>.
          I confirm all uploaded documents are genuine.
        </span>
      </label>
    </>
  );
}

function Step5Review({ s1, s2, s3, s4, goTo }: {
  s1: Step1; s2: Step2; s3: Step3; s4: Step4; goTo: (s: number) => void;
}) {
  const Section = ({ title, step, children }: { title: string; step: number; children: React.ReactNode }) => (
    <div className="border border-border/60 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <button onClick={() => goTo(step)} className="text-xs font-semibold text-maroon hover:opacity-75">Edit</button>
      </div>
      {children}
    </div>
  );
  const Row = ({ label, value }: { label: string; value: string }) => value ? (
    <div className="flex gap-3 text-sm">
      <span className="text-muted-foreground min-w-[110px] flex-shrink-0">{label}</span>
      <span className="text-foreground font-medium capitalize">{value}</span>
    </div>
  ) : null;

  const profLabel = PROFESSIONS.find(p => p.value === s1.profession)?.label ?? s1.profession;

  return (
    <div className="space-y-4">
      <Section title="Basic Information" step={1}>
        <div className="space-y-2">
          <Row label="Name"       value={s1.fullName} />
          <Row label="Mobile"     value={`+91 ${s1.phone} ✓`} />
          <Row label="Email"      value={s1.email} />
          <Row label="Location"   value={[s1.area, s1.city, s1.state].filter(Boolean).join(', ')} />
          <Row label="Profession" value={profLabel} />
          <Row label="Languages"  value={s1.languages.join(', ')} />
        </div>
      </Section>

      <Section title="Professional Information" step={2}>
        <div className="space-y-2">
          <Row label="Experience" value={s2.experience} />
          <Row label="About"      value={s2.about.slice(0, 100) + (s2.about.length > 100 ? '…' : '')} />
          <Row label="Areas"      value={s2.serviceAreas.join(', ') || 'Not specified'} />
        </div>
        {s2.selfieUrl && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">Identity Selfie</p>
            <img src={s2.selfieUrl} alt="Selfie" className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-300" />
          </div>
        )}
      </Section>

      <Section title="Portfolio" step={3}>
        {s3.portfolioFiles.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {s3.portfolioFiles.slice(0, 6).map((pf, i) => (
              <div key={i} className="w-14 h-14 rounded-lg overflow-hidden bg-muted border border-border">
                {pf.type === 'image'
                  ? <img src={pf.preview} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-secondary"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>
                }
              </div>
            ))}
            {s3.portfolioFiles.length > 6 && (
              <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                +{s3.portfolioFiles.length - 6}
              </div>
            )}
          </div>
        ) : <p className="text-xs text-muted-foreground">No files uploaded</p>}
        {s3.instagram && <p className="text-xs text-muted-foreground mt-2">Instagram: {s3.instagram}</p>}
      </Section>

      <Section title="Documents" step={4}>
        <div className="flex gap-3 flex-wrap">
          {[{label:'Aadhaar', preview:s4.aadhaarPreview},{label:'Govt ID', preview:s4.govtIdPreview},{label:'PAN', preview:s4.panPreview}]
            .filter(d => d.preview)
            .map(d => (
              <div key={d.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
                <CheckCircle className="w-3.5 h-3.5" /> {d.label}
              </div>
            ))
          }
        </div>
      </Section>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <Star className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-700">Almost there!</p>
          <p className="text-xs text-amber-600 mt-1">
            After approval, you can add your pricing, packages, availability, and full business details from your Vendor Dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
