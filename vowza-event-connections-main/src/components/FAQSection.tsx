// ─── FAQSection — Accordion-style FAQ ────────────────────────────────────────
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  { q: "How do I book an artist on Vowza?",          a: "Browse or search for an artist, view their profile and packages, select a date, pay the advance securely — and you're done. You'll get an instant booking confirmation." },
  { q: "Are all artists verified?",                   a: "Yes. Every artist on Vowza goes through ID verification, portfolio review, and background checks before their profile goes live." },
  { q: "What happens if an artist cancels?",          a: "We guarantee a full refund or find you a replacement within 24 hours. Your advance is held in escrow and never released until the event completes." },
  { q: "Can I book multiple artists for one event?",  a: "Absolutely. You can add multiple artists across different categories to your cart and checkout in one go." },
  { q: "How does the Vowza AI Planner work?", a: "Describe your event — type, guest count, city, and budget — and the Vowza AI Planner builds a complete vendor list, timeline, and estimated budget in seconds." },
  { q: "Is there a fee to join as an artist?",        a: "Registering is free. Vowza charges a small platform commission only when you successfully complete a booking." },
  { q: "What cities does Vowza cover?",               a: "We currently cover 50+ cities across India including Hyderabad, Mumbai, Bangalore, Delhi, Chennai, Pune, Kolkata, and more." },
  { q: "Can I communicate with the artist before booking?", a: "Yes. Every profile has a direct chat feature so you can discuss your requirements, ask questions, and get clarity before committing." },
];

const FAQSection = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 md:py-28 bg-surface-2">
      <div className="container px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="section-label bg-royal/10 text-royal mb-5 mx-auto inline-flex">FAQ</div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground">Everything you need to know about booking on Vowza.</p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border transition-all duration-200 overflow-hidden",
                  open === i ? "border-maroon/30 bg-maroon/3 shadow-sm" : "border-border/60 bg-surface-1 hover:border-border"
                )}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4.5 py-[18px] text-left gap-4"
                >
                  <span className={cn("font-medium text-sm", open === i ? "text-maroon" : "text-foreground")}>
                    {faq.q}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 flex-shrink-0 transition-transform duration-200 text-muted-foreground", open === i && "rotate-180 text-maroon")} />
                </button>
                {open === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
