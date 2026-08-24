// ─── Founder Section Component ────────────────────────────────────────────────
import { motion } from "framer-motion";
import { FounderCard } from "./FounderCard";
import { Loader2 } from "lucide-react";

interface Founder {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo_url?: string;
  email?: string;
  linkedin_url?: string;
}

interface FounderSectionProps {
  founder?: Founder;
  isLoading?: boolean;
}

export function FounderSection({ founder, isLoading = false }: FounderSectionProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#8B1538] animate-spin" />
          <p className="text-sm text-muted-foreground">Loading founder...</p>
        </div>
      </div>
    );
  }

  if (!founder) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">No founder information available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: "-100px" }}
        className="mb-6"
      >
        <h2 className="text-3xl font-display font-bold text-foreground">
          Meet the Founder
        </h2>
      </motion.div>

      {/* Founder Card - Left Column Style */}
      <FounderCard
        name={founder.name}
        role={founder.role}
        bio={founder.bio}
        photoUrl={founder.photo_url}
        email={founder.email}
        linkedinUrl={founder.linkedin_url}
      />
    </div>
  );
}
