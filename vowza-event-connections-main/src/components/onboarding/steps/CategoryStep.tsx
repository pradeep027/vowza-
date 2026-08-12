import { artistCategories, type ProfessionType } from '@/data/artistCategories';
import VowzaIcon from '@/components/VowzaIcon';
import { CategoryCard } from '../CategoryCard';
import { DynamicFieldRenderer } from '../DynamicFieldRenderer';

const BAND_PROFESSIONS = ['music_band', 'normal_band', 'maharashtra_band', 'traditional_band', 'musician', 'instrumental_artist', 'classical_musician'];
const BAND_CATEGORIES = [
  'Wedding Band', 'Brass Band', 'Pad Band', 'Baraat Band',
  'Punjabi Dhol Band', 'Nashik Dhol Band', 'Tamil Melam', 'Chenda Melam',
  'Marfa Band', 'Shivaji Maharashtrian Band', 'Traditional Folk Band',
  'Devotional Band', 'Shehnai & Nadaswaram Band', 'Live Music Band',
];

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
  const isBand = BAND_PROFESSIONS.includes(selectedCategory);

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

      {/* Band Category Dropdown — shows only for band professions */}
      {isBand && (
        <div className="mt-6 p-6 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h4 className="font-semibold mb-2 text-purple-900 dark:text-purple-200">Band Category *</h4>
          <p className="text-sm text-muted-foreground mb-4">Select the specific type of band you perform as.</p>
          <select
            value={categoryDetails.band_category || ''}
            onChange={e => onDetailsChange({ ...categoryDetails, band_category: e.target.value })}
            className="w-full rounded-xl border border-purple-200 dark:border-purple-700 bg-white dark:bg-[#1a1a24] px-4 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="">Select Band Category</option>
            {BAND_CATEGORIES.map(bc => (
              <option key={bc} value={bc}>{bc}</option>
            ))}
          </select>
        </div>
      )}

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
