
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PinInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const PinInput = React.forwardRef<HTMLDivElement, PinInputProps>(
  ({ length = 4, value = '', onChange, onComplete, className, placeholder = '○', disabled }, ref) => {
    const [pins, setPins] = useState<string[]>(Array(length).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
      if (value) {
        const valueArray = value.split('').slice(0, length);
        const newPins = Array(length).fill('').map((_, i) => valueArray[i] || '');
        setPins(newPins);
      }
    }, [value, length]);

    const handleChange = (index: number, inputValue: string) => {
      if (disabled) return;
      
      // Only allow numbers
      if (inputValue && !/^\d$/.test(inputValue)) return;

      const newPins = [...pins];
      newPins[index] = inputValue;
      setPins(newPins);

      const newValue = newPins.join('');
      onChange?.(newValue);

      // Auto-focus next input
      if (inputValue && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Call onComplete when all pins are filled
      if (newValue.length === length) {
        onComplete?.(newValue);
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === 'Backspace' && !pins[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      if (disabled) return;
      
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text');
      const numbers = pasteData.replace(/\D/g, '').slice(0, length);
      
      if (numbers) {
        const newPins = Array(length).fill('').map((_, i) => numbers[i] || '');
        setPins(newPins);
        
        const newValue = newPins.join('');
        onChange?.(newValue);
        
        if (newValue.length === length) {
          onComplete?.(newValue);
        }
      }
    };

    const reset = () => {
      setPins(Array(length).fill(''));
      onChange?.('');
      inputRefs.current[0]?.focus();
    };

    // Expose reset function via ref
    React.useImperativeHandle(ref, () => ({
      reset,
    }));

    return (
      <div
        ref={ref}
        className={cn('flex gap-2', className)}
        onPaste={handlePaste}
      >
        {pins.map((pin, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={pin}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={disabled}
            className={cn(
              'w-12 h-12 text-center text-lg font-semibold border rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              pin ? 'border-blue-500' : 'border-gray-300'
            )}
            placeholder={placeholder}
          />
        ))}
      </div>
    );
  }
);

PinInput.displayName = 'PinInput';
