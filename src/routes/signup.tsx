import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthShell, GoogleIcon } from "@/components/AuthShell";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — ZuZo AI" },
      { name: "description", content: "Join ZuZo AI and give your pets smarter, AI-powered care." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignUpPage,
});

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(80),
    email: z.string().trim().email("Please enter a valid email address").max(255),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72)
      .regex(/[A-Za-z]/, "Password must contain a letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

function SignUpPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ fullName, email, password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin + "/dashboard",
          data: { full_name: parsed.data.fullName },
        },
      });
      if (error) {
        const already = /registered|exists|already/i.test(error.message);
        toast.error(
          already
            ? "An account with this email already exists. Try signing in instead."
            : error.message,
        );
        return;
      }
      if (data.session) {
        toast.success("Welcome to ZuZo AI! 🐾");
      } else {
        toast.success("Check your inbox to confirm your email.");
        navigate({ to: "/signin" });
      }
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
      title={<>Create Your ZuZo AI Account <span aria-hidden>🐾</span></>}
      subtitle="Join ZuZo AI and give your pets smarter care."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-semibold text-primary hover:text-primary-glow transition-colors">
            Sign In
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading}
        className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-white border border-border h-12 px-6 font-medium text-foreground shadow-sm hover:shadow-md hover:border-primary/30 hover:bg-secondary/40 transition-all disabled:opacity-70"
      >
        {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
        <span>Sign up with Google</span>
      </button>

      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">or continue with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="fullName" label="Full Name" type="text" value={fullName} onChange={setFullName}
          icon={<User className="h-4 w-4" />} placeholder="Jane Doe" autoComplete="name" required />
        <Field id="email" label="Email Address" type="email" value={email} onChange={setEmail}
          icon={<Mail className="h-4 w-4" />} placeholder="you@example.com" autoComplete="email" required />
        <Field
          id="password" label="Password" type={showPwd ? "text" : "password"}
          value={password} onChange={setPassword} icon={<Lock className="h-4 w-4" />}
          placeholder="At least 8 characters" autoComplete="new-password" required
          trailing={
            <button type="button" onClick={() => setShowPwd((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPwd ? "Hide password" : "Show password"}>
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <Field id="confirm" label="Confirm Password" type={showPwd ? "text" : "password"}
          value={confirm} onChange={setConfirm} icon={<Lock className="h-4 w-4" />}
          placeholder="Re-enter password" autoComplete="new-password" required />

        <button
          type="submit"
          disabled={loading}
          className="mt-2 group w-full inline-flex items-center justify-center gap-2 rounded-2xl gradient-primary text-primary-foreground font-semibold h-12 px-6 shadow-glow hover:shadow-soft transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>Create Account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
          )}
        </button>
      </form>
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
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        )}
        <input
          id={id} name={id} type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} autoComplete={autoComplete} required={required}
          className={`w-full h-12 rounded-2xl bg-white/70 border border-border ${
            icon ? "pl-11" : "pl-4"
          } ${trailing ? "pr-11" : "pr-4"} text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/15`}
        />
        {trailing && <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}
