import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, User, Sparkles, ShoppingBag, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { useDashboardLink } from "@/hooks/useDashboardLink";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { dashboardLink } = useDashboardLink();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Shrink navbar on scroll
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
    setBrowseOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) =>
    location.pathname === path
      ? "text-gold font-semibold"
      : "text-muted-foreground hover:text-foreground";

  const browseCategories = [
    { label: "All Artists", href: "/artists" },
    { label: "Photographers", href: "/artists?category=photographers" },
    { label: "DJs", href: "/artists?category=dj" },
    { label: "Live Bands", href: "/artists?category=bands" },
    { label: "Decorators", href: "/artists?category=decorators" },
    { label: "Dancers", href: "/artists?category=dancers" },
    { label: "Makeup Artists", href: "/artists?category=makeup" },
    { label: "Mehendi Artists", href: "/artists?category=mehendi" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-md shadow-md border-b border-border"
          : "bg-background/80 backdrop-blur-md border-b border-border"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? "h-14" : "h-16 md:h-20"}`}>

          {/* ── Logo ──────────────────────────────────────────────── */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-foreground" />
            </div>
            <span className="text-xl md:text-2xl font-display font-bold text-foreground">
              Vowza
            </span>
          </Link>

          {/* ── Desktop nav ───────────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-6">
            {/* Browse dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setBrowseOpen(true)}
              onMouseLeave={() => setBrowseOpen(false)}
            >
              <button
                className={`flex items-center gap-1 text-sm font-medium transition-colors ${isActive("/artists")}`}
              >
                Browse Artists
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${browseOpen ? "rotate-180" : ""}`} />
              </button>

              {browseOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-card rounded-xl shadow-elevated border border-border overflow-hidden z-50 animate-fade-in">
                  {browseCategories.map((cat) => (
                    <Link
                      key={cat.href}
                      to={cat.href}
                      className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link to="/#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>

            <Link
              to="/ai-planner"
              className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                location.pathname === '/ai-planner'
                  ? 'text-gold'
                  : 'text-muted-foreground hover:text-gold'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Vowza Planner
            </Link>

            <Link to="/artists?collection=luxury" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Collections
            </Link>

            {user && (
              <Link to="/my-bookings" className={`text-sm font-medium transition-colors ${isActive("/my-bookings")}`}>
                My Bookings
              </Link>
            )}
          </div>

          {/* ── Desktop actions ───────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search shortcut */}
            <button
              onClick={() => navigate("/artists")}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Search artists"
            >
              <Search className="w-4 h-4" />
            </button>

            {user ? (
              <>
                {/* Cart */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/cart")}
                  className="relative"
                  aria-label="Cart"
                >
                  <ShoppingBag className="w-5 h-5" />
                  {cart.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-gold text-foreground text-[10px] border-0">
                      {cart.length}
                    </Badge>
                  )}
                </Button>

                {/* Notifications */}
                <NotificationBell />

                {/* Dashboard */}
<Link to={dashboardLink}>
  <Button variant="ghost" size="sm" className="text-sm">
    Dashboard
  </Button>
</Link>
                {/* Sign out */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-muted-foreground text-sm">
                    <User className="w-4 h-4 mr-1.5" />
                    Login
                  </Button>
                </Link>

                <Link to="/provider/register">
                  <Button
                    size="sm"
                    className="bg-gradient-gold text-foreground font-semibold hover:opacity-90 transition-opacity shadow-gold text-sm"
                  >
                    Join as Artist
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile toggle ─────────────────────────────────────── */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* ── Mobile menu ───────────────────────────────────────────── */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-1">
              <Link
                to="/ai-planner"
                className="px-3 py-2.5 rounded-lg text-sm font-semibold text-gold hover:bg-gold/10 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                ✨ Vowza Planner
              </Link>
              <Link
                to="/artists"
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Browse Artists
              </Link>
              <Link
                to="/artists?category=photographers"
                className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors pl-6"
              >
                → Photographers
              </Link>
              <Link
                to="/artists?category=dj"
                className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors pl-6"
              >
                → DJs
              </Link>
              <Link
                to="/artists?category=bands"
                className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors pl-6"
              >
                → Live Bands
              </Link>
              <Link
                to="/artists?category=decorators"
                className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors pl-6"
              >
                → Decorators
              </Link>

              <div className="h-px bg-border my-2" />

              {user ? (
                <>
                  <Link
                    to="/my-bookings"
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    My Bookings
                  </Link>
                  <Link
                    to="/cart"
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    Cart {cart.length > 0 && `(${cart.length})`}
                  </Link>
                  <Link
                    to={dashboardLink}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm">
                      <User className="w-4 h-4 mr-2" />
                      Login / Sign Up
                    </Button>
                  </Link>
                  <Link to="/provider/register">
                    <Button
                      size="sm"
                      className="bg-gradient-gold text-foreground font-semibold w-full mt-1"
                    >
                      Join as Artist
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
