import * as React from "react";
import { cn } from "@/lib/utils";

interface PinInputProps {
  length?: number;
  onComplete?: (pin: string) => void;
  className?: string;
}

const PinInput = React.forwardRef<HTMLInputElement, PinInputProps>(
  ({ className, length = 4, onComplete }, ref) => {
    const [values, setValues] = React.useState<string[]>(Array(length).fill(""));
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (index: number, value: string) => {
      console.log("PIN handleChange:", { index, value, regex: /^\d$/.test(value) });
      
      // Only allow single digits
      if (value && !/^\d$/.test(value)) {
        console.log("PIN: rejecting non-digit value:", value);
        return;
      }

      const newValues = [...values];
      newValues[index] = value;
      setValues(newValues);
      console.log("PIN: values updated:", newValues);

      // Move to next input if value entered
      if (value && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
        console.log("PIN: moving to next input", index + 1);
      }

      // Call onComplete when all inputs are filled
      const pin = newValues.join("");
      console.log("PIN: checking completion:", { pin, length: pin.length, required: length });
      if (pin.length === length && onComplete) {
        console.log("PIN: calling onComplete with:", pin);
        onComplete(pin);
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
      // Move to previous input on backspace if current is empty
      if (e.key === "Backspace" && !values[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const paste = e.clipboardData.getData("text");
      const digits = paste.replace(/\D/g, "").slice(0, length);
      
      const newValues = Array(length).fill("");
      for (let i = 0; i < digits.length; i++) {
        newValues[i] = digits[i];
      }
      setValues(newValues);
      
      // Focus appropriate input
      const nextIndex = Math.min(digits.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      
      // Call onComplete if all filled
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
              inputRefs.current[index] = el;
              if (index === 0 && ref) {
                if (typeof ref === "function") ref(el);
                else ref.current = el;
              }
            }}
            type="text"
            inputMode="numeric"
            pattern="\d"
            maxLength={1}
            value={value}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={cn(
              "h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          />
        ))}
      </div>
    );
  }
);

PinInput.displayName = "PinInput";

export { PinInput };