"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, type, className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && visible ? "text" : type;

  return (
    <div className="input-wrapper">
      {label && <label className="input-label">{label}</label>}
      <div className="relative">
        <input
          type={inputType}
          className={cn(
            "input",
            error && "input--error",
            isPassword && "input--password",
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
            <Icon name={visible ? "eye-crossed" : "eye"} size={16} />
          </button>
        )}
      </div>
      {error && <span className="input-error">{error}</span>}
    </div>
  );
}
