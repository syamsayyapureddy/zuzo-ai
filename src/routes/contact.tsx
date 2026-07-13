import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Mail, Phone, User, MessageSquare, Send, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — ZuZo AI" },
      { name: "description", content: "Get in touch with the ZuZo AI team. We respond within 24 hours." },
      { property: "og:title", content: "Contact ZuZo AI" },
      { property: "og:description", content: "Questions about your pet? Reach the ZuZo AI team." },
    ],
  }),
  component: ContactPage,
});

const phoneRegex = /^\+?[0-9\s\-().]{7,20}$/;

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .max(255),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || phoneRegex.test(v), {
      message: "Please enter a valid phone number",
    }),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be less than 2000 characters"),
});

const SUPPORT_EMAIL = "support@zuzo.ai";
const SUPPORT_PHONE = "+91-XXXXXXXXXX";
const MESSAGE_MAX = 2000;

function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setWebsite("");
    setSubmittedName(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Honeypot: silently accept without storing anything
    if (website.trim() !== "") {
      setSubmittedName(fullName.trim().split(" ")[0] || "there");
      return;
    }

    const parsed = schema.safeParse({ full_name: fullName, email, phone, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("contact_submissions").insert({
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        message: parsed.data.message,
        source_page: "/contact",
        user_id: session?.user.id ?? null,
      });
      if (error) {
        toast.error("We couldn't send your message right now. Please check your connection and try again.");
        return;
      }
      setSubmittedName(parsed.data.full_name.split(" ")[0] || "there");
    } catch {
      toast.error("We couldn't send your message right now. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen gradient-hero-bg py-16 sm:py-24 px-5 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Get in <span className="text-gradient">Touch</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Questions about your pet? Send us a message and our team will reply within 24 hours.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm text-foreground/80">
            <Clock className="h-4 w-4 text-primary" /> Response within 24 hours
          </div>
        </div>

        <div className="mt-10 glass rounded-3xl p-6 sm:p-10 shadow-glow">
          {submittedName ? (
            <div className="text-center py-6">
              <div className="mx-auto h-14 w-14 rounded-2xl gradient-primary grid place-items-center shadow-soft">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
              <h2 className="mt-5 font-display text-2xl sm:text-3xl font-bold">
                Thank you, {submittedName}!
              </h2>
              <p className="mt-3 text-muted-foreground max-w-md mx-auto">
                Your message has been sent successfully. Our team will contact you within 24 hours.
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl gradient-primary text-white font-semibold h-12 px-6 shadow-glow hover:-translate-y-0.5 transition-all"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {/* Honeypot */}
              <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" style={{ position: "absolute" }}>
                <label>
                  Website
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>

              <Field
                id="full_name"
                label="Full Name"
                type="text"
                value={fullName}
                onChange={setFullName}
                placeholder="Enter your full name"
                icon={<User className="h-4 w-4" />}
                autoComplete="name"
                maxLength={100}
                required
              />
              <Field
                id="email"
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Enter your email address"
                icon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                maxLength={255}
                required
              />
              <Field
                id="phone"
                label="Phone (optional)"
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="Enter your phone number (optional)"
                icon={<Phone className="h-4 w-4" />}
                autoComplete="tel"
                maxLength={20}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="message" className="text-sm font-medium text-foreground">
                    Message
                  </label>
                  <span className={`text-xs ${message.length > MESSAGE_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                    {message.length} / {MESSAGE_MAX}
                  </span>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-4 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <textarea
                    id="message"
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                    placeholder="Tell us how we can help your pet or answer your question..."
                    rows={6}
                    required
                    className="w-full rounded-2xl bg-white/70 border border-border pl-11 pr-4 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/15 resize-y"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-2xl gradient-primary text-white font-semibold h-12 px-6 shadow-glow hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {submitting ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Message</>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground pt-2">
                By submitting this form, you agree that ZuZo AI may use your details to respond to your enquiry.{" "}
                <Link to="/privacy" className="text-primary hover:text-primary-glow font-medium underline underline-offset-2">
                  Privacy Policy
                </Link>
              </p>
            </form>
          )}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 text-sm">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="glass rounded-2xl p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-all">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Email</div>
              <div className="text-muted-foreground">{SUPPORT_EMAIL}</div>
            </div>
          </a>
          <a href={`tel:${SUPPORT_PHONE.replace(/[^+0-9]/g, "")}`} className="glass rounded-2xl p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-all">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Phone</div>
              <div className="text-muted-foreground">{SUPPORT_PHONE}</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

function Field({
  id, label, type, value, onChange, placeholder, icon, autoComplete, required, maxLength,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
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
          maxLength={maxLength}
          className={`w-full h-12 rounded-2xl bg-white/70 border border-border ${
            icon ? "pl-11" : "pl-4"
          } pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-white focus:ring-4 focus:ring-primary/15`}
        />
      </div>
    </div>
  );
}
