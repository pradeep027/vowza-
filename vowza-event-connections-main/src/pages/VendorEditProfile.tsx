// ─── VendorEditProfile — Category-aware dashboard edit page ─────────────────
// Route: /vendor/edit — only accessible to logged-in providers
// Shows only the fields relevant to the vendor's category
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCategoryByProfession, type FieldDef } from "@/data/categoryConfig";
import Navbar from "@/components/Navbar";
import {
  Save, Plus, Trash2, Upload, ExternalLink, ChevronLeft,
} from "lucide-react";

const TABS = ["Profile", "Services", "Pricing", "Portfolio", "Availability", "FAQs", "Contact"] as const;
type Tab = typeof TABS[number];

export default function VendorEditProfile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<any>(null);
  const [profile,  setProfile]  = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Profile");
  const [saving, setSaving] = useState(false);
  const [form, setForm]   = useState<Record<string, any>>({});
  const [details, setDetails] = useState<Record<string, any>>({});
  const [packages, setPackages] = useState<any[]>([]);
  const [faqs,     setFaqs]     = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [rentalItems, setRentalItems] = useState<any[]>([]);
  const [poojaServices, setPoojaServices] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    const { data: p } = await supabase.from("provider_profiles").select("*").eq("user_id", user!.id).maybeSingle();
    if (!p) { toast.error("No provider profile found. Please complete onboarding first."); navigate("/artist/onboarding"); return; }
    setProvider(p);
    setForm({ stage_name: p.stage_name || "", bio: p.bio || "", experience_years: p.experience_years || 0, price_min: p.price_min || 0, price_max: p.price_max || 0, is_available: p.is_available ?? true, subcategory: p.subcategory || "", whatsapp: p.whatsapp || "", instagram: p.social_links?.instagram || "", facebook: p.social_links?.facebook || "", youtube: p.social_links?.youtube || "", website: p.social_links?.website || "" });
    setDetails(p.vendor_details || p.category_details || {});

    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
    if (prof) setProfile(prof);

    const [pkgRes, faqRes, portRes, menuRes, rentalRes, poojaRes] = await Promise.allSettled([
      supabase.from("pricing_packages" as any).select("*").eq("provider_id", p.id).order("sort_order"),
      supabase.from("provider_faqs"    as any).select("*").eq("provider_id", p.id).order("sort_order"),
      supabase.from("portfolio_items").select("*").eq("provider_id", p.id).order("created_at", { ascending: false }),
      supabase.from("menu_items"       as any).select("*").eq("provider_id", p.id).order("sort_order"),
      supabase.from("rental_items"     as any).select("*").eq("provider_id", p.id).order("created_at"),
      supabase.from("pooja_services"   as any).select("*").eq("provider_id", p.id).order("sort_order"),
    ]);
    if (pkgRes.status   === "fulfilled") setPackages(pkgRes.value.data ?? []);
    if (faqRes.status   === "fulfilled") setFaqs(faqRes.value.data ?? []);
    if (portRes.status  === "fulfilled") setPortfolio(portRes.value.data ?? []);
    if (menuRes.status  === "fulfilled") setMenuItems(menuRes.value.data ?? []);
    if (rentalRes.status === "fulfilled") setRentalItems(rentalRes.value.data ?? []);
    if (poojaRes.status  === "fulfilled") setPoojaServices(poojaRes.value.data ?? []);
  };

  const saveProfile = async () => {
    if (!provider) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("provider_profiles").update({
        stage_name:      form.stage_name || null,
        bio:             form.bio || null,
        experience_years: Number(form.experience_years) || 0,
        price_min:       Number(form.price_min) || null,
        price_max:       Number(form.price_max) || null,
        is_available:    form.is_available,
        subcategory:     form.subcategory || null,
        whatsapp:        form.whatsapp || null,
        vendor_details:  details,
        social_links:    { instagram: form.instagram, facebook: form.facebook, youtube: form.youtube, website: form.website },
        updated_at:      new Date().toISOString(),
      } as any).eq("id", provider.id);
      if (error) throw error;

      await supabase.from("profiles").update({ full_name: profile?.full_name, phone: form.phone || profile?.phone, city: form.city || profile?.city, area: form.area || profile?.area }).eq("id", user!.id);

      toast.success("Profile saved!"); loadAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const uploadMedia = async (file: File) => {
    if (!provider) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `portfolio/${provider.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("provider-media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("provider-media").getPublicUrl(path);
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      await supabase.from("portfolio_items").insert({ provider_id: provider.id, media_url: urlData.publicUrl, media_type: mediaType, title: file.name.split(".")[0] });
      toast.success("Uploaded!"); loadAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const deleteMedia = async (id: string, url: string) => {
    await supabase.from("portfolio_items").delete().eq("id", id);
    toast.success("Deleted"); loadAll();
  };

  const addPackage = () => setPackages(p => [...p, { id: null, name: "", price: 0, description: "", duration: "", features: [] }]);
  const savePackage = async (pkg: any, idx: number) => {
    if (!pkg.name) return;
    if (pkg.id) {
      await supabase.from("pricing_packages" as any).update({ name: pkg.name, price: Number(pkg.price), description: pkg.description, duration: pkg.duration, features: pkg.features, sort_order: idx } as any).eq("id", pkg.id);
    } else {
      const { data } = await supabase.from("pricing_packages" as any).insert({ provider_id: provider.id, name: pkg.name, price: Number(pkg.price), description: pkg.description, duration: pkg.duration, features: pkg.features, sort_order: idx, is_active: true } as any).select().single();
      if (data) setPackages(p => p.map((x, i) => i === idx ? data : x));
    }
    toast.success("Package saved");
  };
  const deletePackage = async (id: string, idx: number) => {
    if (id) await supabase.from("pricing_packages" as any).delete().eq("id", id);
    setPackages(p => p.filter((_, i) => i !== idx));
  };

  const addFaq = () => setFaqs(f => [...f, { id: null, question: "", answer: "" }]);
  const saveFaq = async (faq: any, idx: number) => {
    if (!faq.question || !faq.answer) return;
    if (faq.id) { await supabase.from("provider_faqs" as any).update({ question: faq.question, answer: faq.answer } as any).eq("id", faq.id); }
    else { await supabase.from("provider_faqs" as any).insert({ provider_id: provider.id, question: faq.question, answer: faq.answer, sort_order: idx } as any); loadAll(); }
    toast.success("FAQ saved");
  };
  const deleteFaq = async (id: string, idx: number) => {
    if (id) await supabase.from("provider_faqs" as any).delete().eq("id", id);
    setFaqs(f => f.filter((_, i) => i !== idx));
  };

  const cat = provider ? getCategoryByProfession(provider.profession) : null;
  const f = (key: string) => (v: any) => setForm(p => ({ ...p, [key]: v }));
  const d = (key: string) => (v: any) => setDetails(p => ({ ...p, [key]: v }));

  const renderField = (field: FieldDef, val: any, onChange: (v: any) => void) => {
    if (field.type === "boolean") return (
      <label key={field.key} className="flex items-center gap-2.5 cursor-pointer">
        <div onClick={() => onChange(!val)} className={cn("w-5 h-5 rounded border flex items-center justify-center", val ? "bg-maroon border-maroon" : "border-border")}>
          {val && <span className="text-white text-[10px] font-bold">✓</span>}
        </div>
        <span className="text-sm font-medium text-foreground">{field.label}</span>
      </label>
    );
    if (field.type === "select" && field.options) return (
      <div key={field.key}>
        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{field.label}</label>
        <select value={val || ""} onChange={e => onChange(e.target.value)} className="input-premium text-sm w-full">
          <option value="">Select…</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
    if (field.type === "textarea") return (
      <div key={field.key}>
        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{field.label}</label>
        <textarea value={val || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={4} className="input-premium text-sm w-full resize-none" />
      </div>
    );
    if (field.type === "tags") return (
      <div key={field.key}>
        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{field.label}</label>
        <input value={Array.isArray(val) ? val.join(", ") : (val || "")} onChange={e => onChange(e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder={field.placeholder} className="input-premium text-sm w-full" />
        <p className="text-[10px] text-muted-foreground mt-1">Separate with commas</p>
      </div>
    );
    return (
      <div key={field.key}>
        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{field.label}</label>
        <input type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"} value={val || ""} onChange={e => onChange(field.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)} placeholder={field.placeholder} className="input-premium text-sm w-full" />
      </div>
    );
  };

  if (!provider) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-maroon border-t-transparent animate-spin" />
    </div>
  );

  const basicFields   = cat?.fields.filter(f => f.section === "basic") ?? [];
  const serviceFields = cat?.fields.filter(f => f.section === "services") ?? [];
  const pricingFields = cat?.fields.filter(f => f.section === "pricing") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 py-8 mt-14">

        {/* ── Approval status banner ── */}
        {provider && provider.verification_status !== 'approved' && (
          <div className={`mb-6 rounded-2xl border p-4 flex items-start gap-3 ${
            provider.verification_status === 'pending'
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200'
              : 'bg-red-50 dark:bg-red-950/20 border-red-200'
          }`}>
            <div className="flex-1">
              <p className={`text-sm font-bold mb-1 ${provider.verification_status === 'pending' ? 'text-amber-700' : 'text-red-700'}`}>
                {provider.verification_status === 'pending'
                  ? '⏳ Profile Under Review'
                  : '❌ Profile Not Approved'}
              </p>
              {provider.rejection_reason && (
                <p className="text-xs text-red-600 mb-2">
                  Reason: <strong>{provider.rejection_reason}</strong>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {provider.verification_status === 'pending'
                  ? 'Our team is reviewing your profile. You will be notified within 24–48 hours. You can update your profile below while you wait.'
                  : 'Please fix the issue above and click "Resubmit for Review" to send your profile back to the admin for approval.'}
              </p>
            </div>
            {provider.verification_status === 'rejected' && (
              <button
                onClick={async () => {
                  await supabase.from("provider_profiles").update({ verification_status: "pending", rejection_reason: null } as any).eq("id", provider.id);
                  toast.success("Profile resubmitted for review! Our team will review within 24–48 hours.");
                  loadAll();
                }}
                className="flex-shrink-0 px-4 py-2 rounded-xl bg-maroon text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Resubmit for Review
              </button>
            )}
          </div>
        )}

        {/* Approved badge */}
        {provider && provider.verification_status === 'approved' && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 flex items-center gap-2.5">
            <span className="text-emerald-500 text-base">✅</span>
            <p className="text-sm font-semibold text-emerald-700">
              Profile is Live on Vowza — customers can discover and book you.
            </p>
            <a href={`/artist/${provider.id}`} target="_blank" rel="noopener noreferrer"
              className="ml-auto text-xs font-semibold text-emerald-700 underline flex-shrink-0">
              View public profile →
            </a>
          </div>
        )}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/provider/dashboard")} className="p-2 rounded-lg hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Edit Profile</h1>
            <p className="text-sm text-muted-foreground">{cat?.plural || "Vendor"} profile</p>
          </div>
          <button onClick={saveProfile} disabled={saving} className="ml-auto btn-primary flex items-center gap-2 py-2.5 px-5 text-sm">
            <Save className="w-4 h-4" />{saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary rounded-xl border border-border/50 mb-7 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn("flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                activeTab === t ? "bg-white dark:bg-gray-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>

        <div className="max-w-3xl space-y-5">

          {/* PROFILE TAB */}
          {activeTab === "Profile" && (
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">Business / Stage Name</label><input value={form.stage_name} onChange={e => f("stage_name")(e.target.value)} placeholder="Your business name" className="input-premium text-sm w-full" /></div>
                <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">Experience (years)</label><input type="number" value={form.experience_years} onChange={e => f("experience_years")(e.target.value)} className="input-premium text-sm w-full" /></div>
                <div className="sm:col-span-2"><label className="text-xs font-semibold text-muted-foreground block mb-1.5">Subcategory</label>
                  <select value={form.subcategory} onChange={e => f("subcategory")(e.target.value)} className="input-premium text-sm w-full">
                    <option value="">Select subcategory</option>
                    {cat?.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2"><label className="text-xs font-semibold text-muted-foreground block mb-1.5">About / Bio</label><textarea value={form.bio} onChange={e => f("bio")(e.target.value)} rows={5} placeholder="Describe your services, experience, and what makes you unique…" className="input-premium text-sm w-full resize-none" /></div>
              </div>
              {basicFields.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mt-4 mb-3">Category-Specific Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {basicFields.map(field => renderField(field, details[field.key], d(field.key)))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                <div onClick={() => f("is_available")(!form.is_available)} className={cn("w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center", form.is_available ? "bg-emerald-500" : "bg-gray-300")}>
                  <div className={cn("w-4 h-4 bg-white rounded-full mx-1 transition-transform", form.is_available && "translate-x-4")} />
                </div>
                <span className="text-sm font-medium text-foreground">Available for bookings</span>
              </div>
            </div>
          )}

          {/* SERVICES TAB */}
          {activeTab === "Services" && (
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Service Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {serviceFields.map(field => renderField(field, details[field.key], d(field.key)))}
              </div>
              {serviceFields.length === 0 && <p className="text-sm text-muted-foreground">No category-specific service fields. Complete your profile in the Profile tab.</p>}
            </div>
          )}

          {/* PRICING TAB */}
          {activeTab === "Pricing" && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-4">
                <h3 className="font-semibold text-foreground">Base Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">Starting Price (₹)</label><input type="number" value={form.price_min} onChange={e => f("price_min")(e.target.value)} className="input-premium text-sm w-full" /></div>
                  <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">Maximum Price (₹)</label><input type="number" value={form.price_max} onChange={e => f("price_max")(e.target.value)} className="input-premium text-sm w-full" /></div>
                  {pricingFields.map(field => renderField(field, details[field.key], d(field.key)))}
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Packages</h3>
                  <button onClick={addPackage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-maroon text-white text-xs font-semibold hover:opacity-90"><Plus className="w-3.5 h-3.5" />Add Package</button>
                </div>
                <div className="space-y-4">
                  {packages.map((pkg, i) => (
                    <div key={pkg.id || i} className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Package Name</label><input value={pkg.name} onChange={e => setPackages(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="e.g. Wedding Package" className="input-premium text-sm w-full" /></div>
                        <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Price (₹)</label><input type="number" value={pkg.price} onChange={e => setPackages(p => p.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} className="input-premium text-sm w-full" /></div>
                        <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Duration</label><input value={pkg.duration || ""} onChange={e => setPackages(p => p.map((x, idx) => idx === i ? { ...x, duration: e.target.value } : x))} placeholder="e.g. Full Day" className="input-premium text-sm w-full" /></div>
                      </div>
                      <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Description</label><textarea value={pkg.description || ""} onChange={e => setPackages(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} rows={2} className="input-premium text-sm w-full resize-none" /></div>
                      <div className="flex gap-2">
                        <button onClick={() => savePackage(pkg, i)} className="px-3 py-1.5 rounded-lg bg-maroon text-white text-xs font-semibold hover:opacity-90">Save</button>
                        <button onClick={() => deletePackage(pkg.id, i)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PORTFOLIO TAB */}
          {activeTab === "Portfolio" && (
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Portfolio & Gallery</h3>
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-maroon text-white text-xs font-semibold cursor-pointer hover:opacity-90">
                  <Upload className="w-3.5 h-3.5" />{uploading ? "Uploading…" : "Upload"}
                  <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={uploading}
                    onChange={e => { Array.from(e.target.files || []).forEach(uploadMedia); e.target.value = ""; }} />
                </label>
              </div>
              {portfolio.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No portfolio items. Upload images and videos to showcase your work.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {portfolio.map((item: any) => (
                    <div key={item.id} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
                      {item.media_type === "video" ? (
                        <div className="w-full h-full flex items-center justify-center bg-secondary"><span className="text-xs text-muted-foreground">Video</span></div>
                      ) : (
                        <img src={item.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      )}
                      <button onClick={() => deleteMedia(item.id, item.media_url)} className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FAQs TAB */}
          {activeTab === "FAQs" && (
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">FAQs</h3>
                <button onClick={addFaq} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-maroon text-white text-xs font-semibold hover:opacity-90"><Plus className="w-3.5 h-3.5" />Add FAQ</button>
              </div>
              {faqs.map((faq, i) => (
                <div key={faq.id || i} className="p-4 rounded-xl bg-surface-2 border border-border/60 space-y-3">
                  <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Question</label><input value={faq.question} onChange={e => setFaqs(f => f.map((x, idx) => idx === i ? { ...x, question: e.target.value } : x))} placeholder="e.g. Do you travel outside the city?" className="input-premium text-sm w-full" /></div>
                  <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Answer</label><textarea value={faq.answer} onChange={e => setFaqs(f => f.map((x, idx) => idx === i ? { ...x, answer: e.target.value } : x))} rows={3} className="input-premium text-sm w-full resize-none" /></div>
                  <div className="flex gap-2">
                    <button onClick={() => saveFaq(faq, i)} className="px-3 py-1.5 rounded-lg bg-maroon text-white text-xs font-semibold hover:opacity-90">Save</button>
                    <button onClick={() => deleteFaq(faq.id, i)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CONTACT TAB */}
          {activeTab === "Contact" && (
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Contact & Social Links</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">WhatsApp</label><input value={form.whatsapp} onChange={e => f("whatsapp")(e.target.value)} placeholder="+91 9876543210" className="input-premium text-sm w-full" /></div>
                <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">Instagram</label><input value={form.instagram} onChange={e => f("instagram")(e.target.value)} placeholder="@yourhandle" className="input-premium text-sm w-full" /></div>
                <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">YouTube</label><input value={form.youtube} onChange={e => f("youtube")(e.target.value)} placeholder="youtube.com/c/..." className="input-premium text-sm w-full" /></div>
                <div><label className="text-xs font-semibold text-muted-foreground block mb-1.5">Website</label><input value={form.website} onChange={e => f("website")(e.target.value)} placeholder="https://yoursite.com" className="input-premium text-sm w-full" /></div>
              </div>
            </div>
          )}

          {/* AVAILABILITY TAB */}
          {activeTab === "Availability" && (
            <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Availability</h3>
              <p className="text-sm text-muted-foreground">Set your availability calendar. Blocked dates will show as unavailable to customers.</p>
              <div className="flex items-center gap-3">
                <div onClick={() => f("is_available")(!form.is_available)} className={cn("w-10 h-6 rounded-full cursor-pointer flex items-center transition-colors", form.is_available ? "bg-emerald-500" : "bg-gray-300")}>
                  <div className={cn("w-4 h-4 bg-white rounded-full mx-1 transition-transform", form.is_available && "translate-x-4")} />
                </div>
                <span className="text-sm font-medium text-foreground">Currently accepting bookings</span>
              </div>
              <p className="text-xs text-muted-foreground">Manage blocked dates from your Provider Dashboard → Availability Calendar.</p>
              <button onClick={() => navigate("/provider/dashboard")} className="btn-outline text-sm py-2.5 flex items-center gap-2"><ExternalLink className="w-4 h-4" />Open Availability Calendar</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
