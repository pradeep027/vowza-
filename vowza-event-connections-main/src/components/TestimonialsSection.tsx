// ─── TestimonialsSection — Corporate Premium Edition ─────────────────────────
import { useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { testimonials } from "@/data/services";

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`} />
    ))}
  </div>
);

const TestimonialsSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const featured = testimonials.filter(t => t.featured);
  const rest      = testimonials.filter(t => !t.featured);
  const prev = () => setActiveIndex(i => i === 0 ? featured.length - 1 : i - 1);
  const next = () => setActiveIndex(i => i === featured.length - 1 ? 0 : i + 1);
  const highlighted = featured[activeIndex];

  return (
    <section className="py-20 md:py-28 bg-[#09090f] overflow-hidden">
      <div className="container px-4">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="section-label bg-white/8 text-white/60 mb-5 mx-auto inline-flex">Real Stories</div>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-3">
            Customer Success Stories
          </h2>
          <p className="text-white/45 max-w-xl mx-auto text-sm">
            Thousands of families have celebrated their most special moments with Vowza artists.
          </p>
        </div>

        {/* Featured testimonial */}
        <div className="relative max-w-3xl mx-auto mb-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-7 md:p-10 backdrop-blur-sm">
            <Quote className="w-10 h-10 text-gold/25 mb-5" />
            <p className="text-base md:text-lg text-white/85 leading-relaxed italic mb-6">
              "{highlighted.review}"
            </p>
            <StarRow rating={highlighted.rating} />
            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/10">
              <div className="w-11 h-11 rounded-xl bg-gradient-gold flex items-center justify-center text-gray-900 font-bold text-base flex-shrink-0">
                {highlighted.customerName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{highlighted.customerName}</p>
                <p className="text-xs text-white/45 mt-0.5">{highlighted.customerLocation} · {highlighted.eventDate}</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-gold">{highlighted.artistName}</p>
                <span className="text-[10px] font-semibold text-white/40 mt-0.5 block">{highlighted.eventType}</span>
              </div>
            </div>
          </div>

          {/* Nav arrows */}
          <button onClick={prev} className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={next} className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {featured.map((_, i) => (
              <button key={i} onClick={() => setActiveIndex(i)}
                className={`rounded-full transition-all duration-300 ${i === activeIndex ? "w-6 h-2 bg-gold" : "w-2 h-2 bg-white/20 hover:bg-white/40"}`} />
            ))}
          </div>
        </div>

        {/* Smaller cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          {rest.map((t, i) => (
            <div key={t.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <StarRow rating={t.rating} />
              <p className="text-white/70 text-sm leading-relaxed mt-3 mb-4 italic line-clamp-3">"{t.review}"</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center text-gray-900 font-bold text-xs flex-shrink-0">
                    {t.customerName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{t.customerName}</p>
                    <p className="text-[11px] text-white/40">{t.customerLocation}</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-white/8 text-white/50 border border-white/10 px-2.5 py-1 rounded-full">
                  {t.eventType}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Trust metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-white/8">
          {[
            { value: "10,000+", label: "Happy Customers"  },
            { value: "4.9 / 5", label: "Average Rating"   },
            { value: "98%",     label: "Would Recommend"  },
            { value: "50+",     label: "Cities Served"    },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-white mb-1">{m.value}</p>
              <p className="text-xs text-white/40 font-medium">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
