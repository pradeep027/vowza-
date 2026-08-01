// ─── HowItWorks — Mobile-first, 8-pt grid, premium typography ────────────────
import { useState } from "react";
import {
  Search, MessageSquare, Calendar, CreditCard, Smile,
  UserCheck, Upload, CheckCircle, IndianRupee, TrendingUp, ArrowRight,
} from "lucide-react";

const customerSteps = [
  { icon: Search,        step: "01", title: "Discover Artists",   color: "bg-rose-500",    desc: "Browse verified professionals by category, city, and budget." },
  { icon: MessageSquare, step: "02", title: "Compare & Connect",  color: "bg-violet-500",  desc: "View portfolios, read reviews, and chat directly with artists." },
  { icon: Calendar,      step: "03", title: "Book Instantly",     color: "bg-sky-500",     desc: "Confirm in seconds. Get a digital contract and booking confirmation." },
  { icon: CreditCard,    step: "04", title: "Pay Securely",       color: "bg-amber-500",   desc: "Advance held in escrow. Released only after successful completion." },
  { icon: Smile,         step: "05", title: "Celebrate & Review", color: "bg-emerald-500", desc: "Enjoy your event and leave a verified review for the community." },
];

const artistSteps = [
  { icon: UserCheck,   step: "01", title: "Register & Verify",  color: "bg-rose-500",    desc: "Sign up and get your profile reviewed by our team within 24 hours." },
  { icon: Upload,      step: "02", title: "Build Your Profile", color: "bg-violet-500",  desc: "Upload portfolio, pricing packages, and set your availability." },
  { icon: Calendar,    step: "03", title: "Receive Bookings",   color: "bg-sky-500",     desc: "Customers discover and book you. Accept and chat to confirm details." },
  { icon: CheckCircle, step: "04", title: "Perform & Deliver",  color: "bg-amber-500",   desc: "Deliver your best work and build your track record on Vowza." },
  { icon: IndianRupee, step: "05", title: "Get Paid & Grow",    color: "bg-emerald-500", desc: "Instant bank transfer after completion. Grow with analytics." },
];

const HowItWorks = () => {
  const [tab, setTab] = useState<"customer" | "artist">("customer");
  const steps = tab === "customer" ? customerSteps : artistSteps;

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-background">
      <div className="container px-4">

        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="section-label bg-royal/10 text-royal mb-4 mx-auto inline-flex">Simple Process</div>
          <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-3">
            How Vowza Works
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed mb-7">
            Whether you're planning an event or performing at one, every step is seamless.
          </p>

          {/* Tab toggle — full-width on mobile */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary border border-border shadow-xs w-full max-w-xs mx-auto sm:w-auto">
            {(["customer", "artist"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] ${
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

        {/* Steps
            Mobile: vertical list with left icon + text
            Desktop: 5-col horizontal with connector line */}

        {/* Desktop layout */}
        <div className="hidden lg:block relative">
          <div className="absolute top-[34px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="grid grid-cols-5 gap-6">
            {steps.map((s, i) => (
              <div
                key={`${tab}-${s.step}`}
                className="relative flex flex-col items-center text-center animate-fade-up"
                style={{ animationDelay: `${i * 0.09}s` }}
              >
                <div className="relative mb-5">
                  <div className={`w-16 h-16 rounded-2xl ${s.color} flex items-center justify-center shadow-lg relative z-10`}>
                    <s.icon className="w-7 h-7 text-white" />
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

        {/* Mobile layout — vertical timeline */}
        <div className="lg:hidden space-y-0">
          {steps.map((s, i) => (
            <div
              key={`${tab}-mob-${s.step}`}
              className="flex gap-4 animate-fade-up"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              {/* Left: icon + connector */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-11 h-11 rounded-xl ${s.color} flex items-center justify-center shadow-md relative z-10 mt-1`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border/60 my-2" />
                )}
              </div>

              {/* Right: content */}
              <div className={`flex-1 min-w-0 ${i < steps.length - 1 ? "pb-6" : "pb-2"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{s.step}</span>
                  <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA — stacked on mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-10 md:mt-14">
          {tab === "customer" ? (
            <>
              <a href="/artists" className="btn-primary justify-center text-sm py-3">
                <Search className="w-4 h-4" /> Browse Artists Now
              </a>
              <a href="/auth" className="btn-outline justify-center text-sm py-3">
                Create Free Account <ArrowRight className="w-4 h-4" />
              </a>
            </>
          ) : (
            <>
              <a href="/provider/register" className="btn-gold justify-center text-sm py-3">
                <TrendingUp className="w-4 h-4" /> Join as Artist — Free
              </a>
              <a href="/auth" className="btn-outline justify-center text-sm py-3">
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
