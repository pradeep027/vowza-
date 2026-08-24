// VendorWallet — single sidebar entry, four internal tabs.
// Overview · Transaction History · Payouts · Bank Details
// 100% real Supabase data. Zero mock values.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Wallet, TrendingUp, Clock, ArrowDownLeft, ArrowUpRight,
  Building2, Receipt, AlertCircle, ShieldCheck, Landmark,
  Loader2, Save, BadgeCheck,
} from 'lucide-react';
import {
  useVendorId, useVendorRealtime, useVendorPayments,
  useVendorBankDetails, saveBankDetails,
} from '@/hooks/useVendorData';

const inr = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

type Tab = 'overview' | 'transactions' | 'payouts' | 'bank';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'transactions', label: 'Transaction History' },
  { key: 'payouts',      label: 'Payouts' },
  { key: 'bank',         label: 'Bank Details' },
];

const isDone  = (s: any) => ['completed', 'success', 'paid', 'captured'].includes(String(s ?? '').toLowerCase());
const isDebit = (t: any) =>
  String(t.payment_type ?? '').toLowerCase() === 'refund' ||
  String(t.payout_status ?? '').toLowerCase() === 'withdrawn';

export default function VendorWallet() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [txFilter, setTxFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data: wallet, isLoading } = useVendorPayments(vendorId);
  const { data: bank, isLoading: bankLoading } = useVendorBankDetails(vendorId);

  const transactions = wallet?.transactions ?? [];

  // ── Bank form ─────────────────────────────────────────────────────────────
  const [bankForm, setBankForm] = useState({
    bank_account_holder: '', bank_name: '', bank_account_number: '',
    bank_ifsc: '', branch_name: '',
  });
  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank]   = useState(false);

  const startEditBank = () => {
    setBankForm({
      bank_account_holder: bank?.accountHolder ?? '',
      bank_name:           bank?.bankName ?? '',
      bank_account_number: bank?.accountNumber ?? '',
      bank_ifsc:           bank?.ifsc ?? '',
      branch_name:         bank?.branchName ?? '',
    });
    setEditingBank(true);
  };

  const submitBank = async () => {
    if (!vendorId) return;
    if (!bankForm.bank_account_holder.trim()) { toast.error('Account holder name is required'); return; }
    if (!bankForm.bank_account_number.trim()) { toast.error('Account number is required'); return; }
    if (!bankForm.bank_ifsc.trim())           { toast.error('IFSC code is required'); return; }

    setSavingBank(true);
    const { error } = await saveBankDetails(vendorId, {
      bank_account_holder: bankForm.bank_account_holder.trim(),
      bank_name:           bankForm.bank_name.trim(),
      bank_account_number: bankForm.bank_account_number.trim(),
      bank_ifsc:           bankForm.bank_ifsc.trim().toUpperCase(),
      branch_name:         bankForm.branch_name.trim(),
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Bank details saved. Verification is pending.');
      setEditingBank(false);
      qc.invalidateQueries({ queryKey: ['vendor-bank'] });
      qc.invalidateQueries({ queryKey: ['vendor-id'] });
    }
    setSavingBank(false);
  };

  // ── Derived payout rows ───────────────────────────────────────────────────
  const payoutRows = transactions.filter((t: any) =>
    String(t.payout_status ?? '').toLowerCase() === 'withdrawn' ||
    String(t.payment_type ?? '').toLowerCase() === 'payout'
  );

  const filteredTx = txFilter === 'all'
    ? transactions
    : transactions.filter((t: any) => (txFilter === 'debit' ? isDebit(t) : !isDebit(t)));

  const Field = ({ label, value, onChange, placeholder, upper }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; upper?: boolean;
  }) => (
    <div>
      <label className="text-xs font-semibold text-foreground block mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 transition-all"
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Wallet</h1>
        <p className="text-sm text-muted-foreground">Earnings, transactions, payouts and bank details</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border/50 overflow-x-auto max-w-full">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
              tab === t.key ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW ══════════ */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#8B1538] to-[#c2185b] rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <Wallet className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-sm text-white/70 mb-1">Available Balance</p>
              {isLoading
                ? <div className="h-9 w-32 bg-white/20 rounded animate-pulse" />
                : <p className="text-3xl font-bold">{inr(wallet?.available ?? 0)}</p>}
              <button
                disabled={!wallet?.available || !bank?.hasBank}
                onClick={() => {
                  if (!bank?.hasBank) { setTab('bank'); toast.info('Add bank details first to withdraw.'); }
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors backdrop-blur-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Withdraw
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-border/60 p-6">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Pending Amount</p>
              {isLoading
                ? <div className="h-8 w-24 bg-muted rounded animate-pulse" />
                : <p className="text-2xl font-bold text-foreground">{inr(wallet?.pending ?? 0)}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">Releases after event completion</p>
            </div>

            <div className="bg-white rounded-2xl border border-border/60 p-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Lifetime Earnings</p>
              {isLoading
                ? <div className="h-8 w-28 bg-muted rounded animate-pulse" />
                : <p className="text-2xl font-bold text-foreground">{inr(wallet?.lifetime ?? 0)}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">{inr(wallet?.withdrawn ?? 0)} withdrawn</p>
            </div>
          </div>

          {/* Bank summary strip */}
          <div className="bg-white rounded-2xl border border-border/60 p-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center',
                bank?.hasBank ? 'bg-blue-50' : 'bg-amber-50')}>
                {bank?.hasBank
                  ? <Building2 className="w-5 h-5 text-blue-600" />
                  : <AlertCircle className="w-5 h-5 text-amber-600" />}
              </div>
              <div>
                {bank?.hasBank ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      {bank.bankName ?? 'Bank'} · {bank.maskedAccount}
                    </p>
                    <p className={cn('text-xs', bank.isVerified ? 'text-emerald-600' : 'text-amber-600')}>
                      {bank.isVerified ? 'Verified payout account' : 'Verification pending'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">No payout account added</p>
                    <p className="text-xs text-muted-foreground">Add your bank details to receive payouts.</p>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setTab('bank')} className="text-xs font-semibold text-[#8B1538] hover:underline">
              {bank?.hasBank ? 'Manage' : 'Add Bank Details'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ TRANSACTION HISTORY ══════════ */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-border/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold text-foreground">Transaction History</h3>
            {transactions.length > 0 && (
              <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
                {(['all', 'credit', 'debit'] as const).map(f => (
                  <button key={f} onClick={() => setTxFilter(f)}
                    className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                      txFilter === f ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground')}>
                    {f === 'all' ? 'All' : f === 'credit' ? 'Received' : 'Withdrawn'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="divide-y divide-border/40">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted" />
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="p-16 text-center">
              <Receipt className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
              <h3 className="text-base font-semibold text-foreground mb-2">No Transactions Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Payments from completed bookings will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredTx.map((tx: any) => {
                const debit  = isDebit(tx);
                const status = String(tx.status ?? '').toLowerCase();
                return (
                  <div key={tx.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                        debit ? 'bg-red-50' : 'bg-emerald-50')}>
                        {debit
                          ? <ArrowUpRight className="w-4 h-4 text-red-600" />
                          : <ArrowDownLeft className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.payment_type
                            ? `${String(tx.payment_type).charAt(0).toUpperCase()}${String(tx.payment_type).slice(1)} payment`
                            : 'Payment'}
                          {tx.method ? ` · ${tx.method}` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(tx.paid_at ?? tx.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('text-sm font-bold', debit ? 'text-red-600' : 'text-emerald-600')}>
                        {debit ? '-' : '+'}{inr(tx.amount)}
                      </p>
                      <span className={cn('text-[10px] font-semibold capitalize',
                        isDone(status) ? 'text-emerald-600' : status === 'pending' ? 'text-amber-600' : 'text-red-600')}>
                        {tx.status ?? '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ PAYOUTS ══════════ */}
      {tab === 'payouts' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-border/60 p-5">
              <p className="text-xs text-muted-foreground mb-1">Available to Withdraw</p>
              <p className="text-xl font-bold text-foreground">{inr(wallet?.available ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border/60 p-5">
              <p className="text-xs text-muted-foreground mb-1">Total Withdrawn</p>
              <p className="text-xl font-bold text-foreground">{inr(wallet?.withdrawn ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border/60 p-5">
              <p className="text-xs text-muted-foreground mb-1">Payout Account</p>
              <p className="text-sm font-semibold text-foreground">
                {bank?.hasBank ? bank.maskedAccount : 'Not set'}
              </p>
            </div>
          </div>

          {!bank?.hasBank ? (
            <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
              <Landmark className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
              <h3 className="text-base font-semibold text-foreground mb-2">Payouts Not Enabled</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Add your bank details to receive payouts.
              </p>
              <button onClick={() => setTab('bank')}
                className="px-6 py-3 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
                Add Bank Details
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <h3 className="text-sm font-semibold text-foreground">Payout History</h3>
              </div>
              {payoutRows.length === 0 ? (
                <div className="p-16 text-center">
                  <ArrowUpRight className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
                  <h3 className="text-base font-semibold text-foreground mb-2">No Payouts Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Withdrawals to your bank account will be listed here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {payoutRows.map((p: any) => (
                    <div key={p.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <ArrowUpRight className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Payout to {bank.bankName ?? 'bank'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(p.paid_at ?? p.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{inr(p.amount)}</p>
                        <span className="text-[10px] font-semibold text-emerald-600 capitalize">{p.status ?? '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ BANK DETAILS ══════════ */}
      {tab === 'bank' && (
        <div className="bg-white rounded-2xl border border-border/60 p-6 max-w-xl">
          {bankLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-11 bg-muted rounded-xl" />)}
            </div>
          ) : editingBank ? (
            <>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {bank?.hasBank ? 'Update Bank Details' : 'Add Bank Details'}
              </h3>
              <p className="text-xs text-muted-foreground mb-5">
                Payouts are sent to this account. Changing it resets verification.
              </p>
              <div className="space-y-4">
                <Field label="Account Holder Name" value={bankForm.bank_account_holder}
                  onChange={v => setBankForm(f => ({ ...f, bank_account_holder: v }))}
                  placeholder="As printed on your passbook" />
                <Field label="Bank Name" value={bankForm.bank_name}
                  onChange={v => setBankForm(f => ({ ...f, bank_name: v }))}
                  placeholder="e.g. HDFC Bank" />
                <Field label="Account Number" value={bankForm.bank_account_number}
                  onChange={v => setBankForm(f => ({ ...f, bank_account_number: v }))}
                  placeholder="Your account number" />
                <Field label="IFSC Code" value={bankForm.bank_ifsc} upper
                  onChange={v => setBankForm(f => ({ ...f, bank_ifsc: v }))}
                  placeholder="e.g. HDFC0001234" />
                <Field label="Branch Name" value={bankForm.branch_name}
                  onChange={v => setBankForm(f => ({ ...f, branch_name: v }))}
                  placeholder="Optional" />
              </div>
              <div className="flex gap-3 pt-5">
                <button onClick={() => setEditingBank(false)} disabled={savingBank}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={submitBank} disabled={savingBank}
                  className="flex-1 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingBank ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Details</>}
                </button>
              </div>
            </>
          ) : bank?.hasBank ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-foreground">Bank Details</h3>
                <span className={cn('flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border',
                  bank.isVerified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200')}>
                  {bank.isVerified ? <><BadgeCheck className="w-3 h-3" /> Verified</> : <><Clock className="w-3 h-3" /> Pending</>}
                </span>
              </div>
              <dl className="space-y-4">
                {[
                  { label: 'Account Holder', value: bank.accountHolder },
                  { label: 'Bank Name',      value: bank.bankName },
                  { label: 'Account Number', value: bank.maskedAccount },
                  { label: 'IFSC Code',      value: bank.ifsc },
                  { label: 'Branch',         value: bank.branchName },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="text-sm font-medium text-foreground">{row.value || '—'}</dd>
                  </div>
                ))}
              </dl>
              <button onClick={startEditBank}
                className="w-full mt-6 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
                Update Bank Details
              </button>
            </>
          ) : (
            <div className="py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
                <Landmark className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">No Bank Details</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Add your bank details to receive payouts.
              </p>
              <button onClick={startEditBank}
                className="px-6 py-3 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors">
                Add Bank Details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
