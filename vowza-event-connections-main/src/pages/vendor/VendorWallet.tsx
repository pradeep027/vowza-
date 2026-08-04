// VendorWallet — Premium wallet with balance, transactions, and withdrawal
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Wallet, IndianRupee, TrendingUp, Clock, ArrowDownLeft,
  ArrowUpRight, Download, CreditCard, Building2,
} from 'lucide-react';

interface Transaction {
  id: string; type: 'credit' | 'debit'; amount: number;
  description: string; date: string; status: 'completed' | 'pending' | 'failed';
}

const transactions: Transaction[] = [
  { id: '1', type: 'credit', amount: 25000, description: 'Booking — Rahul Sharma (Wedding)', date: '2026-08-10', status: 'completed' },
  { id: '2', type: 'credit', amount: 10000, description: 'Booking — Priya Reddy (Birthday)', date: '2026-08-08', status: 'completed' },
  { id: '3', type: 'debit', amount: 35000, description: 'Withdrawal to Bank Account', date: '2026-08-05', status: 'completed' },
  { id: '4', type: 'credit', amount: 50000, description: 'Booking — Ankit Gupta (Corporate)', date: '2026-08-03', status: 'completed' },
  { id: '5', type: 'credit', amount: 15000, description: 'Booking — Meera Joshi (Engagement)', date: '2026-08-01', status: 'pending' },
  { id: '6', type: 'debit', amount: 2500, description: 'Platform fee — July 2026', date: '2026-07-31', status: 'completed' },
];

export default function VendorWallet() {
  const [tab, setTab] = useState<'all' | 'credit' | 'debit'>('all');

  const filtered = tab === 'all' ? transactions : transactions.filter(t => t.type === tab);

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Wallet</h1>
        <p className="text-sm text-muted-foreground">Manage your earnings and withdrawals</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#8B1538] to-[#c2185b] rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Wallet className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-sm text-white/70 mb-1">Available Balance</p>
          <p className="text-3xl font-bold">₹1,25,000</p>
          <button className="mt-4 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors backdrop-blur-sm">
            Withdraw
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Pending Amount</p>
          <p className="text-2xl font-bold text-foreground">₹65,000</p>
          <p className="text-[11px] text-muted-foreground mt-1">Releases after event completion</p>
        </div>
        <div className="bg-white rounded-2xl border border-border/60 p-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Lifetime Earnings</p>
          <p className="text-2xl font-bold text-foreground">₹8,45,000</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">+22% this month</p>
        </div>
      </div>

      {/* Bank Details Card */}
      <div className="bg-white rounded-2xl border border-border/60 p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">HDFC Bank ****4523</p>
            <p className="text-xs text-muted-foreground">Primary withdrawal account</p>
          </div>
        </div>
        <button className="text-xs font-semibold text-[#8B1538] hover:underline">Change</button>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-border/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-foreground">Transaction History</h3>
          <div className="flex gap-1 p-0.5 bg-secondary rounded-lg">
            {(['all', 'credit', 'debit'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize',
                  tab === t ? 'bg-white shadow-xs text-foreground' : 'text-muted-foreground')}>
                {t === 'all' ? 'All' : t === 'credit' ? 'Received' : 'Withdrawn'}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {filtered.map(tx => (
            <div key={tx.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors">
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center',
                  tx.type === 'credit' ? 'bg-emerald-50' : 'bg-red-50')}>
                  {tx.type === 'credit' ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-red-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.description}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-bold', tx.type === 'credit' ? 'text-emerald-600' : 'text-red-600')}>
                  {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                </p>
                <span className={cn('text-[10px] font-semibold',
                  tx.status === 'completed' ? 'text-emerald-600' : tx.status === 'pending' ? 'text-amber-600' : 'text-red-600')}>
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
