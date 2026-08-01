// ─── Footer — Corporate Premium Edition ──────────────────────────────────────
import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Instagram, Facebook, Twitter, Youtube, Mail, Phone, MapPin, Shield, Star, BadgeCheck, ArrowRight, Smartphone } from "lucide-react";
import { toast } from "sonner";

const Footer = () => {
  const [email, setEmail] = useState("");

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { toast.error("Please enter a valid email."); return; }
    toast.success("Subscribed! 🎉 Watch for exclusive deals.");
    setEmail("");
  };

  const cols = [
    {
      heading: "Explore",
      links: [
        { name: "Find Artists",     href: "/artists"          },
        { name: "How It Works",     href: "/#how-it-works"    },
        { name: "Browse by Event",  href: "/artists"          },
        { name: "Vowza AI Planner", href: "/ai-planner"       },
        { name: "Contact Us",       href: "/contact"          },
        { name: "About Us",         href: "/contact"          },
      ],
    },
    {
      heading: "For Artists",
      links: [
        { name: "Join as Artist",     href: "/provider/register"   },
        { name: "Artist Dashboard",   href: "/provider/dashboard"  },
        { name: "Verification Guide", href: "/contact"             },
        { name: "Pricing Guide",      href: "/contact"             },
        { name: "Success Stories",    href: "/artists"             },
        { name: "Resources",          href: "/contact"             },
      ],
    },
    {
      heading: "Support",
      links: [
        { name: "Help Center",         href: "/contact"  },
        { name: "Contact Us",          href: "/contact"  },
        { name: "Terms of Service",    href: "/terms"    },
        { name: "Privacy Policy",      href: "/privacy"  },
        { name: "Cancellation Policy", href: "/terms"    },
        { name: "Refund Policy",       href: "/terms"    },
      ],
    },
  ];

  const socials = [
    { Icon: Instagram, href: "#", label: "Instagram" },
    { Icon: Facebook,  href: "#", label: "Facebook"  },
    { Icon: Twitter,   href: "#", label: "Twitter"   },
    { Icon: Youtube,   href: "#", label: "YouTube"   },
  ];

  return (
    <footer className="bg-[#09090f] text-white">

      {/* ── Newsletter ────────────────────────────────────────────────── */}
      <div className="border-b border-white/8">
        <div className="container px-4 py-12">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="max-w-md">
              <h3 className="text-xl md:text-2xl font-display font-bold text-white mb-2">
                Get exclusive deals & artist picks
              </h3>
              <p className="text-white/45 text-sm">Join 25,000+ planners who get weekly inspiration and offers.</p>
            </div>
            <form onSubmit={handleNewsletter} className="flex w-full md:w-auto gap-2 min-w-0 md:min-w-[360px]">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/8 border border-white/12 text-white placeholder:text-white/35 text-sm focus:outline-none focus:border-gold/40 transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-gradient-gold text-gray-900 font-semibold text-sm shadow-gold hover:opacity-90 transition-all flex-shrink-0 flex items-center gap-1.5"
              >
                Subscribe <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="container px-4 py-14 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-maroon flex items-center justify-center shadow-maroon">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-xl font-display font-bold text-white">Vowza</span>
            </Link>
            <p className="text-white/45 text-sm leading-relaxed max-w-xs mb-6">
              India's premium AI-powered event marketplace. Connecting clients with verified artists for unforgettable celebrations.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 mb-7">
              {[
                { Icon: Shield,     label: "Secure Payments" },
                { Icon: BadgeCheck, label: "Verified Artists" },
                { Icon: Star,       label: "4.9★ Rating" },
              ].map(({ Icon, label }) => (
                <div key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 border border-white/8 text-xs font-medium text-white/60">
                  <Icon className="w-3.5 h-3.5 text-gold" />
                  {label}
                </div>
              ))}
            </div>

            {/* Socials */}
            <div className="flex gap-2.5">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-xl bg-white/8 border border-white/8 flex items-center justify-center hover:bg-gold hover:text-gray-900 hover:border-transparent transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map(col => (
            <div key={col.heading}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-5">{col.heading}</h4>
              <ul className="space-y-3">
                {col.links.map(l => (
                  <li key={l.name}>
                    <Link to={l.href} className="text-sm text-white/50 hover:text-white transition-colors">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact + App row */}
        <div className="mt-14 pt-10 border-t border-white/8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-wrap gap-5">
            <a href="mailto:hello@vowza.com" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
              <Mail className="w-3.5 h-3.5" /> hello@vowza.com
            </a>
            <a href="tel:+919876543210" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
              <Phone className="w-3.5 h-3.5" /> +91 98765 43210
            </a>
            <div className="flex items-center gap-2 text-sm text-white/40">
              <MapPin className="w-3.5 h-3.5" /> Mumbai, India
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-white/25" />
            <span className="text-xs text-white/30">Mobile app coming soon</span>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────── */}
      <div className="border-t border-white/6">
        <div className="container px-4 py-5">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-white/25">
            <p>© {new Date().getFullYear()} Vowza Technologies Pvt. Ltd. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/terms"   className="hover:text-white/60 transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
              <Link to="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
              <Link to="/contact" className="hover:text-white/60 transition-colors">Sitemap</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
