import React, { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface PinInputProps {
  length: number;
  onComplete: (pin: string) => void;
  className?: string;
}

export function PinInput({ length, onComplete, className }: PinInputProps) {
  const [pins, setPins] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const resetPins = () => {
    setPins(Array(length).fill(''));
    inputRefs.current[0]?.focus();
  };

  useEffect(() => {
    resetPins();
  }, [length]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPins = [...pins];
    newPins[index] = value;
    setPins(newPins);

    // Move to next input if value is entered
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all pins are filled
    if (newPins.every(pin => pin !== '')) {
      const completedPin = newPins.join('');
      console.log('PIN completed:', completedPin);
      onComplete(completedPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pins[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');

    if (/^\d+$/.test(pasteData) && pasteData.length <= length) {
      const newPins = Array(length).fill('');
      for (let i = 0; i < pasteData.length; i++) {
        newPins[i] = pasteData[i];
      }
      setPins(newPins);

      if (pasteData.length === length) {
        const completedPin = pasteData;
        console.log('PIN pasted and completed:', completedPin);
        onComplete(completedPin);
      }
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {Array.from({ length }, (_, index) => (
        <Input
          key={index}
          ref={(el) => inputRefs.current[index] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={pins[index]}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className="w-12 h-12 text-center text-lg font-semibold"
        />
      ))}
    </div>
  );
}