// ─── Co-Founders Grid Component ───────────────────────────────────────────────
import { motion } from "framer-motion";
import { CoFounderCard } from "./CoFounderCard";
import { Loader2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photo_url?: string;
  email?: string;
  linkedin_url?: string;
  display_order: number;
}

interface CoFoundersGridProps {
  coFounders?: TeamMember[];
  isLoading?: boolean;
}

export function CoFoundersGrid({ coFounders = [], isLoading = false }: CoFoundersGridProps) {
  if (isLoading) {
    return (
      <section className="w-full py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#8B1538] animate-spin" />
              <p className="text-sm text-muted-foreground">Loading team...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const sortedCoFounders = [...coFounders].sort(
    (a, b) => (a.display_order || 999) - (b.display_order || 999)
  );

  const activeCoFounders = sortedCoFounders.slice(0, 6);

  if (activeCoFounders.length === 0) {
    return (
      <section className="w-full py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6 text-center">
          <p className="text-muted-foreground">No co-founders to display yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground text-center">
            Our Co-Founders
          </h2>
        </motion.div>

        {/* Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {activeCoFounders.map((member, index) => (
            <CoFounderCard
              key={member.id}
              name={member.name}
              role={member.role}
              bio={member.bio}
              photoUrl={member.photo_url}
              email={member.email}
              linkedinUrl={member.linkedin_url}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
