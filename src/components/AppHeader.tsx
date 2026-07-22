import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Bell, Home, Bot, BookOpen, User, Settings, LogOut, PawPrint, Users as UsersIcon, Syringe } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/AuthShell";
import { useRole } from "@/hooks/use-role";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/pets", label: "My Pets", icon: PawPrint },
  { to: "/vaccinations", label: "Vaccinations", icon: Syringe },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;


type NavItem = { to: string; label: string; icon: typeof Home };

export function AppHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { isOwner, isStaff } = useRole();

  const navItems: NavItem[] = [
    ...baseNav.slice(0, 4),
    ...(isStaff ? [{ to: "/knowledge-base", label: "Knowledge Base", icon: BookOpen }] : []),
    ...(isOwner ? [{ to: "/users", label: "User Management", icon: UsersIcon }] : []),
    ...baseNav.slice(4),
  ];

  async function onSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/signin", replace: true });
  }


  return (
    <header className="mx-auto max-w-5xl px-5 sm:px-8 h-16 sm:h-18 flex items-center justify-between">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Open menu"
          className="h-10 w-10 rounded-2xl glass grid place-items-center hover:shadow-soft transition-all"
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gradient-hero-bg border-r-0 p-0">
          <SheetHeader className="p-5 border-b border-border/50">
            <SheetTitle className="text-left">
              <BrandMark />
            </SheetTitle>
          </SheetHeader>
          <nav className="p-3 flex flex-col gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to as "/dashboard"}

                onClick={() => setOpen(false)}
                activeProps={{ className: "bg-primary/10 text-primary" }}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium hover:bg-primary/5 transition-colors"
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}

            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors text-left"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </nav>
        </SheetContent>
      </Sheet>

      <BrandMark />

      <button
        aria-label="Notifications"
        className="h-10 w-10 rounded-2xl glass grid place-items-center hover:shadow-soft transition-all relative"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
      </button>
    </header>
  );
}
