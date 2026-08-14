import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: { title: string; description: string }[];
}

export const OnboardingProgress = ({ currentStep, totalSteps, steps }: OnboardingProgressProps) => {
  return (
    <div className="w-full mb-8">
      {/* Progress bar */}
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden mb-6">
        <div
          className="absolute h-full bg-gradient-gold transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step indicators - mobile */}
      <div className="flex justify-center lg:hidden mb-4">
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      {/* Step indicators - desktop */}
      <div className="hidden lg:flex justify-between">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn(
              'flex flex-col items-center flex-1',
              index < steps.length - 1 && 'relative'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                index < currentStep
                  ? 'bg-gradient-gold text-primary-foreground'
                  : index === currentStep
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              {index < currentStep ? (
                <Check className="w-5 h-5" />
              ) : (
                index + 1
              )}
            </div>
            <div className="mt-2 text-center">
              <p
                className={cn(
                  'text-sm font-medium transition-colors',
                  index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground hidden xl:block">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
