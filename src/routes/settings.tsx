import { createFileRoute } from "@tanstack/react-router";
import { Bell, Moon, Globe, Shield, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ZuZo AI" },
      { name: "description", content: "ZuZo AI settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const items = [
  { icon: Bell, label: "Notifications", hint: "Push, email, and reminders" },
  { icon: Moon, label: "Appearance", hint: "Theme and display" },
  { icon: Globe, label: "Language", hint: "English" },
  { icon: Shield, label: "Privacy & Security", hint: "Manage your data" },
];

function SettingsPage() {
  return (
    <div className="min-h-screen gradient-hero-bg">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-8 sm:py-12">
        <div className="glass rounded-3xl p-8 sm:p-10 shadow-glow animate-fade-up">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your ZuZo AI preferences. More options coming soon.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {items.map(({ icon: Icon, label, hint }) => (
              <button
                key={label}
                className="flex items-center gap-4 rounded-2xl glass p-4 text-left hover:shadow-soft transition-all"
              >
                <div className="h-10 w-10 rounded-xl gradient-cta grid place-items-center shadow-soft">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </main>
      <FloatingAssistantButton />
    </div>
  );
}
