// ─── WhyVowza — Trust indicators section ─────────────────────────────────────
import { BadgeCheck, ShieldCheck, Zap, Headphones, Star, CreditCard } from "lucide-react";

const pillars = [
  {
    icon: BadgeCheck,
    title: "Verified Professionals",
    desc: "Every artist passes ID verification, background checks, and portfolio review before going live.",
    color: "bg-emerald-50 dark:bg-emerald-950/30",
    icon_color: "text-emerald-600",
  },
  {
    icon: ShieldCheck,
    title: "Secure Escrow Payments",
    desc: "Your advance is held safely in escrow and released to the artist only after successful event completion.",
    color: "bg-sky-50 dark:bg-sky-950/30",
    icon_color: "text-sky-600",
  },
  {
    icon: Zap,
    title: "Instant Booking",
    desc: "Select a package, pick a date, pay — done. No endless back-and-forth emails or calls.",
    color: "bg-amber-50 dark:bg-amber-950/30",
    icon_color: "text-amber-600",
  },
  {
    icon: Star,
    title: "AI-Powered Planning",
    desc: "Describe your event and Vowza AI builds a complete vendor list, timeline, and budget breakdown in seconds.",
    color: "bg-violet-50 dark:bg-violet-950/30",
    icon_color: "text-violet-600",
  },
  {
    icon: CreditCard,
    title: "Transparent Pricing",
    desc: "No hidden fees. See exact pricing upfront. Compare packages from multiple artists side by side.",
    color: "bg-rose-50 dark:bg-rose-950/30",
    icon_color: "text-rose-600",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    desc: "Our dedicated support team is available round the clock for any booking issues or urgent assistance.",
    color: "bg-teal-50 dark:bg-teal-950/30",
    icon_color: "text-teal-600",
  },
];

const WhyVowza = () => (
  <section className="py-20 md:py-28 bg-surface-3">
    <div className="container px-4">
      <div className="text-center mb-12 md:mb-16">
        <div className="section-label bg-maroon/8 text-maroon mb-5 mx-auto inline-flex">Why Choose Us</div>
        <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
          The Vowza Difference
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-base">
          We built every feature with one goal — making event planning effortless and completely trustworthy.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {pillars.map((p, i) => (
          <div
            key={p.title}
            className="group flex gap-5 p-6 rounded-2xl bg-surface-1 border border-border/60 hover:border-transparent hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-up"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className={`w-12 h-12 rounded-xl ${p.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
              <p.icon className={`w-6 h-6 ${p.icon_color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2 text-sm">{p.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default WhyVowza;
