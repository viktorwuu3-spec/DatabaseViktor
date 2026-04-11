import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
  prefix?: string;
}

function formatNumber(num: number): string {
  if (num === 0) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

function parseFormatted(str: string): number {
  const cleaned = str.replace(/[^\d]/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  disabled = false,
  className,
  "data-testid": testId,
  prefix = "Rp",
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatNumber(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentParsed = parseFormatted(displayValue);
    if (currentParsed !== value) {
      setDisplayValue(formatNumber(value));
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const cursorPos = e.target.selectionStart ?? 0;

      const oldLen = displayValue.length;
      const numericValue = parseFormatted(raw);
      const formatted = formatNumber(numericValue);
      const newLen = formatted.length;

      setDisplayValue(formatted);
      onChange(numericValue);

      requestAnimationFrame(() => {
        if (inputRef.current) {
          const diff = newLen - oldLen;
          const newCursor = Math.max(0, cursorPos + diff);
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [displayValue, onChange]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Tab" ||
      e.key === "Enter" ||
      e.key === "Home" ||
      e.key === "End" ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }, []);

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          prefix ? "pl-10 pr-3" : "px-3",
          className
        )}
      />
    </div>
  );
}
