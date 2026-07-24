import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '../ImageUpload';
import { X, MapPin } from 'lucide-react';
import { languageOptions } from '@/data/artistCategories';

interface BasicInfoStepProps {
  data: {
    fullName: string;
    stageName: string;
    phone: string;
    city: string;
    state: string;
    area: string;
    experienceYears: string;
    languages: string[];
    bio: string;
    avatarUrl: string;
    coverImageUrl: string;
  };
  onChange: (data: Partial<BasicInfoStepProps['data']>) => void;
  onAvatarFile: (file: File) => void;
  onCoverFile: (file: File) => void;
  isUploadingAvatar?: boolean;
  isUploadingCover?: boolean;
}

export const BasicInfoStep = ({
  data,
  onChange,
  onAvatarFile,
  onCoverFile,
  isUploadingAvatar,
  isUploadingCover,
}: BasicInfoStepProps) => {
  const toggleLanguage = (lang: string) => {
    if (data.languages.includes(lang)) {
      onChange({ languages: data.languages.filter((l) => l !== lang) });
    } else {
      onChange({ languages: [...data.languages, lang] });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Cover Image */}
      <div>
        <Label className="mb-3 block">Cover Image</Label>
        <ImageUpload
          variant="cover"
          value={data.coverImageUrl}
          onChange={(url) => onChange({ coverImageUrl: url })}
          onFileSelect={onCoverFile}
          isUploading={isUploadingCover}
        />
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center -mt-20 relative z-10">
        <ImageUpload
          variant="avatar"
          value={data.avatarUrl}
          onChange={(url) => onChange({ avatarUrl: url })}
          onFileSelect={onAvatarFile}
          isUploading={isUploadingAvatar}
        />
        <p className="text-sm text-muted-foreground mt-2">Profile Photo</p>
      </div>

      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            placeholder="Your legal name"
            value={data.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="border-border focus:border-primary"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stageName">Stage Name / Artist Name</Label>
          <Input
            id="stageName"
            placeholder="How should we call you?"
            value={data.stageName}
            onChange={(e) => onChange({ stageName: e.target.value })}
            className="border-border focus:border-primary"
          />
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number *</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+91 9876543210"
          value={data.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          className="border-border focus:border-primary"
        />
      </div>

      {/* Location */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <Label className="text-base font-semibold">Location</Label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              placeholder="Mumbai"
              value={data.city}
              onChange={(e) => onChange({ city: e.target.value })}
              className="border-border focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Input
              id="state"
              placeholder="Maharashtra"
              value={data.state}
              onChange={(e) => onChange({ state: e.target.value })}
              className="border-border focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area">Area / Locality</Label>
            <Input
              id="area"
              placeholder="Andheri West"
              value={data.area}
              onChange={(e) => onChange({ area: e.target.value })}
              className="border-border focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Experience */}
      <div className="space-y-2">
        <Label htmlFor="experience">Years of Experience</Label>
        <Select
          value={data.experienceYears}
          onValueChange={(value) => onChange({ experienceYears: value })}
        >
          <SelectTrigger className="border-border focus:border-primary">
            <SelectValue placeholder="Select experience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Fresher (Less than 1 year)</SelectItem>
            <SelectItem value="1">1-2 years</SelectItem>
            <SelectItem value="3">3-5 years</SelectItem>
            <SelectItem value="5">5-10 years</SelectItem>
            <SelectItem value="10">10+ years</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Languages */}
      <div className="space-y-3">
        <Label>Languages Known</Label>
        <div className="flex flex-wrap gap-2">
          {languageOptions.map((lang) => {
            const isSelected = data.languages.includes(lang.value);
            return (
              <Badge
                key={lang.value}
                variant={isSelected ? 'default' : 'outline'}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary'
                }`}
                onClick={() => toggleLanguage(lang.value)}
              >
                {lang.label}
                {isSelected && <X className="w-3 h-3 ml-1" />}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">About You</Label>
        <Textarea
          id="bio"
          placeholder="Tell customers about your experience, style, achievements, and what makes you unique..."
          value={data.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          className="border-border focus:border-primary resize-none min-h-[120px]"
          rows={5}
        />
        <p className="text-xs text-muted-foreground">
          {data.bio.length}/500 characters
        </p>
      </div>
    </div>
  );
};
