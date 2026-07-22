export type Vaccination = {
  id: string;
  user_id: string;
  pet_id: string;
  vaccine_name: string;
  due_date: string;
  administered_date: string | null;
  next_due_date: string | null;
  veterinarian: string | null;
  notes: string | null;
  status: "pending" | "completed";
  created_at: string;
  updated_at: string;
};

export type VaccStatus = "upcoming" | "due_today" | "overdue" | "completed";

function startOfDay(d: Date) { d.setHours(0, 0, 0, 0); return d; }

export function computeStatus(v: Pick<Vaccination, "status" | "due_date">): VaccStatus {
  if (v.status === "completed") return "completed";
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(v.due_date));
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= 30) return "upcoming";
  return "upcoming"; // treat far-future as upcoming too
}

export function isWithin30Days(due_date: string): boolean {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(due_date));
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  return diff >= 0 && diff <= 30;
}

export const STATUS_LABEL: Record<VaccStatus, string> = {
  upcoming: "Upcoming",
  due_today: "Due Today",
  overdue: "Overdue",
  completed: "Completed",
};

export const STATUS_STYLES: Record<VaccStatus, string> = {
  upcoming: "bg-primary/10 text-primary",
  due_today: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  overdue: "bg-destructive/15 text-destructive",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
