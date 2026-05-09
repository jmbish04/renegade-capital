/**
 * @fileoverview QuestionFlow Tool UI Component
 *
 * An interactive question flow component that guides users through
 * a series of questions, dynamically adapting based on previous answers.
 * After completion, locks into a summary state and sends answers
 * back to the AI thread via onComplete.
 */

import * as React from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Check, RotateCcw } from 'lucide-react';

export type QuestionFlowStep = {
  id: string;
  question: string;
  type?: 'text' | 'choice';
  options?: string[];
};

export type QuestionFlowProps = {
  steps: QuestionFlowStep[];
  onComplete?: (answers: Record<string, string>) => void;
};

export function QuestionFlow({ steps, onComplete }: QuestionFlowProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = React.useState('');
  const [isCompleted, setIsCompleted] = React.useState(false);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (!currentAnswer.trim()) return;

    const newAnswers = { ...answers, [step.id]: currentAnswer };
    setAnswers(newAnswers);

    if (isLastStep) {
      setIsCompleted(true);
      onComplete?.(newAnswers);
    } else {
      setCurrentStep(currentStep + 1);
      setCurrentAnswer('');
    }
  };

  const handleChoiceClick = (option: string) => {
    setCurrentAnswer(option);
  };

  React.useEffect(() => {
    // Reset current answer when step changes
    setCurrentAnswer('');
  }, [currentStep]);

  if (!step && !isCompleted) return null;

  // ─── Completed State ────────────────────────────────────────────
  if (isCompleted) {
    return (
      <Card className="p-6 bg-muted/30 border-border">
        <div className="space-y-4">
          {/* Full progress bar */}
          <div className="flex items-center gap-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className="h-1 flex-1 rounded-full bg-emerald-500 transition-colors"
              />
            ))}
          </div>

          {/* Completion header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <Check className="size-4 text-emerald-500" />
            </div>
            <div>
              <Label className="text-base font-semibold text-foreground">
                Questionnaire Complete
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your responses have been submitted
              </p>
            </div>
          </div>

          {/* All answers summary */}
          <div className="space-y-2 pt-2 border-t border-border">
            {steps.map((s) => {
              const answer = answers[s.id];
              if (!answer) return null;
              return (
                <div key={s.id} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {s.question}
                  </span>
                  <span className="text-sm text-foreground">{answer}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    );
  }

  // ─── Active Question State ──────────────────────────────────────
  return (
    <Card className="p-6 bg-muted/30 border-border">
      <div className="space-y-4">
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= currentStep ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <div>
          <Label className="text-base font-semibold text-foreground">
            Question {currentStep + 1} of {steps.length}
          </Label>
          <p className="mt-2 text-foreground">{step.question}</p>
        </div>

        {/* Input based on type */}
        {step.type === 'choice' && step.options ? (
          <div className="space-y-2">
            {step.options.map((option, index) => {
              // Gracefully handle if LLM passes {label, value} instead of a raw string
              const isObj = typeof option === 'object' && option !== null;
              const optionValue = isObj ? ((option as any).value || (option as any).label || JSON.stringify(option)) : String(option);
              const optionLabel = isObj ? ((option as any).label || (option as any).value || JSON.stringify(option)) : String(option);
              
              return (
                <button
                  key={`${optionValue}-${index}`}
                  type="button"
                  onClick={() => handleChoiceClick(optionValue)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    currentAnswer === optionValue
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {optionLabel}
                </button>
              );
            })}
          </div>
        ) : (
          <Input
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Type your answer here..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && currentAnswer.trim()) {
                handleNext();
              }
            }}
            className="bg-background"
          />
        )}

        {/* Navigation */}
        <div className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!currentAnswer.trim()}
          >
            {isLastStep ? 'Complete' : 'Next'}
          </Button>
        </div>

        {/* Previous answers (optional display) */}
        {Object.keys(answers).length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Your answers:</p>
            <div className="space-y-1">
              {Object.entries(answers).map(([stepId, answer]) => {
                const answeredStep = steps.find(s => s.id === stepId);
                return (
                  <div key={stepId} className="text-xs text-muted-foreground">
                    <span className="font-medium">{answeredStep?.question.slice(0, 30)}...</span>
                    {': '}
                    <span>{answer}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
