import { forwardRef, useCallback, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { applyCurrencyMask } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, disabled, ...props }, ref) => {
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const masked = applyCurrencyMask(e.target.value);
        onValueChange(masked);
      },
      [onValueChange],
    );

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold select-none">
          R$
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn('pl-10 font-medium tabular-nums', className)}
          {...props}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';

