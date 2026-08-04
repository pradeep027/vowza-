// VendorReviews — Premium reviews with rating breakdown and reply
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Star, MessageSquare, ThumbsUp, Flag } from 'lucide-react';

interface Review {
  id: string; customer_name: string; customer_avatar?: string;
  rating: number; comment: string; date: string; reply?: string;
  event_type?: string;
}

export default function VendorReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: provider } = await supabase.from('provider_profiles').select('id, average_rating, total_reviews').eq('user_id', user.id).limit(1);
      if (provider && provider.length > 0) {
        const { data } = await supabase.from('reviews' as any).select('*').eq('provider_id', provider[0].id).order('created_at', { ascending: false });
        if (data) setReviews(data as any);
      }
      setLoading(false);
    })();
  }, [user]);

  // Fallback reviews
  const displayReviews: Review[] = reviews.length > 0 ? reviews : [
    { id: '1', customer_name: 'Rahul Sharma', rating: 5, comment: 'Absolutely fantastic work! The photos were breathtaking. Captured every emotion perfectly. Highly recommended for weddings!', date: '2026-08-05', event_type: 'Wedding' },
    { id: '2', customer_name: 'Priya Reddy', rating: 4, comment: 'Great professionalism and punctuality. Delivered all photos within a week. Would have loved a few more candid shots.', date: '2026-07-28', event_type: 'Birthday' },
    { id: '3', customer_name: 'Ankit Gupta', rating: 5, comment: 'Outstanding corporate event coverage. The team was invisible yet captured everything important. Will definitely book again.', date: '2026-07-20', event_type: 'Corporate', reply: 'Thank you Ankit! It was a pleasure working with your team.' },
    { id: '4', customer_name: 'Meera Joshi', rating: 5, comment: 'The pre-wedding shoot was magical. They found the most beautiful locations and made us feel so comfortable. Pure artists!', date: '2026-07-15', event_type: 'Pre-Wedding' },
    { id: '5', customer_name: 'Vikram Patel', rating: 3, comment: 'Decent work but delivery took longer than expected. Communication could have been better during the editing process.', date: '2026-07-10', event_type: 'Engagement' },
  ];

  const avgRating = displayReviews.length > 0
    ? (displayReviews.reduce((acc, r) => acc + r.rating, 0) / displayReviews.length).toFixed(1)
    : '0.0';

  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: displayReviews.filter(r => r.rating === stars).length,
    percent: displayReviews.length > 0 ? (displayReviews.filter(r => r.rating === stars).length / displayReviews.length) * 100 : 0,
  }));

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reviews</h1>
        <p className="text-sm text-muted-foreground">{displayReviews.length} reviews from customers</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
        {/* Rating card */}
        <div className="bg-white rounded-2xl border border-border/60 p-6 text-center">
          <p className="text-5xl font-bold text-foreground mb-2">{avgRating}</p>
          <div className="flex items-center justify-center gap-0.5 mb-2">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={cn('w-5 h-5', i <= Math.round(Number(avgRating)) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200')} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{displayReviews.length} total reviews</p>
        </div>

        {/* Breakdown */}
        <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-3">
          {ratingBreakdown.map(({ stars, count, percent }) => (
            <div key={stars} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground w-4">{stars}</span>
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review list */}
      <div className="space-y-4">
        {displayReviews.map(review => (
          <div key={review.id} className="bg-white rounded-2xl border border-border/60 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B1538] to-[#D4AF37] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {review.customer_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{review.customer_name}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={cn('w-3 h-3', i <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200')} />
                      ))}
                    </div>
                    {review.event_type && <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{review.event_type}</span>}
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground">{new Date(review.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-3">{review.comment}</p>
            {review.reply && (
              <div className="bg-[#FAFAFA] rounded-xl p-3 border-l-3 border-[#8B1538] ml-4">
                <p className="text-[11px] font-semibold text-[#8B1538] mb-1">Your Reply</p>
                <p className="text-xs text-foreground">{review.reply}</p>
              </div>
            )}
            {!review.reply && (
              <div className="flex gap-2 pt-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors">
                  <MessageSquare className="w-3 h-3" /> Reply
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors text-muted-foreground">
                  <Flag className="w-3 h-3" /> Report
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
