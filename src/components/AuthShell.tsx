import { Link } from "@tanstack/react-router";
import { Brain, PawPrint } from "lucide-react";
import type { ReactNode } from "react";

export function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export function BrandMark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 group">
      <div className="relative h-10 w-10 rounded-2xl gradient-primary grid place-items-center shadow-soft transition-transform group-hover:scale-105">
        <Brain className="h-5 w-5 text-white absolute" strokeWidth={2.4} />
        <PawPrint className="h-3.5 w-3.5 text-white/90 absolute translate-x-2 translate-y-2" strokeWidth={2.6} />
      </div>
      <span className="font-display text-xl font-bold tracking-tight">
        ZuZo <span className="text-gradient">AI</span>
      </span>
    </Link>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen gradient-hero-bg relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary-glow/20 blur-3xl animate-blob" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 py-8 sm:py-12">
        <BrandMark />

        <main className="flex-1 flex items-center">
          <div className="w-full glass rounded-3xl p-7 sm:p-9 shadow-glow animate-fade-up">
            <div className="mb-7 text-center sm:text-left">
              <h1 className="font-display text-3xl sm:text-[2rem] font-bold leading-tight">{title}</h1>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
        </main>

        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-4">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium tracking-widest text-muted-foreground">OR</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
