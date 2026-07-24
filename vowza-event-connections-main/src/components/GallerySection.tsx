import { useState } from "react";
import { Heart, MapPin, ExternalLink } from "lucide-react";
import { galleryItems } from "@/data/services";
import { useNavigate } from "react-router-dom";

const categories = [
  { id: "all", label: "All" },
  { id: "photography", label: "Photography" },
  { id: "decoration", label: "Decoration" },
  { id: "performance", label: "Performance" },
  { id: "dance", label: "Dance" },
  { id: "mehendi", label: "Mehendi" },
];

// Map aspect ratio to Tailwind row/col spans for a masonry-like grid
const spanMap: Record<string, string> = {
  portrait:  "row-span-2",
  landscape: "col-span-2",
  square:    "",
};

const GallerySection = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const filtered =
    activeCategory === "all"
      ? galleryItems
      : galleryItems.filter((item) => item.category === activeCategory);

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <section className="py-14 md:py-20 bg-secondary">
      <div className="container px-4">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-maroon/10 text-maroon text-sm font-medium mb-4">
            Inspiration Gallery
          </span>
          <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-3">
            Beautiful Event Moments
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Real events captured by Vowza-verified artists. Every photo is a story.
          </p>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 md:mb-8 scrollbar-none justify-start md:justify-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? "bg-maroon text-primary-foreground shadow-maroon"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-maroon/30"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Gallery grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[200px]">
          {filtered.map((item, index) => (
            <div
              key={item.id}
              className={`group relative rounded-2xl overflow-hidden bg-muted cursor-pointer
                           transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated
                           animate-fade-in ${spanMap[item.aspectRatio] ?? ""}`}
              style={{ animationDelay: `${index * 0.06}s` }}
              onClick={() => navigate("/artists")}
            >
              {/* Image */}
              <img
                src={item.imageUrl}
                alt={`${item.eventType} by ${item.artistName}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Like button — always visible */}
              <button
                onClick={(e) => toggleLike(item.id, e)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110"
                aria-label="Like"
              >
                <Heart
                  className={`w-4 h-4 transition-colors ${
                    liked.has(item.id) ? "fill-maroon text-maroon" : "text-white"
                  }`}
                />
              </button>

              {/* Hover info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <p className="text-white font-semibold text-sm leading-tight">{item.eventType}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-white/70" />
                  <span className="text-white/70 text-xs">{item.location}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-white/70 text-xs">{item.artistName}</span>
                  <div className="flex items-center gap-1 text-white/70">
                    <Heart className="w-3 h-3" />
                    <span className="text-xs">
                      {liked.has(item.id) ? item.likes + 1 : item.likes}
                    </span>
                  </div>
                </div>
              </div>

              {/* External link on hover */}
              <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-7 h-7 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center">
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <button
            onClick={() => navigate("/artists")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-maroon text-primary-foreground font-semibold text-sm shadow-maroon hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-4 h-4" />
            Explore All Artists & Their Work
          </button>
        </div>
      </div>
    </section>
  );
};

export default GallerySection;
