"use client";

import { cn } from "@/lib/cn";

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
  name?: string;
  disabled?: boolean;
}

export function CodeInput({
  value,
  onChange,
  maxLength = 6,
  placeholder = "000000",
  label,
  className,
  autoFocus,
  name = "code",
  disabled,
}: CodeInputProps) {
  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      {label && <label className="text-sm font-medium text-content">{label}</label>}
      <input
        type="text"
        inputMode="numeric"
        name={name}
        autoComplete="one-time-code"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxLength))}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn(
          "w-full px-4 py-4 text-lg font-semibold tracking-widest text-center text-content",
          "bg-app border border-border rounded-input",
          "outline-none transition-[border-color,box-shadow,background] duration-150",
          "placeholder:text-dim placeholder:font-medium",
          "hover:border-border-hover",
          "focus:border-accent focus:ring-2 focus:ring-accent/20 focus:bg-surface",
        )}
      />
    </div>
  );
}
