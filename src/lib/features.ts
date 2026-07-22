import {
  Stethoscope, Apple, Syringe, Pill, CalendarCheck, Activity,
  FileHeart, MapPin, Footprints, Brain, ScanSearch, PawPrint,
  Siren, Lightbulb, Bot, type LucideIcon,
} from "lucide-react";

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  to?: "/assistant" | "/pets" | "/nutrition" | "/vaccinations";
};

export const features: Feature[] = [
  { title: "Multi-Pet Management", description: "Care for every pet", icon: PawPrint, to: "/pets" },
  { title: "AI Symptom Scanner", description: "Scan symptoms with AI insights", icon: ScanSearch },
  { title: "Diet & Nutrition Planner", description: "Personalized meal plans", icon: Apple, to: "/nutrition" },

  { title: "Vaccination Reminder", description: "Never miss a shot", icon: Syringe, to: "/vaccinations" },
  { title: "Medication Reminder", description: "Track daily medications", icon: Pill },
  { title: "Vet Appointment Scheduler", description: "Book and manage visits", icon: CalendarCheck },
  { title: "Health Dashboard", description: "Vitals at a glance", icon: Activity },
  { title: "Medical Records", description: "All records in one place", icon: FileHeart },
  { title: "Nearby Vets", description: "Find trusted clinics", icon: MapPin },
  { title: "Pet Activity Tracker", description: "Steps, play, and rest", icon: Footprints },
  { title: "Behavior Analysis", description: "Understand mood patterns", icon: Brain },
  { title: "Breed Identification", description: "Identify breed from a photo", icon: PawPrint },
  { title: "Emergency Help", description: "Quick emergency guidance", icon: Siren },
  { title: "Care Tips", description: "Daily tips and advice", icon: Lightbulb },
  { title: "AI Assistant", description: "Chat with ZuZo AI", icon: Bot, to: "/assistant" },
];
