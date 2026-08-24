import { cn } from '@/lib/utils';
import { type ArtistCategory } from '@/data/artistCategories';

interface CategoryCardProps {
  category: ArtistCategory;
  selected: boolean;
  onSelect: () => void;
}

export const CategoryCard = ({ category, selected, onSelect }: CategoryCardProps) => {
  const Icon = category.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative p-4 rounded-xl border-2 transition-all duration-300 text-left group overflow-hidden',
        selected
          ? 'border-primary bg-primary/5 shadow-lg scale-[1.02]'
          : 'border-border hover:border-primary/50 hover:shadow-md'
      )}
    >
      {/* Background gradient on hover/select */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 transition-opacity duration-300 bg-gradient-to-br',
          category.color,
          selected ? 'opacity-10' : 'group-hover:opacity-5'
        )}
      />

      <div className="relative z-10">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 bg-gradient-to-br',
            category.color,
            selected ? 'shadow-lg' : ''
          )}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">{category.label}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
      </div>

      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
          <svg
            className="w-4 h-4 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
};
