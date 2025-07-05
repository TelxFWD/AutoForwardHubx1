import * as React from "react";
import { cn } from "@/lib/utils";

interface PinInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  length?: number;
  onComplete?: (pin: string) => void;
}

const PinInput = React.forwardRef<HTMLInputElement, PinInputProps>(
  ({ className, length = 4, onComplete, ...props }, ref) => {
    const [values, setValues] = React.useState<string[]>(new Array(length).fill(""));
    const inputRefs = React.useRef<HTMLInputElement[]>([]);

    const handleChange = (index: number, value: string) => {
      // Only allow digits
      if (!/^\d*$/.test(value)) return;

      const newValues = [...values];
      newValues[index] = value.slice(-1); // Only take the last digit
      setValues(newValues);

      // Move to next input
      if (value && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if complete
      const pin = newValues.join("");
      if (pin.length === length && onComplete) {
        onComplete(pin);
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !values[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const paste = e.clipboardData.getData("text");
      const digits = paste.replace(/\D/g, "").slice(0, length);
      
      const newValues = new Array(length).fill("");
      for (let i = 0; i < digits.length; i++) {
        newValues[i] = digits[i];
      }
      setValues(newValues);
      
      if (digits.length === length && onComplete) {
        onComplete(digits);
      }
    };

    return (
      <div className="flex gap-2">
        {values.map((value, index) => (
          <input
            key={index}
            ref={(el) => {
              if (el) inputRefs.current[index] = el;
              if (index === 0) {
                if (typeof ref === "function") ref(el);
                else if (ref) ref.current = el;
              }
            }}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={cn(
              "flex h-12 w-12 rounded-md border border-input bg-background px-3 py-2 text-center text-lg font-mono ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
        ))}
      </div>
    );
  }
);
PinInput.displayName = "PinInput";

export { PinInput };