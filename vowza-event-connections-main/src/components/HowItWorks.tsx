import { useState } from "react";
import {
  Search, MessageSquare, Calendar, Star,
  UserCheck, Upload, IndianRupee, TrendingUp,
  CheckCircle, CreditCard, Smile,
} from "lucide-react";

const customerSteps = [
  {
    icon: Search,
    title: "Discover Artists",
    description: "Browse verified professionals by category, location, and budget. Use AI Smart Search for instant results.",
    color: "bg-gradient-gold",
    step: 1,
  },
  {
    icon: MessageSquare,
    title: "Compare & Chat",
    description: "View portfolios, read verified reviews, and chat directly with artists to discuss your event needs.",
    color: "bg-gradient-maroon",
    step: 2,
  },
  {
    icon: Calendar,
    title: "Book Securely",
    description: "Confirm your booking in seconds. Secure payment, digital contract, and everything organized in one place.",
    color: "bg-royal",
    step: 3,
  },
  {
    icon: CreditCard,
    title: "Pay Safely",
    description: "Advance payment held in escrow. Your money is only released after the event is completed successfully.",
    color: "bg-gradient-gold",
    step: 4,
  },
  {
    icon: Smile,
    title: "Enjoy & Review",
    description: "Celebrate your event! Leave a verified review to help other customers find great artists.",
    color: "bg-gradient-maroon",
    step: 5,
  },
];

const artistSteps = [
  {
    icon: UserCheck,
    title: "Register & Verify",
    description: "Sign up, complete Aadhaar/PAN verification, and get your profile reviewed by our team.",
    color: "bg-gradient-gold",
    step: 1,
  },
  {
    icon: Upload,
    title: "Build Your Profile",
    description: "Upload portfolio photos, videos, pricing packages, and set your availability calendar.",
    color: "bg-gradient-maroon",
    step: 2,
  },
  {
    icon: Calendar,
    title: "Receive Bookings",
    description: "Customers discover and book you. Accept or decline requests. Chat with clients to confirm details.",
    color: "bg-royal",
    step: 3,
  },
  {
    icon: CheckCircle,
    title: "Complete Events",
    description: "Perform at events, deliver your best work, and build your verified track record on Vowza.",
    color: "bg-gradient-gold",
    step: 4,
  },
  {
    icon: IndianRupee,
    title: "Get Paid & Grow",
    description: "Receive instant bank transfer after event completion. Access analytics to grow your bookings.",
    color: "bg-gradient-maroon",
    step: 5,
  },
];

const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState<"customer" | "artist">("customer");
  const steps = activeTab === "customer" ? customerSteps : artistSteps;

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-blush">
      <div className="container px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-maroon/10 text-maroon text-sm font-medium mb-4">
            Simple Process
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            How Vowza Works
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Whether you're planning an event or performing at one, Vowza makes every step seamless.
          </p>

          {/* Tab toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-card border border-border shadow-sm">
            <button
              onClick={() => setActiveTab("customer")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "customer"
                  ? "bg-gradient-maroon text-primary-foreground shadow-maroon"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              For Customers
            </button>
            <button
              onClick={() => setActiveTab("artist")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "artist"
                  ? "bg-gradient-gold text-foreground shadow-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              For Artists
            </button>
          </div>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 md:gap-6">
          {steps.map((step, index) => (
            <div
              key={`${activeTab}-${step.step}`}
              className="relative animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Connector line (desktop only, not last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-11 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-0.5 bg-gradient-to-r from-gold/60 to-maroon/30 z-0" />
              )}

              <div className="relative z-10 bg-card rounded-2xl p-5 text-center shadow-elevated hover:shadow-gold transition-shadow duration-300 h-full">
                {/* Step number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-maroon text-primary-foreground text-xs font-bold flex items-center justify-center shadow-maroon">
                  {step.step}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mx-auto mb-4 shadow-gold mt-2`}>
                  <step.icon className="w-8 h-8 text-foreground" />
                </div>

                {/* Text */}
                <h3 className="text-base font-display font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          {activeTab === "customer" ? (
            <>
              <a
                href="/artists"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-maroon text-primary-foreground font-semibold text-sm shadow-maroon hover:opacity-90 transition-opacity"
              >
                <Search className="w-4 h-4" />
                Browse Artists Now
              </a>
              <a
                href="/auth"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-maroon text-maroon font-semibold text-sm hover:bg-maroon/5 transition-colors"
              >
                Create Free Account
              </a>
            </>
          ) : (
            <>
              <a
                href="/provider/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-gold text-foreground font-semibold text-sm shadow-gold hover:opacity-90 transition-opacity"
              >
                <TrendingUp className="w-4 h-4" />
                Join as Artist
              </a>
              <a
                href="/auth"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gold text-gold-dark font-semibold text-sm hover:bg-gold/5 transition-colors"
              >
                Learn More
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
