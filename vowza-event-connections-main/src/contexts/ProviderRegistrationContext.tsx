// ─── ProviderRegistrationContext ──────────────────────────────────────────────
// Persists the entire 5-step Artist Registration wizard state OUTSIDE the
// ProviderRegistration page component, so navigating away (e.g. to read the
// Terms of Service or Privacy Policy) and back never loses any progress —
// including uploaded File/Blob objects, which cannot survive sessionStorage
// serialization and therefore MUST be held in a long-lived in-memory store.
//
// Mounted once near the app root (see App.tsx) so it survives route changes
// between /provider/register, /terms and /privacy.
//
// Serializable text fields are additionally mirrored to sessionStorage as a
// defense-in-depth restore path for same-tab refreshes. Files/Blobs cannot
// survive a real full-page reload in any browser — that is a hard platform
// constraint, not something fixable here — but they DO survive in-app
// client-side route changes because this Provider never unmounts.

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export interface Step1 {
  fullName: string; phone: string; otpSent: boolean; otpVerified: boolean;
  otp: string; email: string; state: string; city: string; area: string;
  address: string; profession: string; languages: string[];
}
export interface Step2 {
  experience: string; about: string; serviceAreas: string[];
  selfieUrl: string | null; selfieBlob: Blob | null;
}
export interface Step3 {
  portfolioFiles: { file: File; preview: string; type: 'image' | 'video' }[];
  instagram: string; website: string;
}
export interface Step4 {
  aadhaarFile: File | null; aadhaarPreview: string;
  govtIdFile:  File | null; govtIdPreview:  string;
  panFile:     File | null; panPreview:     string;
  termsAccepted: boolean;
}

const EMPTY_S1: Step1 = { fullName:'', phone:'', otpSent:false, otpVerified:false, otp:'', email:'', state:'', city:'', area:'', address:'', profession:'', languages:[] };
const EMPTY_S2: Step2 = { experience:'', about:'', serviceAreas:[], selfieUrl:null, selfieBlob:null };
const EMPTY_S3: Step3 = { portfolioFiles:[], instagram:'', website:'' };
const EMPTY_S4: Step4 = { aadhaarFile:null, aadhaarPreview:'', govtIdFile:null, govtIdPreview:'', panFile:null, panPreview:'', termsAccepted:false };

const STEP_KEY = 'vowza_reg_step';
const S1_KEY   = 'vowza_reg_s1';
const S2_KEY   = 'vowza_reg_s2_text';   // text-only subset — no Blob
const S3_KEY   = 'vowza_reg_s3_text';   // text-only subset — no File[]
const S4_KEY   = 'vowza_reg_s4_flag';   // termsAccepted only — no File

interface Ctx {
  step: number; setStep: React.Dispatch<React.SetStateAction<number>>;
  s1: Step1; setS1: React.Dispatch<React.SetStateAction<Step1>>;
  s2: Step2; setS2: React.Dispatch<React.SetStateAction<Step2>>;
  s3: Step3; setS3: React.Dispatch<React.SetStateAction<Step3>>;
  s4: Step4; setS4: React.Dispatch<React.SetStateAction<Step4>>;
  /** True once the user has entered anything at all (used to decide restore banners, etc). */
  hasProgress: boolean;
  /** Clears all in-memory state and sessionStorage — call after successful submission. */
  resetRegistration: () => void;
}

const ProviderRegistrationCtx = createContext<Ctx | null>(null);

export function ProviderRegistrationProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [s1, setS1] = useState<Step1>(EMPTY_S1);
  const [s2, setS2] = useState<Step2>(EMPTY_S2);
  const [s3, setS3] = useState<Step3>(EMPTY_S3);
  const [s4, setS4] = useState<Step4>(EMPTY_S4);
  const restored = useRef(false);

  // Restore text-only fields once on first mount (survives same-tab refresh).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const savedStep = sessionStorage.getItem(STEP_KEY);
      if (savedStep) setStep(Math.min(Math.max(parseInt(savedStep, 10) || 1, 1), 5));
      const savedS1 = sessionStorage.getItem(S1_KEY);
      if (savedS1) setS1(p => ({ ...p, ...JSON.parse(savedS1) }));
      const savedS2 = sessionStorage.getItem(S2_KEY);
      if (savedS2) setS2(p => ({ ...p, ...JSON.parse(savedS2) }));
      const savedS3 = sessionStorage.getItem(S3_KEY);
      if (savedS3) setS3(p => ({ ...p, ...JSON.parse(savedS3) }));
      const savedS4 = sessionStorage.getItem(S4_KEY);
      if (savedS4) setS4(p => ({ ...p, ...JSON.parse(savedS4) }));
    } catch { /* ignore malformed storage */ }
  }, []);

  // Mirror serializable fields to sessionStorage on every change.
  useEffect(() => { try { sessionStorage.setItem(STEP_KEY, String(step)); } catch { /* quota */ } }, [step]);
  useEffect(() => { try { sessionStorage.setItem(S1_KEY, JSON.stringify(s1)); } catch { /* quota */ } }, [s1]);
  useEffect(() => {
    try { sessionStorage.setItem(S2_KEY, JSON.stringify({ experience: s2.experience, about: s2.about, serviceAreas: s2.serviceAreas })); } catch { /* quota */ }
  }, [s2.experience, s2.about, s2.serviceAreas]);
  useEffect(() => {
    try { sessionStorage.setItem(S3_KEY, JSON.stringify({ instagram: s3.instagram, website: s3.website })); } catch { /* quota */ }
  }, [s3.instagram, s3.website]);
  useEffect(() => {
    try { sessionStorage.setItem(S4_KEY, JSON.stringify({ termsAccepted: s4.termsAccepted })); } catch { /* quota */ }
  }, [s4.termsAccepted]);

  const resetRegistration = useCallback(() => {
    setStep(1); setS1(EMPTY_S1); setS2(EMPTY_S2); setS3(EMPTY_S3); setS4(EMPTY_S4);
    try {
      sessionStorage.removeItem(STEP_KEY);
      sessionStorage.removeItem(S1_KEY);
      sessionStorage.removeItem(S2_KEY);
      sessionStorage.removeItem(S3_KEY);
      sessionStorage.removeItem(S4_KEY);
    } catch { /* ignore */ }
  }, []);

  const hasProgress = !!(s1.fullName || s1.phone || s2.about || s3.portfolioFiles.length || s4.aadhaarFile);

  return (
    <ProviderRegistrationCtx.Provider value={{ step, setStep, s1, setS1, s2, setS2, s3, setS3, s4, setS4, hasProgress, resetRegistration }}>
      {children}
    </ProviderRegistrationCtx.Provider>
  );
}

export function useProviderRegistration(): Ctx {
  const ctx = useContext(ProviderRegistrationCtx);
  if (!ctx) throw new Error('useProviderRegistration must be used within a ProviderRegistrationProvider');
  return ctx;
}
