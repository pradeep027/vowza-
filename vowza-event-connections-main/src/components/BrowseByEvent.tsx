import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { eventTypes } from "@/data/services";

const BrowseByEvent = () => {
  const navigate = useNavigate();

  const handleClick = (eventId: string) => {
    navigate(`/artists?event=${eventId}`);
  };

  return (
    <section className="py-14 md:py-20 bg-secondary">
      <div className="container px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-maroon/10 text-maroon text-sm font-medium mb-4">
            Find by Occasion
          </span>
          <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground mb-3">
            Browse by Event Type
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Whatever the occasion, we have verified professionals ready to make it unforgettable.
          </p>
        </div>

        {/* Event grid — 4 cols desktop, 3 tablet, 2 mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {eventTypes.map((event, index) => (
            <button
              key={event.id}
              onClick={() => handleClick(event.id)}
              className="group relative overflow-hidden rounded-2xl bg-card border border-border/60
                         hover:border-gold/30 hover:shadow-elevated transition-all duration-300
                         hover:-translate-y-1 text-left animate-fade-in p-4 md:p-5"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Subtle gradient accent top-right */}
              <div
                className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full bg-gradient-to-bl ${event.gradient} opacity-10
                             group-hover:opacity-20 transition-opacity`}
              />

              {/* Emoji */}
              <div className="text-3xl md:text-4xl mb-3 group-hover:scale-110 transition-transform duration-300 inline-block">
                {event.icon}
              </div>

              {/* Name */}
              <h3 className="text-sm md:text-base font-display font-semibold text-foreground group-hover:text-maroon transition-colors mb-1">
                {event.name}
              </h3>

              {/* Description */}
              <p className="text-xs text-muted-foreground mb-2 leading-snug hidden sm:block">
                {event.description}
              </p>

              {/* Artist count */}
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-muted-foreground">
                  {event.artistCount.toLocaleString()}+ artists
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-maroon opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrowseByEvent;
