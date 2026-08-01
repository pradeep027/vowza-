// ─── HowItWorks — Corporate Premium Edition ──────────────────────────────────
import { useState } from "react";
import { Search, MessageSquare, Calendar, CreditCard, Smile, UserCheck, Upload, CheckCircle, IndianRupee, TrendingUp, ArrowRight } from "lucide-react";

const customerSteps = [
  { icon: Search,       step: "01", title: "Discover Artists",   color: "bg-rose-500",    desc: "Browse 1,500+ verified professionals by category, city, and budget. Use filters to narrow down instantly." },
  { icon: MessageSquare,step: "02", title: "Compare & Connect",  color: "bg-violet-500",  desc: "View portfolios, read genuine reviews, and chat directly to discuss your event requirements." },
  { icon: Calendar,     step: "03", title: "Book Instantly",     color: "bg-sky-500",     desc: "Confirm your booking in seconds. Get a digital contract, booking confirmation, and everything in one dashboard." },
  { icon: CreditCard,   step: "04", title: "Pay Securely",       color: "bg-amber-500",   desc: "Advance held in escrow. Your money is released only after the event completes successfully." },
  { icon: Smile,        step: "05", title: "Celebrate & Review", color: "bg-emerald-500", desc: "Enjoy your event and leave a verified review to help the community find great artists." },
];

const artistSteps = [
  { icon: UserCheck,    step: "01", title: "Register & Verify",  color: "bg-rose-500",    desc: "Sign up, complete ID verification, and get your profile reviewed by our curation team within 24 hours." },
  { icon: Upload,       step: "02", title: "Build Your Profile", color: "bg-violet-500",  desc: "Upload portfolio photos, videos, pricing packages, and set your availability calendar." },
  { icon: Calendar,     step: "03", title: "Receive Bookings",   color: "bg-sky-500",     desc: "Customers discover and book you. Accept or decline requests and chat with clients to confirm details." },
  { icon: CheckCircle,  step: "04", title: "Perform & Deliver",  color: "bg-amber-500",   desc: "Deliver your best work at the event and build your verified track record on Vowza." },
  { icon: IndianRupee,  step: "05", title: "Get Paid & Grow",    color: "bg-emerald-500", desc: "Instant bank transfer after event completion. Access analytics to grow bookings month-on-month." },
];

const HowItWorks = () => {
  const [tab, setTab] = useState<"customer" | "artist">("customer");
  const steps = tab === "customer" ? customerSteps : artistSteps;

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-background">
      <div className="container px-4">

        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="section-label bg-royal/10 text-royal mb-5 mx-auto inline-flex">Simple Process</div>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            How Vowza Works
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-base">
            Whether you're planning an event or performing at one, every step is seamless.
          </p>

          {/* Tab toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary border border-border shadow-xs">
            {(["customer", "artist"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? t === "customer"
                      ? "bg-gradient-maroon text-white shadow-maroon"
                      : "bg-gradient-gold text-gray-900 shadow-gold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "customer" ? "For Customers" : "For Artists"}
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line — desktop */}
          <div className="hidden lg:block absolute top-[52px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {steps.map((s, i) => (
              <div
                key={`${tab}-${s.step}`}
                className="relative flex flex-col items-center text-center animate-fade-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {/* Step number bubble */}
                <div className="relative mb-5">
                  <div className={`w-[72px] h-[72px] rounded-2xl ${s.color} flex items-center justify-center shadow-lg relative z-10`}>
                    <s.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center z-20 shadow">
                    {s.step}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-14">
          {tab === "customer" ? (
            <>
              <a href="/artists" className="btn-primary">
                <Search className="w-4 h-4" /> Browse Artists Now
              </a>
              <a href="/auth" className="btn-outline">
                Create Free Account <ArrowRight className="w-4 h-4" />
              </a>
            </>
          ) : (
            <>
              <a href="/provider/register" className="btn-gold">
                <TrendingUp className="w-4 h-4" /> Join as Artist — Free
              </a>
              <a href="/auth" className="btn-outline">
                Learn More <ArrowRight className="w-4 h-4" />
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
