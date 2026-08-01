import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { X, IndianRupee, Tag, Clock, CheckCircle, Zap, MapPin, MessageCircle } from 'lucide-react';
import { pricingTypeOptions } from '@/data/artistCategories';

interface PricingStepProps {
  data: {
    pricingType: string;
    priceMin: string;
    priceMax: string;
    specialties: string[];
    isAvailable: boolean;
    whatsapp: string;
    serviceRadius: number;
    instantBooking: boolean;
  };
  onChange: (data: Partial<PricingStepProps['data']>) => void;
}

const specialtyOptions = [
  'Wedding Events',
  'Corporate Events',
  'Birthday Parties',
  'Religious Functions',
  'College Events',
  'Private Parties',
  'Concert/Stage Shows',
  'House Warming',
  'Engagement Ceremony',
  'Reception',
  'Sangeet',
  'Mehendi',
  'Anniversary',
  'Baby Shower',
];

export const PricingStep = ({ data, onChange }: PricingStepProps) => {
  const toggleSpecialty = (specialty: string) => {
    if (data.specialties.includes(specialty)) {
      onChange({ specialties: data.specialties.filter((s) => s !== specialty) });
    } else {
      onChange({ specialties: [...data.specialties, specialty] });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Pricing Type */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-primary" />
          <Label className="text-base font-semibold">Pricing Structure</Label>
        </div>
        <Select
          value={data.pricingType}
          onValueChange={(value) => onChange({ pricingType: value })}
        >
          <SelectTrigger className="border-border focus:border-primary">
            <SelectValue placeholder="Select pricing type" />
          </SelectTrigger>
          <SelectContent>
            {pricingTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div className="space-y-4">
        <Label className="text-sm text-muted-foreground">
          Set your price range to help customers understand your rates
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priceMin">Minimum Price (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="priceMin"
                type="number"
                min="0"
                placeholder="5,000"
                value={data.priceMin}
                onChange={(e) => onChange({ priceMin: e.target.value })}
                className="pl-9 border-border focus:border-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceMax">Maximum Price (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="priceMax"
                type="number"
                min="0"
                placeholder="50,000"
                value={data.priceMax}
                onChange={(e) => onChange({ priceMax: e.target.value })}
                className="pl-9 border-border focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <Label className="text-base font-semibold">WhatsApp Number</Label>
        </div>
        <Input
          type="tel"
          placeholder="+91 9876543210"
          value={data.whatsapp}
          onChange={(e) => onChange({ whatsapp: e.target.value })}
          className="border-border focus:border-primary"
        />
        <p className="text-xs text-muted-foreground">Customers can contact you directly on WhatsApp for quick queries</p>
      </div>

      {/* Service Radius */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <Label className="text-base font-semibold">Service Radius (km)</Label>
        </div>
        <Input
          type="number"
          min="5"
          max="500"
          placeholder="50"
          value={data.serviceRadius}
          onChange={(e) => onChange({ serviceRadius: parseInt(e.target.value) || 50 })}
          className="border-border focus:border-primary"
        />
        <p className="text-xs text-muted-foreground">Maximum distance you are willing to travel from your city</p>
      </div>

      {/* Specialties / Event Types */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <Label className="text-base font-semibold">Event Specialties</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Select the types of events you specialize in
        </p>
        <div className="flex flex-wrap gap-2">
          {specialtyOptions.map((specialty) => {
            const isSelected = data.specialties.includes(specialty);
            return (
              <Badge
                key={specialty}
                variant={isSelected ? 'default' : 'outline'}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary'
                }`}
                onClick={() => toggleSpecialty(specialty)}
              >
                {specialty}
                {isSelected && <X className="w-3 h-3 ml-1" />}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Instant Booking */}
      <div className="p-6 bg-secondary/30 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${data.instantBooking ? 'bg-emerald-100' : 'bg-secondary'}`}>
              <Zap className={`w-5 h-5 ${data.instantBooking ? 'text-emerald-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <Label className="text-base font-semibold">Instant Booking</Label>
              <p className="text-sm text-muted-foreground">
                {data.instantBooking
                  ? 'Customers can book you without waiting for approval'
                  : 'You manually approve each booking request'}
              </p>
            </div>
          </div>
          <Switch
            checked={data.instantBooking}
            onCheckedChange={(checked) => onChange({ instantBooking: checked })}
          />
        </div>
      </div>

      {/* Availability Toggle */}
      <div className="p-6 bg-secondary/30 rounded-xl border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${data.isAvailable ? 'bg-green-100' : 'bg-secondary'}`}>
              {data.isAvailable ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label className="text-base font-semibold">Available for Bookings</Label>
              <p className="text-sm text-muted-foreground">
                {data.isAvailable
                  ? 'You can receive new booking requests'
                  : 'You will not receive new booking requests'}
              </p>
            </div>
          </div>
          <Switch
            checked={data.isAvailable}
            onCheckedChange={(checked) => onChange({ isAvailable: checked })}
          />
        </div>
      </div>
    </div>
  );
};
