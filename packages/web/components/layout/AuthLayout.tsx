import type { ReactNode } from "react";
import Link from "next/link";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: { text: string; link: string; label: string };
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex h-svh w-screen overflow-hidden bg-surface">
      {/* Left: Form */}
      <div className="flex flex-col justify-center w-full md:w-[35%] lg:w-[38%] xl:w-[40%] px-6 sm:px-10 md:px-12 py-8 bg-surface animate-[fadeIn_300ms_ease-out] overflow-y-auto">
        <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="text-sm font-semibold text-content">Neo ID</span>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-content">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>

          {/* Form Content */}
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <p className="text-sm text-muted text-center mt-6 max-w-sm mx-auto w-full">
            {footer.text}{" "}
            <Link
              href={footer.link}
              className="text-accent hover:text-accent-hover font-medium transition-colors"
            >
              {footer.label}
            </Link>
          </p>
        )}
      </div>

      {/* Right: Gradient Decoration */}
      <div className="hidden md:flex md:w-[65%] lg:w-[62%] xl:w-[60%] bg-gradient-to-br from-accent via-accent-hover to-brand-active rounded-l-[32px] relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 rounded-l-[32px]" />
        {/* Optional: Add decorative elements here */}
      </div>
    </div>
  );
}
