// ─── Co-Founder Card Component ────────────────────────────────────────────────
import { motion } from "framer-motion";
import { Mail, Linkedin } from "lucide-react";
import { useState } from "react";

interface CoFounderCardProps {
  name?: string;
  role?: string;
  bio?: string;
  photoUrl?: string;
  email?: string;
  linkedinUrl?: string;
  isLoading?: boolean;
  index?: number;
}

export function CoFounderCard({
  name = "Co-Founder Name",
  role = "Co-Founder",
  bio = "Passionate about events...",
  photoUrl,
  email,
  linkedinUrl,
  isLoading = false,
  index = 0,
}: CoFounderCardProps) {
  const [imageError, setImageError] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full animate-pulse">
        <div className="aspect-square rounded-xl bg-surface-2" />
        <div className="mt-3 space-y-2">
          <div className="h-5 bg-surface-2 rounded w-3/4" />
          <div className="h-3 bg-surface-2 rounded w-1/2" />
          <div className="mt-2 h-16 bg-surface-2 rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      viewport={{ once: true, margin: "-50px" }}
      className="space-y-3 group"
    >
      {/* Photo Container — Smaller than Founder */}
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md border border-border/20 hover:shadow-lg transition-shadow">
        {photoUrl && !imageError ? (
          <>
            <img
              src={photoUrl}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#8B1538]/15 to-[#FFD700]/5 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#8B1538]/30">
                {name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-2">
        <div>
          <h4 className="font-semibold text-sm md:text-base text-foreground truncate">
            {name}
          </h4>
          <p className="text-xs md:text-sm text-[#8B1538] font-medium truncate">
            {role}
          </p>
        </div>

        {/* Bio — Optional, truncated for grid */}
        {bio && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {bio}
          </p>
        )}

        {/* Social Links — Compact */}
        <div className="flex gap-2 pt-1">
          {email && (
            <a
              href={`mailto:${email}`}
              aria-label="Email"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-2 hover:bg-[#8B1538]/10 text-muted-foreground hover:text-[#8B1538] transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
            </a>
          )}
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-2 hover:bg-[#0A66C2]/10 text-muted-foreground hover:text-[#0A66C2] transition-colors"
            >
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
