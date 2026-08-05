// PaymentHistoryPage — real payments data, sorted latest first
import { motion, AnimatePresence } from 'framer-motion';
import { usePayments } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { CreditCard, Download, Receipt } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PaymentStatus = Database['public']['Enums']['payment_status'];

const statusStyles: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  refunded: 'bg-sky-100 text-sky-700 border-sky-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

export default function PaymentHistoryPage() {
  const { payments, isLoading } = usePayments();

  const handleDownload = (p: (typeof payments)[number]) => {
    const html = `
      <html><head><title>Receipt - ${p.id}</title>
      <style>body{font-family:sans-serif;padding:40px;color:#222}
      h1{color:#8B1538}table{width:100%;border-collapse:collapse;margin-top:20px}
      td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}</style></head>
      <body>
        <h1>Vowza Payment Receipt</h1>
        <table>
          <tr><th>Artist</th><td>${p.provider_name}</td></tr>
          <tr><th>Amount</th><td>₹${p.amount.toLocaleString()}</td></tr>
          <tr><th>Payment Method</th><td>${p.payment_method ?? '—'}</td></tr>
          <tr><th>Status</th><td>${p.status}</td></tr>
          <tr><th>Transaction ID</th><td>${p.transaction_id ?? '—'}</td></tr>
          <tr><th>Date</th><td>${new Date(p.created_at).toLocaleDateString('en-IN')}</td></tr>
        </table>
      </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Payment History</h1>
        <p className="text-muted-foreground text-sm mt-1">All your transactions, sorted by most recent.</p>
      </div>

      {payments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-2xl bg-white border border-border overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Booking</span>
            <span>Amount</span>
            <span>Method</span>
            <span>Status</span>
            <span className="text-right">Invoice</span>
          </div>
          <AnimatePresence>
            {payments.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 px-5 py-4 border-t border-border/70 items-center"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{p.provider_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.booking_event_date ? new Date(p.booking_event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    {p.booking_venue_city ? ` • ${p.booking_venue_city}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-[#8B1538]">₹{p.amount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground capitalize">{p.payment_method?.replace(/_/g, ' ') ?? '—'}</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border w-fit ${statusStyles[p.status]}`}>
                  {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </span>
                <div className="md:text-right">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(p)}>
                    <Download className="w-4 h-4 mr-1" /> Download
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-dashed border-border bg-white/60 py-16 flex flex-col items-center text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B1538]/10 to-[#D4AF37]/10 flex items-center justify-center mb-4">
        <Receipt className="w-8 h-8 text-[#8B1538]" />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground mb-1">No payments yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        Your payment receipts will appear here once you complete a booking.
      </p>
    </motion.div>
  );
}
