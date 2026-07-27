import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Instagram, Facebook, Twitter, Youtube,
  Mail, Phone, MapPin, Shield, Star, BadgeCheck,
  ArrowRight, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Footer = () => {
  const [email, setEmail] = useState("");

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    toast.success("You're subscribed! 🎉 Watch for exclusive deals.");
    setEmail("");
  };

  const quickLinks = [
    { name: "Find Artists",     href: "/artists" },
    { name: "How It Works",     href: "/#how-it-works" },
    { name: "Browse by Event",  href: "/artists?view=events" },
    { name: "Popular Cities",   href: "/artists?view=cities" },
    { name: "Collections",      href: "/artists?view=collections" },
    { name: "About Us",         href: "#" },
  ];

  const artistLinks = [
    { name: "Join as Artist",      href: "/provider/register" },
    { name: "Artist Dashboard",    href: "/provider/dashboard" },
    { name: "Verification Guide",  href: "#" },
    { name: "Pricing & Packages",  href: "#" },
    { name: "Success Stories",     href: "#" },
    { name: "Artist Resources",    href: "#" },
  ];

  const supportLinks = [
    { name: "Help Center",       href: "#" },
    { name: "Contact Us",        href: "#" },
    { name: "Terms of Service",  href: "#" },
    { name: "Privacy Policy",    href: "#" },
    { name: "Cancellation Policy", href: "#" },
    { name: "Refund Policy",     href: "#" },
  ];

  const trustBadges = [
    { icon: Shield,     label: "Secure Payments" },
    { icon: BadgeCheck, label: "Verified Artists" },
    { icon: Star,       label: "4.9★ Rated" },
  ];

  const socials = [
    { Icon: Instagram, href: "#", label: "Instagram" },
    { Icon: Facebook,  href: "#", label: "Facebook" },
    { Icon: Twitter,   href: "#", label: "Twitter / X" },
    { Icon: Youtube,   href: "#", label: "YouTube" },
  ];

  return (
    <footer className="bg-foreground text-primary-foreground">

      {/* ── Newsletter banner ──────────────────────────────────────── */}
      <div className="border-b border-primary-foreground/10">
        <div className="container px-4 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 max-w-5xl mx-auto">
            <div>
              <h3 className="text-xl md:text-2xl font-display font-bold mb-1">
                Get exclusive deals & artist recommendations
              </h3>
              <p className="text-primary-foreground/60 text-sm">
                Join 25,000+ event planners who get weekly inspiration and offers.
              </p>
            </div>
            <form
              onSubmit={handleNewsletter}
              className="flex w-full md:w-auto gap-2 min-w-0 md:min-w-[360px]"
            >
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-gold"
              />
              <Button
                type="submit"
                className="bg-gradient-gold text-foreground font-semibold hover:opacity-90 flex-shrink-0"
              >
                Subscribe
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Main footer ────────────────────────────────────────────── */}
      <div className="container px-4 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 md:gap-10">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-foreground" />
              </div>
              <span className="text-2xl font-display font-bold">Vowza</span>
            </Link>

            <p className="text-primary-foreground/65 mb-5 max-w-xs text-sm leading-relaxed">
              India's premium AI-powered event marketplace. Connecting customers with verified artists for unforgettable celebrations.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3 mb-6">
              {trustBadges.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-foreground/10 text-xs font-medium text-primary-foreground/80"
                >
                  <Icon className="w-3.5 h-3.5 text-gold" />
                  {label}
                </div>
              ))}
            </div>

            {/* Socials */}
            <div className="flex gap-3">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-gold hover:text-foreground transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wide text-primary-foreground/50">
              Explore
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/65 hover:text-gold transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Artist links */}
          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wide text-primary-foreground/50">
              For Artists
            </h4>
            <ul className="space-y-2.5">
              {artistLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/65 hover:text-gold transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support + Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wide text-primary-foreground/50">
              Support
            </h4>
            <ul className="space-y-2.5 mb-6">
              {supportLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/65 hover:text-gold transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Contact */}
            <div className="space-y-2">
              <a href="mailto:hello@vowza.com" className="flex items-center gap-2 text-sm text-primary-foreground/65 hover:text-gold transition-colors">
                <Mail className="w-4 h-4 flex-shrink-0" />
                hello@vowza.com
              </a>
              <a href="tel:+919876543210" className="flex items-center gap-2 text-sm text-primary-foreground/65 hover:text-gold transition-colors">
                <Phone className="w-4 h-4 flex-shrink-0" />
                +91 98765 43210
              </a>
              <div className="flex items-start gap-2 text-sm text-primary-foreground/65">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Mumbai, Maharashtra, India
              </div>
            </div>
          </div>
        </div>

        {/* App download row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 pt-8 border-t border-primary-foreground/10">
          <div className="flex items-center gap-2 text-sm text-primary-foreground/60">
            <Smartphone className="w-4 h-4" />
            <span>Mobile app coming soon for iOS & Android</span>
          </div>
          <div className="flex gap-3">
            <div className="px-4 py-2 rounded-lg border border-primary-foreground/20 text-xs text-primary-foreground/50 cursor-not-allowed">
              📱 App Store — Coming Soon
            </div>
            <div className="px-4 py-2 rounded-lg border border-primary-foreground/20 text-xs text-primary-foreground/50 cursor-not-allowed">
              📱 Play Store — Coming Soon
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────── */}
      <div className="border-t border-primary-foreground/10">
        <div className="container px-4 py-5">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-primary-foreground/40">
            <p>© {new Date().getFullYear()} Vowza Technologies Pvt. Ltd. All rights reserved.</p>
            <div className="flex gap-5">
              <Link to="#" className="hover:text-gold transition-colors">Terms</Link>
              <Link to="#" className="hover:text-gold transition-colors">Privacy</Link>
              <Link to="#" className="hover:text-gold transition-colors">Cookies</Link>
              <Link to="#" className="hover:text-gold transition-colors">Sitemap</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
