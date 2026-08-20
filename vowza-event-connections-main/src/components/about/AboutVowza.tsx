// ─── About Vowza Content Section ──────────────────────────────────────────────
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface AboutVowzaProps {
  title?: string;
  description?: string;
  isLoading?: boolean;
}

export function AboutVowza({ 
  title = "About Vowza",
  description,
  isLoading = false 
}: AboutVowzaProps) {
  if (isLoading) {
    return (
      <section className="w-full py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-center min-h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#8B1538] animate-spin" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-12 md:py-16">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-6"
        >
          {/* Title */}
          {title && (
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              {title}
            </h2>
          )}

          {/* Description */}
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
            {description ? (
              <div className="bg-surface-2 rounded-2xl p-6 md:p-8 border border-border/40 backdrop-blur-sm">
                <p className="text-base md:text-lg text-foreground leading-relaxed whitespace-pre-wrap">
                  {description}
                </p>
              </div>
            ) : (
              <div className="bg-surface-2 rounded-2xl p-6 md:p-8 border border-border/40 text-muted-foreground italic">
                No content available yet.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
