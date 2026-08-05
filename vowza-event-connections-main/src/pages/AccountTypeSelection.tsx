// ─── AccountTypeSelection — Corporate Premium Edition ────────────────────────
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { User, Mic2, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import AppLogo from '@/components/AppLogo';

const options = [
  {
    type: 'customer' as const,
    icon: User,
    title: 'Customer',
    subtitle: 'I want to book artists for events',
    gradient: 'bg-gradient-gold',
    shadow: 'shadow-gold',
    ring: 'ring-gold/30',
    perks: [
      'Browse 1,500+ verified artists',
      'Compare prices & packages',
      'Book multiple artists at once',
      'Secure escrow payments',
      'Track bookings in real-time',
    ],
    cta: 'Continue as Customer',
    ctaClass: 'btn-gold',
  },
  {
    type: 'provider' as const,
    icon: Mic2,
    title: 'Artist / Provider',
    subtitle: 'I want to offer my services',
    gradient: 'bg-gradient-maroon',
    shadow: 'shadow-maroon',
    ring: 'ring-maroon/30',
    perks: [
      'Free professional profile',
      'Set your own pricing packages',
      'Manage your availability',
      'Receive instant booking requests',
      'Get paid securely after events',
    ],
    cta: 'Continue as Artist',
    ctaClass: 'btn-primary',
  },
];

const AccountTypeSelection = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [selected, setSelected] = useState<'customer' | 'provider' | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { if (!user) navigate('/auth'); }, [user, navigate]);
  if (!user) return null;

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    if (selected === 'provider') navigate('/provider/register');
    else navigate('/');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col">
      {/* Header */}
      <header className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-b border-border/60 px-6 py-4 flex items-center justify-between">
        <AppLogo size="sm" />
        <p className="text-xs text-muted-foreground hidden sm:block">Signed in as {user.email}</p>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10 max-w-lg">
          <div className="section-label bg-gold/10 text-gold-dark mb-5 mx-auto inline-flex">Welcome to Vowza</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
            How will you use Vowza?
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose your account type to get started. You can always add more roles later.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-5 w-full max-w-3xl mb-8">
          {options.map((opt, i) => (
            <button
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className={cn(
                'text-left p-6 rounded-3xl border-2 transition-all duration-200 bg-surface-1',
                'hover:-translate-y-1 hover:shadow-xl animate-fade-up',
                selected === opt.type
                  ? `border-maroon ring-4 ${opt.ring} shadow-lg`
                  : 'border-border/60 hover:border-border',
              )}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {/* Icon + selected check */}
              <div className="flex items-start justify-between mb-5">
                <div className={`w-14 h-14 rounded-2xl ${opt.gradient} flex items-center justify-center ${opt.shadow}`}>
                  <opt.icon className="w-7 h-7 text-white" />
                </div>
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                  selected === opt.type ? 'border-maroon bg-maroon' : 'border-border',
                )}>
                  {selected === opt.type && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
              </div>

              <h3 className="text-lg font-display font-bold text-foreground mb-1">{opt.title}</h3>
              <p className="text-sm text-muted-foreground mb-5">{opt.subtitle}</p>

              <ul className="space-y-2">
                {opt.perks.map(p => (
                  <li key={p} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          className={cn(
            'flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all',
            selected
              ? 'btn-primary'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          {loading ? 'Loading…' : 'Continue'}
          {!loading && <ArrowRight className="w-4 h-4" />}
        </button>

        <p className="text-xs text-muted-foreground mt-4">
          You can change this later from your account settings.
        </p>
      </div>
    </div>
  );
};

export default AccountTypeSelection;
