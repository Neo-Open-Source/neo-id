"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, type, className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && visible ? "text" : type;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm text-content">{label}</label>
      )}
      <div className="relative">
        <input
          type={inputType}
          className={cn(
            "w-full px-4 py-2.5 text-sm bg-surface border text-content rounded-input outline-none transition-all",
            "placeholder:text-dim focus:border-accent focus:ring-2 focus:ring-accent/20",
            error ? "border-danger" : "border-border",
            isPassword && "pr-10",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible(!visible)}
            className="absolute right-3 inset-y-0 flex items-center text-dim hover:text-content transition-colors cursor-pointer"
          >
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
