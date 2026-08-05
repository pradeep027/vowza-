// ─── Footer — Corporate Premium Edition ──────────────────────────────────────
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Instagram, Facebook, Twitter, Youtube, Mail, Phone, MapPin, Shield, BadgeCheck, ArrowRight, Smartphone } from "lucide-react";
import { toast } from "sonner";
import AppLogo from "@/components/AppLogo";

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
    <footer className="relative bg-[#09090f] text-white overflow-hidden">
      {/* Ambient glow — ties footer visually to the Hero's premium dark theme */}
      <div aria-hidden className="glow-orb pointer-events-none" style={{ top: "-10%", left: "50%", transform: "translateX(-50%)", width: 700, height: 400, background: "radial-gradient(ellipse at center, hsl(345 72% 30% / 0.18) 0%, transparent 70%)" }} />

      {/* ── Newsletter ────────────────────────────────────────────────── */}
      <div className="relative border-b border-white/8">
        <div className="container px-4 py-12 md:py-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 p-6 md:p-8 rounded-3xl glass-premium"
          >
            <div className="max-w-md">
              <h3 className="text-xl md:text-2xl font-display font-bold text-white mb-2">
                Get exclusive deals & artist picks
              </h3>
              <p className="text-white/45 text-sm">Get weekly inspiration, planning tips, and exclusive offers.</p>
            </div>
            <form onSubmit={handleNewsletter} className="flex w-full md:w-auto gap-2 min-w-0 md:min-w-[360px]">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/8 border border-white/12 text-white placeholder:text-white/35 text-sm focus:outline-none focus:border-gold/40 transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                type="submit"
                className="px-5 py-3 rounded-xl bg-gradient-gold text-gray-900 font-semibold text-sm shadow-gold hover:opacity-90 transition-all flex-shrink-0 flex items-center gap-1.5"
              >
                Subscribe <ArrowRight className="w-3.5 h-3.5" />
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="relative container px-4 py-12 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 md:gap-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <AppLogo theme="dark" size="lg" className="mb-5" />
            <p className="text-white/45 text-sm leading-relaxed max-w-xs mb-6">
              India's premium AI-powered event marketplace. Connecting clients with verified artists for unforgettable celebrations.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2 mb-7">
              {[
                { Icon: Shield,     label: "Secure Payments" },
                { Icon: BadgeCheck, label: "Verified Artists" },
              ].map(({ Icon, label }) => (
                <motion.div
                  key={label}
                  whileHover={{ y: -2 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-premium text-xs font-medium text-white/60 hover:text-white/85 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-gold" />
                  {label}
                </motion.div>
              ))}
            </div>

            {/* Socials */}
            <div className="flex gap-2.5">
              {socials.map(({ Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  aria-label={label}
                  whileHover={{ y: -3, scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-9 h-9 rounded-xl bg-white/8 border border-white/8 flex items-center justify-center hover:bg-gold hover:text-gray-900 hover:border-transparent hover:shadow-gold transition-colors duration-200"
                >
                  <Icon className="w-4 h-4" />
                </motion.a>
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
                    <Link to={l.href} className="group relative text-sm text-white/50 hover:text-white transition-colors inline-block">
                      {l.name}
                      <span className="absolute left-0 right-0 -bottom-0.5 h-px bg-gold origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-250" />
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
