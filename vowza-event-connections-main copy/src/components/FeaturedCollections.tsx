import { useNavigate } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { featuredCollections } from "@/data/services";

// Static gradient map — avoids Tailwind purge issues
const gradientMap: Record<string, string> = {
  luxury:    "from-amber-400   via-yellow-500  to-amber-700",
  budget:    "from-emerald-400 via-teal-500    to-emerald-700",
  celebrity: "from-violet-500  via-purple-600  to-indigo-700",
  trending:  "from-rose-500    via-red-500     to-rose-800",
  new:       "from-blue-500    via-indigo-500  to-blue-800",
};

const FeaturedCollections = () => {
  const navigate = useNavigate();

  return (
    <section className="py-14 md:py-20 bg-secondary">
      <div className="container px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-gold/10 text-gold-dark text-sm font-medium mb-4">
            Curated For You
          </span>
          <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-3">
            Featured Collections
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Hand-curated artist groups for every budget, style, and occasion.
          </p>
        </div>

        {/* 
          Layout: 
          - Mobile:  1 column
          - Tablet:  2 columns
          - Desktop: First card full-width top row, then 4 cards in a 2×2 grid
          We use CSS grid with a featured first item spanning 2 cols on md+
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {featuredCollections.map((col, index) => {
            const gradient = gradientMap[col.id] ?? "from-slate-500 to-slate-800";
            const isFirst = index === 0;

            return (
              <button
                key={col.id}
                onClick={() => navigate(`/artists?collection=${col.id}`)}
                className={`group relative rounded-2xl overflow-hidden text-left transition-all duration-300
                             hover:-translate-y-1.5 hover:shadow-elevated animate-fade-in
                             ${isFirst ? "sm:col-span-2 lg:col-span-1 lg:row-span-2" : ""}`}
                style={{
                  minHeight: isFirst ? 280 : 180,
                  animationDelay: `${index * 0.08}s`,
                }}
              >
                {/* Gradient background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient}
                               transition-transform duration-500 group-hover:scale-105`}
                />

                {/* Dark overlay for readability */}
                <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors" />

                {/* Content */}
                <div className="relative h-full flex flex-col justify-between p-5 md:p-6">
                  <div>
                    {/* Badge */}
                    <Badge
                      className={`${col.badgeColor} border-0 text-xs font-semibold mb-3`}
                    >
                      {col.badge}
                    </Badge>

                    {/* Title */}
                    <h3 className={`font-display font-bold text-white mb-1
                                    ${isFirst ? "text-2xl md:text-3xl" : "text-xl"}`}>
                      {col.title}
                    </h3>

                    {/* Subtitle */}
                    <p className="text-white/80 text-sm font-medium mb-2">
                      {col.subtitle}
                    </p>

                    {/* Description */}
                    <p className="text-white/70 text-xs leading-relaxed hidden sm:block">
                      {col.description}
                    </p>
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-1.5 text-white/80 text-xs">
                      <Users className="w-3.5 h-3.5" />
                      <span>{col.artistCount} artists</span>
                    </div>
                    <div className="flex items-center gap-1 text-white text-xs font-semibold group-hover:gap-2 transition-all">
                      Explore
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCollections;
