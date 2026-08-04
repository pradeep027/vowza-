// VendorWallet — 100% real balances and transactions from Supabase payments table.
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Wallet, TrendingUp, Clock, ArrowDownLeft, ArrowUpRight,
  Building2, Receipt, AlertCircle,
} from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorPayments } from '@/hooks/useVendorData';

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

export default function VendorWallet() {
  const [tab, setTab] = useState<'all' | 'credit' | 'debit'>('all');

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data: wallet, isLoading } = useVendorPayments(vendorId);

  const transactions = wallet?.transactions ?? [];

  // Classify: refunds/withdrawals are debits, everything else is a credit
  const isDebit = (t: any) =>
    String(t.payment_type ?? '').toLowerCase() === 'refund' ||
    String(t.payout_status ?? '').toLowerCase() === 'withdrawn';

  const filtered = tab === 'all'
    ? transactions
    : transactions.filter((t: any) => (tab === 'debit' ? isDebit(t) : !isDebit(t)));

  const bankSet = !!provider?.bank_account_number;

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Wallet</h1>
        <p className="text-sm text-muted-foreground">Your earnings and payout history</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#8B1538] to-[#c2185b] rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Wallet className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-sm text-white/70 mb-1">Available Balance</p>
          {isLoading
            ? <div className="h-9 w-32 bg-white/20 rounded animate-pulse" />
            : <p className="text-3xl font-bold">{inr(wallet?.available ?? 0)}</p>}
          <button
            disabled={!wallet?.available}
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
          <p className="text-[11px] text-muted-foreground mt-1">
            {inr(wallet?.withdrawn ?? 0)} withdrawn
          </p>
        </div>
      </div>

      {/* Bank details */}
      <div className="bg-white rounded-2xl border border-border/60 p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center',
            bankSet ? 'bg-blue-50' : 'bg-amber-50')}>
            {bankSet
              ? <Building2 className="w-5 h-5 text-blue-600" />
              : <AlertCircle className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            {bankSet ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  {provider.bank_name ?? 'Bank'} ****{String(provider.bank_account_number).slice(-4)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {provider.is_bank_verified ? 'Verified · Primary payout account' : 'Pending verification'}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">No payout account added</p>
                <p className="text-xs text-muted-foreground">Add bank details to receive payouts</p>
              </>
            )}
          </div>
        </div>
        <button className="text-xs font-semibold text-[#8B1538] hover:underline">
          {bankSet ? 'Change' : 'Add Bank Details'}
        </button>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-border/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-foreground">Transaction History</h3>
          {transactions.length > 0 && (
            <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
              {(['all', 'credit', 'debit'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                    tab === t ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground')}>
                  {t === 'all' ? 'All' : t === 'credit' ? 'Received' : 'Withdrawn'}
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
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Receipt className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
            <h3 className="text-base font-semibold text-foreground mb-2">No Transactions Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Payments from completed bookings will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((tx: any) => {
              const debit = isDebit(tx);
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
                      {debit ? '-' : '+'}{inr(tx.amount ?? 0)}
                    </p>
                    <span className={cn('text-[10px] font-semibold capitalize',
                      ['completed','success','paid','captured'].includes(status) ? 'text-emerald-600'
                      : status === 'pending' ? 'text-amber-600' : 'text-red-600')}>
                      {tx.status ?? '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
