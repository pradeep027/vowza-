import { Button } from '@/components/ui/button';
import VowzaIcon from '@/components/VowzaIcon';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  User, 
  MapPin, 
  Briefcase, 
  IndianRupee, 
  Bell,
  Camera,
  Edit
} from 'lucide-react';
import { artistCategories } from '@/data/artistCategories';

interface ReviewStepProps {
  data: {
    fullName: string;
    stageName: string;
    avatarUrl: string;
    coverImageUrl: string;
    city: string;
    state: string;
    area: string;
    profession: string;
    experienceYears: string;
    priceMin: string;
    priceMax: string;
    pricingType: string;
    specialties: string[];
    bio: string;
    languages: string[];
    portfolioCount: number;
    enableNotifications: boolean;
  };
  onNotificationChange: (enabled: boolean) => void;
  onEdit: (step: number) => void;
}

export const ReviewStep = ({ data, onNotificationChange, onEdit }: ReviewStepProps) => {
  const category = artistCategories.find((c) => c.value === data.profession);
  const CategoryIcon = category?.icon || Briefcase;

  const formatPrice = (price: string) => {
    if (!price) return 'Not set';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(parseInt(price));
  };

  const Section = ({ 
    title, 
    icon: Icon, 
    step, 
    children 
  }: { 
    title: string; 
    icon: typeof User; 
    step: number; 
    children: React.ReactNode 
  }) => (
    <div className="p-4 bg-secondary/30 rounded-xl border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <h4 className="font-semibold">{title}</h4>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(step)}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <Edit className="w-3 h-3" />
          Edit
        </Button>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Profile Preview */}
      <div className="relative rounded-xl overflow-hidden border border-border">
        {/* Cover */}
        <div className="h-32 bg-gradient-to-r from-primary/20 to-accent/20">
          {data.coverImageUrl && (
            <img
              src={data.coverImageUrl}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        {/* Avatar & Name */}
        <div className="px-4 pb-4">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-full border-4 border-background overflow-hidden bg-secondary">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 pb-2">
              <h3 className="text-lg font-bold">{data.stageName || data.fullName}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CategoryIcon className="w-4 h-4" />
                {category?.label || 'Artist'}
                {data.experienceYears && (
                  <span>• {data.experienceYears}+ years</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Basic Info */}
        <Section title="Basic Information" icon={User} step={0}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Full Name:</span>
              <p className="font-medium">{data.fullName || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Stage Name:</span>
              <p className="font-medium">{data.stageName || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Languages:</span>
              <p className="font-medium">{data.languages.join(', ') || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Experience:</span>
              <p className="font-medium">{data.experienceYears ? `${data.experienceYears}+ years` : '-'}</p>
            </div>
          </div>
          {data.bio && (
            <div className="mt-3 pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground">Bio:</span>
              <p className="text-sm mt-1">{data.bio}</p>
            </div>
          )}
        </Section>

        {/* Location */}
        <Section title="Location" icon={MapPin} step={0}>
          <p className="text-sm">
            {[data.area, data.city, data.state].filter(Boolean).join(', ') || 'Not set'}
          </p>
        </Section>

        {/* Category */}
        <Section title="Category" icon={VowzaIcon} step={1}>
          <div className="flex items-center gap-2">
            {category && (
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${category.color}`}>
                <CategoryIcon className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="font-medium">{category?.label || 'Not selected'}</span>
          </div>
        </Section>

        {/* Pricing */}
        <Section title="Pricing & Specialties" icon={IndianRupee} step={2}>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Price Range:</span>
              <span className="font-medium">
                {formatPrice(data.priceMin)} - {formatPrice(data.priceMax)}
              </span>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Pricing Type:</span>
              <span className="font-medium capitalize">{data.pricingType.replace('_', ' ')}</span>
            </div>
            {data.specialties.length > 0 && (
              <div>
                <span className="text-muted-foreground">Specialties:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.specialties.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-secondary rounded-full text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Portfolio */}
        <Section title="Portfolio" icon={Camera} step={3}>
          <p className="text-sm">
            {data.portfolioCount > 0 
              ? `${data.portfolioCount} items added`
              : 'No items added yet'}
          </p>
        </Section>
      </div>

      {/* Notification Permission */}
      <div className="p-4 bg-accent/10 rounded-xl border border-accent/20">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <Label className="font-semibold">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you receive booking requests
              </p>
            </div>
          </div>
          <Switch
            checked={data.enableNotifications}
            onCheckedChange={onNotificationChange}
          />
        </div>
      </div>

      {/* Confirmation */}
      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-900">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-green-800 dark:text-green-200">
              Ready to go live!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Review your profile above. Once you submit, your profile will be visible to customers looking for artists like you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
