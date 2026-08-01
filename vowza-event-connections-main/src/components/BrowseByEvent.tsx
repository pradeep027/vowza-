// ─── BrowseByEvent — Dynamic event types with Supabase + static fallback ──────

import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eventTypes } from "@/data/services"; // static fallback

interface EventTypeRow {
  id: string;
  name: string;
  icon: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  gradient?: string;
  artist_count?: number;
}

// Pull live event types from DB; fall back to static data
function useEventTypes() {
  return useQuery({
    queryKey: ["event-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_types" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (error || !data || (data as any[]).length === 0) return null; // signal fallback
      return data as EventTypeRow[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

// Gradient palette cycles for DB rows that have no gradient column
const gradients = [
  "from-rose-400 to-maroon",
  "from-gold to-amber-600",
  "from-blue-400 to-indigo-600",
  "from-purple-400 to-purple-700",
  "from-green-400 to-emerald-600",
  "from-orange-400 to-orange-700",
  "from-pink-400 to-rose-600",
  "from-teal-400 to-teal-700",
  "from-yellow-400 to-amber-500",
  "from-cyan-400 to-blue-600",
  "from-red-400 to-red-700",
  "from-violet-400 to-violet-700",
];

const BrowseByEvent = () => {
  const navigate = useNavigate();
  const { data: dbEvents, isLoading } = useEventTypes();

  // Normalise: DB rows or static fallback — same shape consumed below
  const events = dbEvents
    ? dbEvents.map((ev, i) => ({
        id: ev.id,
        name: ev.name,
        icon: ev.icon,
        description: ev.description,
        artistCount: ev.artist_count ?? 0,
        gradient: ev.gradient ?? gradients[i % gradients.length],
      }))
    : eventTypes;

  const handleClick = (eventId: string) => {
    navigate(`/artists?event=${eventId}`);
  };

  return (
    <section className="py-14 md:py-20 bg-secondary">      <div className="container px-4">
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

        {/* Event grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
            {events.map((event, index) => (
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

                {/* Icon / emoji */}
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
                    {event.artistCount > 0
                      ? `${event.artistCount.toLocaleString()}+ artists`
                      : "Find artists"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-maroon opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BrowseByEvent;
