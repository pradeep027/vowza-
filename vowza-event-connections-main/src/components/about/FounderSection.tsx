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
      <section className="w-full py-12 md:py-16">
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#8B1538] animate-spin" />
              <p className="text-sm text-muted-foreground">Loading founder...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!founder) {
    return (
      <section className="w-full py-12 md:py-16">
        <div className="max-w-2xl mx-auto px-4 md:px-6 text-center">
          <p className="text-muted-foreground">No founder information available yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-12 md:py-16 bg-gradient-to-b from-[#8B1538]/5 via-transparent to-transparent">
      <div className="max-w-2xl mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-10 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            Meet the Founder
          </h2>
        </motion.div>

        {/* Centered Founder Card */}
        <div className="max-w-md mx-auto">
          <FounderCard
            name={founder.name}
            role={founder.role}
            bio={founder.bio}
            photoUrl={founder.photo_url}
            email={founder.email}
            linkedinUrl={founder.linkedin_url}
          />
        </div>
      </div>
    </section>
  );
}
