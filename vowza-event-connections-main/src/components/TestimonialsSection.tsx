import { useState } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { testimonials } from "@/data/services";

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${i < rating ? "fill-gold text-gold" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

const TestimonialsSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const featured = testimonials.filter((t) => t.featured);
  const rest = testimonials.filter((t) => !t.featured);

  const prev = () => setActiveIndex((i) => (i === 0 ? featured.length - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i === featured.length - 1 ? 0 : i + 1));

  const highlighted = featured[activeIndex];

  return (
    <section className="py-14 md:py-20 bg-foreground overflow-hidden">
      <div className="container px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-gold/20 text-gold-light text-sm font-medium mb-4">
            Real Stories
          </span>
          <h2 className="text-2xl md:text-4xl font-display font-bold text-primary-foreground mb-3">
            Customer Success Stories
          </h2>
          <p className="text-primary-foreground/60 max-w-xl mx-auto text-sm md:text-base">
            Thousands of families have celebrated their most special moments with Vowza artists.
          </p>
        </div>

        {/* Featured testimonial — large card with nav arrows */}
        <div className="relative max-w-3xl mx-auto mb-10">
          <Card className="bg-card/10 border-white/10 text-primary-foreground overflow-hidden">
            <CardContent className="p-6 md:p-10">
              {/* Decorative quote icon */}
              <Quote className="w-10 h-10 text-gold/30 mb-4" />

              <p className="text-base md:text-lg text-primary-foreground/90 leading-relaxed mb-6 italic">
                "{highlighted.review}"
              </p>

              {/* Rating */}
              <StarRow rating={highlighted.rating} />

              {/* Customer info */}
              <div className="flex items-center gap-4 mt-5 pt-5 border-t border-white/10">
                <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center text-foreground font-bold text-lg flex-shrink-0">
                  {highlighted.customerName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary-foreground">{highlighted.customerName}</p>
                  <p className="text-sm text-primary-foreground/60">{highlighted.customerLocation} · {highlighted.eventDate}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gold">{highlighted.artistName}</p>
                  <Badge className="bg-gold/20 text-gold-light border-0 text-[10px] mt-1">
                    {highlighted.eventType}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 hover:bg-card/40 flex items-center justify-center text-primary-foreground transition-colors"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/20 hover:bg-card/40 flex items-center justify-center text-primary-foreground transition-colors"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-2 mt-5">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`rounded-full transition-all ${
                  i === activeIndex ? "w-6 h-2 bg-gold" : "w-2 h-2 bg-white/30"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Smaller cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rest.map((t, index) => (
            <Card
              key={t.id}
              className="bg-card/10 border-white/10 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-5">
                <StarRow rating={t.rating} />
                <p className="text-primary-foreground/80 text-sm leading-relaxed mt-3 mb-4 italic line-clamp-3">
                  "{t.review}"
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center text-foreground font-bold text-sm flex-shrink-0">
                      {t.customerName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-foreground">{t.customerName}</p>
                      <p className="text-xs text-primary-foreground/50">{t.customerLocation}</p>
                    </div>
                  </div>
                  <Badge className="bg-gold/20 text-gold-light border-0 text-[10px]">
                    {t.eventType}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust metrics bar */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-12 pt-10 border-t border-white/10">
          {[
            { value: "10,000+", label: "Happy Customers" },
            { value: "4.9 / 5", label: "Average Rating" },
            { value: "98%", label: "Would Recommend" },
            { value: "50+", label: "Cities Served" },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-gold">{m.value}</p>
              <p className="text-sm text-primary-foreground/60 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
