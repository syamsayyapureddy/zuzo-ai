import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Brain, PawPrint, Menu, X, Sparkles, ArrowRight, Check,
  Bot, BookOpen, MapPin, Beef, Dumbbell, Heart, ShieldCheck,
  Clock, Utensils, MessageCircle, Instagram, Facebook, Twitter, Linkedin,
  LayoutDashboard, LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import heroImg from "@/assets/hero-pet.jpg";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Home,
});

function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative h-10 w-10 rounded-2xl gradient-primary grid place-items-center shadow-soft">
        <Brain className="h-5 w-5 text-white absolute" strokeWidth={2.4} />
        <PawPrint className="h-3.5 w-3.5 text-white/90 absolute translate-x-2 translate-y-2" strokeWidth={2.6} />
      </div>
      <span className="font-display text-xl font-bold tracking-tight">
        ZuZo <span className="text-gradient">AI</span>
      </span>
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    supabase.auth.getSession().then(({ data }) => setIsAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  const links = [
    { label: "Home", href: "#home" },
    { label: "Features", href: "#features" },
    { label: "How it Works", href: "#how" },
    { label: "About", href: "#about" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-strong shadow-soft" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto max-w-7xl px-5 sm:px-8 h-16 sm:h-18 flex items-center justify-between">
        <Logo />
        <ul className="hidden lg:flex items-center gap-8 text-sm font-medium text-foreground/80">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="hover:text-primary transition-colors">{l.label}</a>
            </li>
          ))}
        </ul>
        <div className="hidden lg:flex items-center gap-3">
          {isAuthed ? (
            <>
              <Link to="/dashboard" className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors inline-flex items-center gap-1.5">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <button
                onClick={onSignOut}
                className="group px-5 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold shadow-soft hover:shadow-glow transition-all hover:-translate-y-0.5 inline-flex items-center gap-1.5"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/signin" className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Sign In
              </Link>
              <Link to="/signup" className="group px-5 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold shadow-soft hover:shadow-glow transition-all hover:-translate-y-0.5 inline-flex items-center gap-1.5">
                Sign Up <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>
        <button
          className="lg:hidden h-10 w-10 grid place-items-center rounded-xl glass"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      {open && (
        <div className="lg:hidden glass-strong border-t border-white/40 px-5 py-4 animate-fade-up">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2.5 rounded-xl hover:bg-primary/10 text-foreground/85 font-medium"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            {isAuthed ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-2.5 rounded-xl border border-border font-medium">Dashboard</Link>
                <button onClick={() => { setOpen(false); onSignOut(); }} className="flex-1 text-center px-4 py-2.5 rounded-xl gradient-primary text-white font-semibold">Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/signin" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-2.5 rounded-xl border border-border font-medium">Sign In</Link>
                <Link to="/signup" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-2.5 rounded-xl gradient-primary text-white font-semibold">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="home" className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 overflow-hidden gradient-hero-bg">
      <div aria-hidden className="absolute -top-20 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
      <div aria-hidden className="absolute top-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary-glow/20 blur-3xl animate-blob [animation-delay:-4s]" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, currentColor 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, currentColor 1.5px, transparent 2px)",
          backgroundSize: "120px 120px",
          color: "oklch(0.5 0.15 148)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass text-xs sm:text-sm font-medium text-primary-glow">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered pet care, made simple
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-foreground">
            Your Smart <span className="text-gradient">Pet Care</span> Companion <span className="inline-block">🐾</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            Get instant AI-powered answers, personalized pet care guidance, food recommendations, training tips, and nearby veterinary support—all in one intelligent platform.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="group px-6 py-3.5 rounded-full gradient-primary text-white font-semibold shadow-glow hover:-translate-y-0.5 transition-all inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Ask AI
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button className="px-6 py-3.5 rounded-full glass font-semibold text-foreground hover:bg-white/90 transition-all">
              Learn More
            </button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/75">
            {["AI Powered", "Trusted Pet Care", "24/7 Assistance"].map((b) => (
              <li key={b} className="inline-flex items-center gap-2">
                <span className="h-5 w-5 rounded-full gradient-primary grid place-items-center">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-fade-up [animation-delay:120ms]">
          <div className="relative rounded-3xl overflow-hidden glass-strong shadow-glow">
            <img
              src={heroImg}
              alt="Pet owner using ZuZo AI mobile app with a dog and cat"
              width={1200}
              height={1200}
              className="w-full h-auto"
            />
          </div>

          <div className="absolute -left-3 sm:-left-8 top-8 sm:top-14 glass rounded-2xl px-3.5 py-2.5 shadow-soft animate-float-slow">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl gradient-primary grid place-items-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="text-xs">
                <p className="font-semibold">ZuZo says</p>
                <p className="text-muted-foreground">Time for a walk 🐕</p>
              </div>
            </div>
          </div>

          <div className="absolute -right-2 sm:-right-6 top-24 glass rounded-2xl px-3.5 py-2.5 shadow-soft animate-float-medium">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-red-100 grid place-items-center">
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              </div>
              <div className="text-xs">
                <p className="font-semibold">Health 92%</p>
                <p className="text-muted-foreground">Excellent</p>
              </div>
            </div>
          </div>

          <div className="absolute -left-2 sm:-left-6 bottom-16 glass rounded-2xl px-3.5 py-2.5 shadow-soft animate-float-medium [animation-delay:-2s]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-100 grid place-items-center">
                <MapPin className="h-4 w-4 text-accent-blue" />
              </div>
              <div className="text-xs">
                <p className="font-semibold">Vet Nearby</p>
                <p className="text-muted-foreground">0.8 mi away</p>
              </div>
            </div>
          </div>

          <div className="absolute -right-3 sm:-right-8 bottom-8 glass rounded-2xl px-3.5 py-2.5 shadow-soft animate-float-slow [animation-delay:-3s]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-100 grid place-items-center">
                <Utensils className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-xs">
                <p className="font-semibold">Meal ready</p>
                <p className="text-muted-foreground">1 cup · 320 kcal</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  { icon: Bot, emoji: "🤖", title: "AI Pet Assistant", desc: "Instant answers to any pet-related question, anytime you need them." },
  { icon: BookOpen, emoji: "📚", title: "Pet Care Guides", desc: "Easy-to-follow care instructions tailored to your pet's breed and age." },
  { icon: MapPin, emoji: "🏥", title: "Vet Finder", desc: "Locate trusted nearby veterinarians and emergency clinics in seconds." },
  { icon: Beef, emoji: "🥩", title: "Smart Food Recommendations", desc: "Personalized nutrition plans based on your pet's health profile." },
  { icon: Dumbbell, emoji: "🎾", title: "Training Tips", desc: "AI-powered behavior guidance to raise a happier, well-trained pet." },
];

function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary-glow tracking-wider uppercase">Features</p>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            Everything You Need for <span className="text-gradient">Better Pet Care</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Powerful AI tools that make caring for your pet effortless and joyful.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group glass rounded-3xl p-7 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-glow"
            >
              <div className="h-14 w-14 rounded-2xl gradient-primary grid place-items-center shadow-soft group-hover:scale-110 transition-transform">
                <f.icon className="h-6 w-6 text-white" strokeWidth={2.2} />
              </div>
              <h3 className="mt-5 text-xl font-bold flex items-center gap-2">
                <span>{f.title}</span><span className="text-base">{f.emoji}</span>
              </h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
          <div className="rounded-3xl p-7 shadow-soft flex flex-col justify-center gradient-primary text-white">
            <Sparkles className="h-8 w-8" />
            <h3 className="mt-3 text-xl font-bold">And more coming soon</h3>
            <p className="mt-2 text-white/90">New AI abilities added every month—shaped by pet parents like you.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const steps = [
  { n: "01", title: "Ask about your pet", desc: "Type or speak any question—symptoms, food, training, or care.", icon: MessageCircle },
  { n: "02", title: "AI analyzes your request", desc: "ZuZo processes your pet's profile and finds the safest guidance.", icon: Brain },
  { n: "03", title: "Get instant recommendations", desc: "Receive personalized, vet-informed answers in seconds.", icon: Sparkles },
];

function HowItWorks() {
  return (
    <section id="how" className="relative py-20 sm:py-28 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary-glow tracking-wider uppercase">How it works</p>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold">
            Get answers in <span className="text-gradient">three simple steps</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3 relative">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="glass rounded-3xl p-7 h-full shadow-soft hover:-translate-y-1 transition-transform">
                <div className="flex items-center justify-between">
                  <span className="font-display text-4xl font-bold text-gradient">{s.n}</span>
                  <div className="h-12 w-12 rounded-2xl gradient-primary grid place-items-center shadow-soft">
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <h3 className="mt-5 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                  <div className="h-10 w-10 rounded-full glass-strong grid place-items-center shadow-soft">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const reasons = [
  { icon: Brain, title: "AI-powered recommendations" },
  { icon: Heart, title: "Beginner-friendly" },
  { icon: ShieldCheck, title: "Trusted pet guidance" },
  { icon: MapPin, title: "Nearby vet support" },
  { icon: Utensils, title: "Personalized nutrition" },
  { icon: Clock, title: "Available anytime" },
];

function WhyChoose() {
  return (
    <section id="about" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary-glow tracking-wider uppercase">Why ZuZo AI</p>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold">
            Built for the pets you <span className="text-gradient">love most</span>
          </h2>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((r) => (
            <div key={r.title} className="flex items-center gap-4 glass rounded-2xl p-5 hover:-translate-y-0.5 transition-transform shadow-soft">
              <div className="h-12 w-12 shrink-0 rounded-2xl gradient-primary grid place-items-center">
                <r.icon className="h-5 w-5 text-white" />
              </div>
              <p className="font-semibold text-foreground">{r.title}</p>
              <Check className="ml-auto h-5 w-5 text-primary shrink-0" strokeWidth={3} />
            </div>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { k: "50K+", v: "Happy Pets" },
            { k: "10K+", v: "Vet Partners" },
            { k: "1M+", v: "AI Answers" },
            { k: "4.9★", v: "App Rating" },
          ].map((s) => (
            <div key={s.v} className="glass rounded-2xl p-5">
              <p className="font-display text-3xl sm:text-4xl font-bold text-gradient">{s.k}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="contact" className="relative py-20 sm:py-28 px-5 sm:px-8">
      <div className="relative mx-auto max-w-6xl rounded-[2rem] gradient-cta overflow-hidden shadow-glow">
        <div aria-hidden className="absolute -top-16 -left-10 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 40%, white 1.2px, transparent 2px)",
            backgroundSize: "80px 80px",
          }}
        />
        <div className="relative px-6 sm:px-14 py-16 sm:py-20 text-center text-white">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur text-xs font-semibold">
            <PawPrint className="h-3.5 w-3.5" /> Trusted by pet parents worldwide
          </div>
          <h2 className="mt-5 font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight max-w-3xl mx-auto">
            Ready to Give Your Pet the Best Care?
          </h2>
          <p className="mt-4 text-white/90 max-w-2xl mx-auto text-lg">
            Join thousands of pet owners using AI to keep their pets healthier, happier, and safer.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth/signup" className="px-7 py-3.5 rounded-full bg-white text-primary-glow font-semibold shadow-soft hover:-translate-y-0.5 transition-all inline-flex items-center gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" className="px-7 py-3.5 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white font-semibold hover:bg-white/25 transition-all inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const links = ["Home", "Features", "About", "Contact", "Privacy Policy", "Terms"];
  const socials = [Instagram, Facebook, Twitter, Linkedin];
  return (
    <footer className="border-t border-border bg-secondary/30 py-14 px-5 sm:px-8">
      <div className="mx-auto max-w-7xl grid gap-10 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 text-muted-foreground max-w-sm">
            AI-powered pet care for happier, healthier companions. Guidance you can trust, wherever you are.
          </p>
          <div className="mt-5 flex gap-2">
            {socials.map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="social"
                className="h-10 w-10 grid place-items-center rounded-xl glass hover:gradient-primary hover:text-white transition-all"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold text-foreground">Quick Links</h4>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-muted-foreground">
            {links.map((l) => (
              <li key={l}>
                <a href="#" className="hover:text-primary transition-colors">{l}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-foreground">Stay in the loop</h4>
          <p className="mt-4 text-muted-foreground text-sm">Pet care tips and product updates. No spam.</p>
          <form className="mt-4 flex gap-2 glass rounded-full p-1.5">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-2 bg-transparent outline-none text-sm"
            />
            <button className="px-4 py-2 rounded-full gradient-primary text-white text-sm font-semibold">
              Join
            </button>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-7xl mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>© 2026 ZuZo AI. All rights reserved.</p>
        <p className="inline-flex items-center gap-1.5">
          Made with <Heart className="h-3.5 w-3.5 text-primary fill-primary" /> for pets
        </p>
      </div>
    </footer>
  );
}

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <WhyChoose />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
