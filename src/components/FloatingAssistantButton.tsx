import { Link, useLocation } from "@tanstack/react-router";
import { PawPrint } from "lucide-react";

export function FloatingAssistantButton() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/assistant")) return null;
  return (
    <Link
      to="/assistant"
      aria-label="Open AI Assistant"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full gradient-cta text-primary-foreground grid place-items-center shadow-glow hover:scale-105 active:scale-95 transition-transform animate-float-slow"
    >
      <PawPrint className="h-6 w-6" />
      <span className="sr-only">AI Assistant</span>
    </Link>
  );
}
