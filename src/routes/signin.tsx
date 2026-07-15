import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthShell, Divider, GoogleIcon } from "@/components/AuthShell";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign In — ZuZo AI" },
      { name: "description", content: "Sign in to ZuZo AI to continue caring for your pets with smart, AI-powered guidance." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignInPage,
});

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const getRedirect = () => {
      try {
        const t = sessionStorage.getItem("zuzo.postAuthRedirect");
        if (t) sessionStorage.removeItem("zuzo.postAuthRedirect");
        return (t as "/assistant" | "/dashboard" | null) ?? "/dashboard";
      } catch { return "/dashboard"; }
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: getRedirect(), replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: getRedirect(), replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        const msg = /invalid/i.test(error.message)
          ? "Incorrect email or password. Please try again."
          : error.message;
        toast.error(msg);
        return;
      }
      toast.success("Welcome back! Redirecting…");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/dashboard",
      });
      if (result.error) {
        toast.error("Google sign in failed. Please try again.");
        setGoogleLoading(false);
      }
    } catch {
      toast.error("Google sign in failed. Please try again.");
      setGoogleLoading(false);
    }
  }

  return (
    <AuthShell
      title={<>Welcome Back <span aria-hidden>👋</span></>}
      subtitle="Sign in to continue caring for your pets with ZuZo AI."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-primary hover:text-primary-glow transition-colors">
            Sign Up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          id="email"
          type="email"
          label="Email Address"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          icon={<Mail className="h-4 w-4" />}
          autoComplete="email"
          required
        />
        <Field
          id="password"
          type={showPwd ? "text" : "password"}
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          icon={<Lock className="h-4 w-4" />}
          autoComplete="current-password"
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex items-center justify-between text-sm pt-1">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 accent-primary"
            />
            <span className="text-muted-foreground">Remember me</span>
          </label>
          <button
            type="button"
            onClick={() => toast.info("Password reset is coming soon.")}
            className="font-medium text-primary hover:text-primary-glow transition-colors"
          >
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 group w-full inline-flex items-center justify-center gap-2 rounded-2xl gradient-primary text-primary-foreground font-semibold h-12 px-6 shadow-glow hover:shadow-soft transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>Sign In <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
          )}
        </button>
      </form>

      <Divider />

      <button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading}
        className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-white border border-border h-12 px-6 font-medium text-foreground shadow-sm hover:shadow-md hover:border-primary/30 hover:bg-secondary/40 transition-all disabled:opacity-70"
      >
        {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
        <span>Continue with Google</span>
      </button>
    </AuthShell>
  );
}

function Field({
  id, label, type, value, onChange, placeholder, icon, trailing, autoComplete, required,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={`w-full h-12 rounded-2xl bg-white/70 border border-border ${
            icon ? "pl-11" : "pl-4"
          } ${trailing ? "pr-11" : "pr-4"} text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/15`}
        />
        {trailing && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span>
        )}
      </div>
    </div>
  );
}
