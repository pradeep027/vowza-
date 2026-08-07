import { artistCategories, type ProfessionType } from '@/data/artistCategories';
import VowzaIcon from '@/components/VowzaIcon';
import { CategoryCard } from '../CategoryCard';
import { DynamicFieldRenderer } from '../DynamicFieldRenderer';

interface CategoryStepProps {
  selectedCategory: ProfessionType | '';
  categoryDetails: Record<string, any>;
  onCategoryChange: (category: ProfessionType) => void;
  onDetailsChange: (details: Record<string, any>) => void;
}

export const CategoryStep = ({
  selectedCategory,
  categoryDetails,
  onCategoryChange,
  onDetailsChange,
}: CategoryStepProps) => {
  const selectedCategoryData = artistCategories.find((c) => c.value === selectedCategory);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Category Selection */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <VowzaIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Select Your Category *</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Choose the category that best describes your talent. This helps customers find you easily.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {artistCategories.map((category) => (
            <CategoryCard
              key={category.value}
              category={category}
              selected={selectedCategory === category.value}
              onSelect={() => onCategoryChange(category.value)}
            />
          ))}
        </div>
      </div>

      {/* Dynamic Fields for Selected Category */}
      {selectedCategoryData && selectedCategoryData.dynamicFields.length > 0 && (
        <div className="mt-8 p-6 bg-secondary/30 rounded-xl border border-border animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <selectedCategoryData.icon className="w-5 h-5" />
            {selectedCategoryData.label} Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {selectedCategoryData.dynamicFields.map((field) => (
              <DynamicFieldRenderer
                key={field.name}
                field={field}
                value={categoryDetails[field.name]}
                onChange={(value) =>
                  onDetailsChange({ ...categoryDetails, [field.name]: value })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
