// VendorReviews — 100% real reviews from Supabase with reply capability.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Star, MessageSquare, Send, X } from 'lucide-react';
import { useVendorId, useVendorRealtime, useVendorReviews } from '@/hooks/useVendorData';

export default function VendorReviews() {
  const qc = useQueryClient();
  const [replyTo, setReplyTo]   = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy]         = useState(false);

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const { data, isLoading } = useVendorReviews(vendorId);

  const reviews   = data?.reviews   ?? [];
  const average   = data?.average   ?? 0;
  const total     = data?.total     ?? 0;
  const breakdown = data?.breakdown ?? [5,4,3,2,1].map(s => ({ stars: s, count: 0, percent: 0 }));

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) { toast.error('Reply cannot be empty'); return; }
    setBusy(true);
    const { error } = await supabase
      .from('reviews' as any)
      .update({ reply: replyText.trim(), replied_at: new Date().toISOString() })
      .eq('id', reviewId);

    if (error) toast.error(error.message);
    else {
      toast.success('Reply posted');
      setReplyTo(null);
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['vendor-reviews'] });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : total > 0 ? `${total} review${total === 1 ? '' : 's'} from customers` : 'No reviews yet'}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-border/60 p-6 text-center">
          {isLoading ? (
            <div className="h-14 w-24 bg-muted rounded mx-auto animate-pulse" />
          ) : (
            <p className="text-5xl font-bold text-foreground mb-2">
              {total > 0 ? average.toFixed(1) : '—'}
            </p>
          )}
          <div className="flex items-center justify-center gap-0.5 mb-2">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={cn('w-5 h-5',
                total > 0 && i <= Math.round(average) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200')} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} total review${total === 1 ? '' : 's'}` : 'Awaiting first review'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-3">
          {breakdown.map(({ stars, count, percent }) => (
            <div key={stars} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground w-4">{stars}</span>
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                  style={{ width: `${percent}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border/60 p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/4 mb-3" />
              <div className="h-4 bg-muted rounded w-full mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border/60 p-16 text-center">
          <Star className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
          <h3 className="text-base font-semibold text-foreground mb-2">No Reviews Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Reviews appear here after customers complete their bookings. Great service earns great reviews.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review: any) => {
            const name = review.customer?.full_name ?? 'Customer';
            return (
              <div key={review.id} className="bg-white rounded-2xl border border-border/60 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {review.customer?.avatar_url ? (
                      <img src={review.customer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{name}</p>
                      <div className="flex gap-0.5 mt-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={cn('w-3 h-3',
                            i <= Number(review.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200')} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {review.comment ? (
                  <p className="text-sm text-foreground leading-relaxed mb-3">{review.comment}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic mb-3">
                    Rated {review.rating}/5 without a written comment.
                  </p>
                )}

                {review.reply ? (
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border-l-2 border-[#8B1538] ml-4">
                    <p className="text-[11px] font-semibold text-[#8B1538] mb-1">Your Reply</p>
                    <p className="text-xs text-foreground">{review.reply}</p>
                  </div>
                ) : replyTo === review.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                      rows={3} placeholder="Write a professional reply…"
                      className="w-full px-3 py-2.5 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => submitReply(review.id)} disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B1538] text-white text-xs font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
                        <Send className="w-3 h-3" /> {busy ? 'Posting…' : 'Post Reply'}
                      </button>
                      <button onClick={() => { setReplyTo(null); setReplyText(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setReplyTo(review.id); setReplyText(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors">
                    <MessageSquare className="w-3 h-3" /> Reply
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
