// ─── WhyVowza — Premium glass cards with gradient border on hover ────────────
import { memo } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, ShieldCheck, Zap, Headphones, Star, CreditCard } from "lucide-react";

const pillars = [
  { icon: BadgeCheck, title: "Verified Professionals",  desc: "Every artist passes ID verification, background checks, and portfolio review before going live.",                              color: "bg-emerald-50 dark:bg-emerald-950/30", icon_color: "text-emerald-600", grad: "from-emerald-400 to-teal-500" },
  { icon: ShieldCheck,title: "Secure Escrow Payments",  desc: "Your advance is held safely in escrow and released to the artist only after successful event completion.",                   color: "bg-sky-50 dark:bg-sky-950/30",     icon_color: "text-sky-600",     grad: "from-sky-400 to-blue-500"     },
  { icon: Zap,        title: "Instant Booking",         desc: "Select a package, pick a date, pay — done. No endless back-and-forth emails or calls.",                                     color: "bg-amber-50 dark:bg-amber-950/30", icon_color: "text-amber-600",   grad: "from-amber-400 to-orange-500" },
  { icon: Star,       title: "AI-Powered Planning",     desc: "Describe your event and Vowza AI builds a complete vendor list, timeline, and budget breakdown in seconds.",                color: "bg-violet-50 dark:bg-violet-950/30",icon_color: "text-violet-600", grad: "from-violet-400 to-purple-500" },
  { icon: CreditCard, title: "Transparent Pricing",     desc: "No hidden fees. See exact pricing upfront. Compare packages from multiple artists side by side.",                          color: "bg-rose-50 dark:bg-rose-950/30",   icon_color: "text-rose-600",    grad: "from-rose-400 to-pink-500"    },
  { icon: Headphones, title: "24/7 Support",            desc: "Our dedicated support team is available round the clock for any booking issues or urgent assistance.",                      color: "bg-teal-50 dark:bg-teal-950/30",   icon_color: "text-teal-600",    grad: "from-teal-400 to-cyan-500"    },
];

const PillarCard = memo(({ p, i }: { p: typeof pillars[number]; i: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -6 }}
    className="group relative p-[1.5px] rounded-2xl overflow-hidden"
  >
    {/* Gradient border — appears on hover via opacity, always present but faint */}
    <div className={`absolute inset-0 bg-gradient-to-br ${p.grad} opacity-0 group-hover:opacity-100 transition-opacity duration-400`} />
    <div className="absolute inset-0 bg-border/60 group-hover:opacity-0 transition-opacity duration-400" />

    {/* Inner card */}
    <div className="relative flex gap-4 p-5 md:p-6 rounded-2xl bg-surface-1/95 backdrop-blur-sm h-full
                     group-hover:shadow-2xl transition-shadow duration-400">
      <div className={`w-11 h-11 rounded-xl ${p.color} flex items-center justify-center flex-shrink-0
                      group-hover:scale-110 transition-transform duration-300`}>
        <p.icon className={`w-5 h-5 ${p.icon_color}`} aria-hidden />
      </div>

      <div className="min-w-0">
        <h3 className="font-semibold text-foreground text-sm mb-1.5 leading-snug">{p.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
      </div>
    </div>
  </motion.div>
));
PillarCard.displayName = "PillarCard";

const WhyVowza = () => (
  <section className="py-16 md:py-24 bg-surface-3">
    <div className="container px-4">

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-10 md:mb-14"
      >
        <div className="section-label bg-maroon/8 text-maroon mb-4 mx-auto inline-flex">Why Choose Us</div>
        <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-3">
          The Vowza Difference
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
          Every feature built to make event planning effortless and completely trustworthy.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {pillars.map((p, i) => <PillarCard key={p.title} p={p} i={i} />)}
      </div>
    </div>
  </section>
);

export default WhyVowza;
