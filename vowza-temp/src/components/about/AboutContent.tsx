// ─── About Content Component (Story, Mission, Vision) ──────────────────────
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface AboutContentProps {
  story?: string;
  mission?: string;
  vision?: string;
  isLoading?: boolean;
}

export function AboutContent({
  story = "",
  mission = "",
  vision = "",
  isLoading = false,
}: AboutContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#8B1538] animate-spin" />
          <p className="text-sm text-muted-foreground">Loading content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Our Story */}
      {story && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-3"
        >
          <h3 className="text-2xl font-semibold text-foreground">Our Story</h3>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {story}
          </p>
        </motion.div>
      )}

      {/* Divider */}
      {(mission || vision) && story && (
        <div className="h-px bg-border" />
      )}

      {/* Our Mission */}
      {mission && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true, margin: "-100px" }}
          className="rounded-lg border border-[#8B1538]/20 bg-[#8B1538]/5 p-6"
        >
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <span className="text-2xl">🎯</span> Our Mission
            </h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {mission}
            </p>
          </div>
        </motion.div>
      )}

      {/* Our Vision */}
      {vision && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, margin: "-100px" }}
          className="rounded-lg border border-[#8B1538]/20 bg-[#8B1538]/5 p-6"
        >
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <span className="text-2xl">👁</span> Our Vision
            </h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {vision}
            </p>
          </div>
        </motion.div>
      )}

      {/* Empty state if no content */}
      {!story && !mission && !vision && (
        <div className="text-center py-8">
          <p className="text-muted-foreground italic">Content will appear here once added.</p>
        </div>
      )}
    </div>
  );
}
