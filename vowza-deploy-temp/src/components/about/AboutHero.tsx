// ─── About Hero Section ───────────────────────────────────────────────────────
import { motion } from "framer-motion";

interface AboutHeroProps {
  title?: string;
  subtitle?: string;
}

export function AboutHero({ 
  title = "About Vowza", 
  subtitle = "Where Talent Meets Celebration" 
}: AboutHeroProps) {
  return (
    <section className="relative w-full pt-20 pb-16 md:pt-32 md:pb-24 bg-gradient-to-b from-[#8B1538]/5 via-transparent to-transparent overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 }}
          transition={{ duration: 1.5 }}
          className="absolute top-0 right-0 w-96 h-96 rounded-full bg-gradient-to-br from-[#8B1538] to-[#FFD700] blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          transition={{ duration: 2, delay: 0.3 }}
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-gradient-to-tr from-[#1E3A5F] to-[#8B1538] blur-3xl"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground font-medium">
            {subtitle}
          </p>
        </motion.div>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-8 h-1 w-20 mx-auto bg-gradient-to-r from-[#8B1538] to-[#FFD700] rounded-full"
        />
      </div>
    </section>
  );
}
