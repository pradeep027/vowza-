// MyReviewsPage — reviews written by the customer.
// The reviews table has no updated_at column, so reviews are read-only once
// submitted (editing is intentionally not supported by the schema).
import { motion } from 'framer-motion';
import { useReviews } from '@/hooks/useReviews';
import { Star, MessageSquareText } from 'lucide-react';

export default function MyReviewsPage() {
  const { reviews, isLoading } = useReviews();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">My Reviews</h1>
        <p className="text-muted-foreground text-sm mt-1">Reviews you've shared about artists you've booked.</p>
      </div>

      {reviews.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {reviews.map((review, i) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="rounded-2xl bg-white border border-border p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold text-foreground">{review.provider_name}</h3>
                  {review.provider_profession && (
                    <p className="text-xs text-muted-foreground capitalize">{review.provider_profession.replace(/_/g, ' ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`w-4 h-4 ${idx < review.rating ? 'text-[#D4AF37] fill-current' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                </div>
              </div>
              {review.review_text && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{review.review_text}</p>
              )}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  {review.booking_event_date
                    ? `Event: ${new Date(review.booking_event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Reviewed {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </motion.div>
          ))}
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
        <MessageSquareText className="w-8 h-8 text-[#8B1538]" />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground mb-1">No reviews yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        After a completed booking, you can share feedback on your experience with the artist.
      </p>
    </motion.div>
  );
}
