// ─── Admin Settings ───────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Save, Globe, IndianRupee, Mail, Key, Percent } from 'lucide-react';

// ── Reusable setting card — module scope (stable reference) ──────────────────
function Section({
  title, icon: Icon, children, onSave,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onSave: () => void;
}) {
  return (
    <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-maroon text-white text-xs font-semibold hover:opacity-90"
        >
          <Save className="w-3.5 h-3.5" />Save
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Controlled field — module scope ──────────────────────────────────────────
function Field({
  label, id, value, onChange, type = 'text', placeholder = '',
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold text-muted-foreground block mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-premium text-sm w-full"
        autoComplete={type === 'password' ? 'new-password' : 'off'}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminSettings() {
  const [platformName,  setPlatformName]  = useState('Vowza');
  const [supportEmail,  setSupportEmail]  = useState('');
  const [contactPhone,  setContactPhone]  = useState('');
  const [commission,    setCommission]    = useState('10');
  const [razorpayKey,   setRazorpayKey]   = useState('');
  const [smtpHost,      setSmtpHost]      = useState('');
  const [smtpPort,      setSmtpPort]      = useState('587');
  const [smtpUser,      setSmtpUser]      = useState('');
  const [openaiKey,     setOpenaiKey]     = useState('');
  const [supabaseKey,   setSupabaseKey]   = useState('');

  // Platform Fee state (real DB-backed)
  const [feeType, setFeeType] = useState<'percentage' | 'fixed'>('percentage');
  const [feeRate, setFeeRate] = useState('5');
  const [feeEnabled, setFeeEnabled] = useState(true);
  const [feeSaving, setFeeSaving] = useState(false);

  // Load platform fee from DB on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('platform_settings' as any).select('value').eq('key', 'platform_fee').maybeSingle();
      if (data) {
        const val = (data as any).value;
        setFeeType(val?.type || 'percentage');
        setFeeRate(String(val?.rate ?? 5));
        setFeeEnabled(val?.enabled !== false);
      }
    })();
  }, []);

  // Save platform fee to DB
  const savePlatformFee = async () => {
    const rate = Number(feeRate);
    if (isNaN(rate) || rate < 0 || (feeType === 'percentage' && rate > 100)) {
      toast.error('Invalid fee value'); return;
    }
    setFeeSaving(true);
    const { error } = await supabase.from('platform_settings' as any).update({
      value: { type: feeType, rate, enabled: feeEnabled },
      updated_at: new Date().toISOString(),
    }).eq('key', 'platform_fee');
    setFeeSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Platform fee updated successfully');
  };
  const save = (section: string) =>
    toast.success(`${section} settings saved (connect DB to persist)`);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Platform configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Platform Fee (real DB-backed) ──────────────────────────────── */}
        <Section title="Platform Fee" icon={Percent} onSave={savePlatformFee}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1.5">Fee Type</label>
              <select value={feeType} onChange={e => setFeeType(e.target.value as any)} className="input-premium text-sm w-full">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <Field id="fee-rate" label={feeType === 'percentage' ? 'Fee Percentage (%)' : 'Fee Amount (₹)'} value={feeRate} onChange={setFeeRate} type="number" placeholder={feeType === 'percentage' ? '5' : '500'} />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="fee-enabled" checked={feeEnabled} onChange={e => setFeeEnabled(e.target.checked)} className="w-4 h-4 rounded border-border" />
              <label htmlFor="fee-enabled" className="text-xs font-medium text-muted-foreground">Fee Enabled</label>
            </div>
            {feeEnabled && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700">
                Current: {feeType === 'percentage' ? `${feeRate}% of subtotal` : `₹${Number(feeRate).toLocaleString()} flat fee`} — applies to all categories
              </div>
            )}
            {feeSaving && <p className="text-xs text-muted-foreground animate-pulse">Saving...</p>}
          </div>
        </Section>

        <Section title="Platform" icon={Globe} onSave={() => save('Platform')}>
          <div className="space-y-3">
            <Field id="platform-name"  label="Platform Name"  value={platformName}  onChange={setPlatformName}  placeholder="Vowza" />
            <Field id="support-email"  label="Support Email"  value={supportEmail}  onChange={setSupportEmail}  placeholder="support@vowza.com" />
            <Field id="contact-phone"  label="Contact Phone"  value={contactPhone}  onChange={setContactPhone}  placeholder="+91 87123 21751" />
          </div>
        </Section>

        <Section title="Commission & Payments" icon={IndianRupee} onSave={() => save('Commission')}>
          <div className="space-y-3">
            <Field id="commission"    label="Platform Commission (%)" value={commission}  onChange={setCommission}  type="number" placeholder="10" />
            <Field id="razorpay-key" label="Razorpay Key ID"          value={razorpayKey} onChange={setRazorpayKey} placeholder="rzp_live_xxx" />
            <Field id="razorpay-sec" label="Razorpay Key Secret"      value=""            onChange={() => {}}       type="password" placeholder="•••••••••" />
          </div>
        </Section>

        <Section title="SMTP / Email" icon={Mail} onSave={() => save('SMTP')}>
          <div className="space-y-3">
            <Field id="smtp-host" label="SMTP Host"     value={smtpHost} onChange={setSmtpHost} placeholder="smtp.sendgrid.net" />
            <Field id="smtp-port" label="SMTP Port"     value={smtpPort} onChange={setSmtpPort} type="number" />
            <Field id="smtp-user" label="SMTP Username" value={smtpUser} onChange={setSmtpUser} placeholder="apikey" />
            <Field id="smtp-pass" label="SMTP Password" value=""         onChange={() => {}}    type="password" placeholder="•••••••••" />
          </div>
        </Section>

        <Section title="API Keys" icon={Key} onSave={() => save('API Keys')}>
          <div className="space-y-3">
            <Field id="openai-key"    label="OpenAI API Key"        value={openaiKey}   onChange={setOpenaiKey}   type="password" placeholder="sk-proj-•••••" />
            <Field id="supabase-key"  label="Supabase Service Key"  value={supabaseKey} onChange={setSupabaseKey} type="password" placeholder="eyJh•••••" />
            <Field id="otp-key"       label="OTP Provider Key"      value=""            onChange={() => {}}       type="password" placeholder="Twilio / MSG91" />
          </div>
        </Section>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700 dark:text-amber-400">
        ⚠️ API keys should be stored as environment variables (.env), not in the database. Changes here are for reference only.
      </div>
    </div>
  );
}
