import { Music, Camera, Users, Palette, Mic2, Disc3, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { serviceCategories } from "@/data/services";
import { useNavigate } from "react-router-dom";

const iconMap: Record<string, React.ReactNode> = {
  Music: <Music className="w-8 h-8" />,
  Mic2: <Mic2 className="w-8 h-8" />,
  Disc3: <Disc3 className="w-8 h-8" />,
  Camera: <Camera className="w-8 h-8" />,
  Users: <Users className="w-8 h-8" />,
  Palette: <Palette className="w-8 h-8" />,
};

const ServiceCategories = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/artists?category=${categoryId}`);
  };

  return (
    <section id="services" className="py-20 md:py-28 bg-secondary">
      <div className="container px-4">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-gold/10 text-gold-dark text-sm font-medium mb-4">
            Our Services
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            Find the Perfect Artist for Your Event
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From live bands to photographers, discover verified professionals who will make your celebration unforgettable.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceCategories.map((category, index) => (
            <Card
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className="group cursor-pointer bg-card hover:shadow-elevated transition-all duration-300 border-border/50 overflow-hidden animate-fade-in hover:scale-105"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center text-foreground shadow-gold">
                    {iconMap[category.icon]}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {category.professionalCount} Artists
                  </span>
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2 group-hover:text-maroon transition-colors">
                  {category.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {category.description}
                </p>
                <div className="flex items-center text-maroon font-medium text-sm group-hover:gap-3 gap-2 transition-all">
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceCategories;
