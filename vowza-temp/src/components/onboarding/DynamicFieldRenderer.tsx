import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { CategoryField } from '@/data/artistCategories';

interface DynamicFieldRendererProps {
  field: CategoryField;
  value: any;
  onChange: (value: any) => void;
}

export const DynamicFieldRenderer = ({ field, value, onChange }: DynamicFieldRendererProps) => {
  if (field.type === 'text') {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={field.name}
          placeholder={field.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="border-border focus:border-primary"
        />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={field.name}
          type="number"
          min="0"
          placeholder={field.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="border-border focus:border-primary"
        />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Textarea
          id={field.name}
          placeholder={field.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="border-border focus:border-primary resize-none"
          rows={3}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="border-border focus:border-primary">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === 'multiselect') {
    const selectedValues: string[] = value || [];

    const toggleOption = (optionValue: string) => {
      if (selectedValues.includes(optionValue)) {
        onChange(selectedValues.filter((v) => v !== optionValue));
      } else {
        onChange([...selectedValues, optionValue]);
      }
    };

    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="flex flex-wrap gap-2">
          {field.options?.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <Badge
                key={option.value}
                variant={isSelected ? 'default' : 'outline'}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-primary hover:bg-primary/90'
                    : 'hover:bg-secondary'
                }`}
                onClick={() => toggleOption(option.value)}
              >
                {option.label}
                {isSelected && <X className="w-3 h-3 ml-1" />}
              </Badge>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
