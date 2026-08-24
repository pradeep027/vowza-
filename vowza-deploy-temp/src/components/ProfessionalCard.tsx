import { Star, MapPin, Clock, BadgeCheck, Heart, Zap, Calendar, TrendingUp, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Professional } from "@/data/services";

interface ProfessionalCardProps {
  professional: Professional;
}

// Badge label + colour map
const badgeMeta: Record<string, { label: string; className: string }> = {
  top_rated: {
    label: "Top Rated",
    className: "bg-gold text-foreground border-0",
  },
  trending: {
    label: "Trending 🔥",
    className: "bg-maroon text-primary-foreground border-0",
  },
  new: {
    label: "New ✨",
    className: "bg-royal text-primary-foreground border-0",
  },
  premium: {
    label: "Premium",
    className: "bg-violet-600 text-white border-0",
  },
};

const ProfessionalCard = ({ professional }: ProfessionalCardProps) => {
  const badge = professional.badge ? badgeMeta[professional.badge] : null;

  return (
    <Card className="group overflow-hidden bg-card hover:shadow-elevated transition-all duration-300 border-border/50 hover:-translate-y-1">
      {/* ── Image ──────────────────────────────────────────────────── */}
      <div className="relative h-52 bg-muted overflow-hidden">
        <img
          src={professional.image}
          alt={professional.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />

        {/* Top-left badges row */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {professional.isVerified && (
            <Badge className="bg-gold text-foreground border-0 shadow-gold text-[10px] px-2 py-0.5">
              <BadgeCheck className="w-3 h-3 mr-0.5" />
              Verified
            </Badge>
          )}
          {professional.hasInstantBook && (
            <Badge className="bg-emerald-500 text-primary-foreground border-0 text-[10px] px-2 py-0.5">
              <Zap className="w-3 h-3 mr-0.5" />
              Instant Book
            </Badge>
          )}
          {!professional.hasInstantBook && professional.isAvailable && (
            <Badge className="bg-sky-500 text-primary-foreground border-0 text-[10px] px-2 py-0.5">
              Available
            </Badge>
          )}
          {!professional.isAvailable && (
            <Badge variant="secondary" className="bg-muted/90 text-muted-foreground text-[10px] px-2 py-0.5">
              Busy
            </Badge>
          )}
        </div>

        {/* Optional badge label (top_rated / trending / etc.) */}
        {badge && (
          <div className="absolute top-3 right-10">
            <Badge className={`${badge.className} text-[10px] px-2 py-0.5`}>
              {badge.label}
            </Badge>
          </div>
        )}

        {/* Wishlist button */}
        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors"
          aria-label="Add to wishlist"
        >
          <Heart className="w-4 h-4 text-muted-foreground hover:text-maroon transition-colors" />
        </button>

        {/* Rating pill */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-lg">
          <Star className="w-3.5 h-3.5 text-gold fill-gold" />
          <span className="text-sm font-semibold text-foreground">{professional.rating}</span>
          <span className="text-xs text-muted-foreground">({professional.reviewCount})</span>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <CardContent className="p-4">
        {/* Name & profession */}
        <div className="mb-2.5">
          <h3 className="text-base font-display font-semibold text-foreground group-hover:text-maroon transition-colors leading-tight">
            {professional.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{professional.profession}</p>
        </div>

        {/* Meta row: location + experience */}
        <div className="flex items-center gap-3 mb-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{professional.location}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>{professional.experience}</span>
          </div>
        </div>

        {/* Completed events + languages */}
        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{professional.completedEvents}+ events</span>
          </div>
          {professional.languages && professional.languages.length > 0 && (
            <div className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              <span>{professional.languages.slice(0, 2).join(", ")}</span>
            </div>
          )}
        </div>

        {/* Specialties */}
        <div className="flex flex-wrap gap-1 mb-3">
          {professional.specialties.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] bg-blush text-maroon border-0 px-2 py-0.5">
              {s}
            </Badge>
          ))}
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground">Starting from</p>
            <p className="text-sm font-bold text-foreground">
              ₹{professional.priceMin.toLocaleString()}
            </p>
          </div>
          <Link to={`/artist/${professional.id}`}>
            <Button
              size="sm"
              className="bg-gradient-maroon text-primary-foreground hover:opacity-90 transition-opacity text-xs h-8 px-3"
            >
              View Profile
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfessionalCard;
