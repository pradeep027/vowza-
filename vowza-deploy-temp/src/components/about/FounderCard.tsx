// ─── Founder Card Component ───────────────────────────────────────────────────
import { motion } from "framer-motion";
import { Mail, Linkedin } from "lucide-react";
import { useState } from "react";

interface FounderCardProps {
  name?: string;
  role?: string;
  bio?: string;
  photoUrl?: string;
  email?: string;
  linkedinUrl?: string;
  isLoading?: boolean;
}

export function FounderCard({
  name = "Founder Name",
  role = "Founder & CEO",
  bio = "Dedicated to revolutionizing event planning...",
  photoUrl,
  email,
  linkedinUrl,
  isLoading = false,
}: FounderCardProps) {
  const [imageError, setImageError] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full animate-pulse">
        <div className="aspect-square rounded-2xl bg-surface-2" />
        <div className="mt-4 space-y-2">
          <div className="h-6 bg-surface-2 rounded w-3/4" />
          <div className="h-4 bg-surface-2 rounded w-1/2" />
          <div className="mt-3 h-20 bg-surface-2 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: "-50px" }}
        className="space-y-6"
      >
        {/* Photo Container — Large and Prominent */}
        <div className="relative aspect-square rounded-2xl overflow-hidden shadow-xl border border-border/20 group">
          {photoUrl && !imageError ? (
            <>
              <img
                src={photoUrl}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#8B1538]/20 to-[#FFD700]/10 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#8B1538]/40">
                  {name.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs text-muted-foreground mt-2">No photo</p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-3">
          <div>
            <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              {name}
            </h3>
            <p className="text-base md:text-lg text-[#8B1538] font-semibold mt-1">
              {role}
            </p>
          </div>

          {/* Bio */}
          {bio && (
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              {bio}
            </p>
          )}

          {/* Social Links */}
          <div className="flex gap-3 pt-2">
            {email && (
              <a
                href={`mailto:${email}`}
                aria-label="Email"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface-2 hover:bg-[#8B1538]/10 text-muted-foreground hover:text-[#8B1538] transition-colors"
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface-2 hover:bg-[#0A66C2]/10 text-muted-foreground hover:text-[#0A66C2] transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
