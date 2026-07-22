import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Check, Eye, Syringe, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type Pet, speciesEmoji } from "@/lib/pets";
import {
  type Vaccination, type VaccStatus,
  computeStatus, STATUS_LABEL, STATUS_STYLES,
} from "@/lib/vaccinations";

export const Route = createFileRoute("/vaccinations")({
  head: () => ({
    meta: [
      { title: "Vaccinations — ZuZo AI" },
      { name: "description", content: "Track vaccinations and due dates for every pet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VaccinationsPage,
});

type FormState = {
  id?: string;
  pet_id: string;
  vaccine_name: string;
  due_date: string;
  administered_date: string;
  next_due_date: string;
  veterinarian: string;
  notes: string;
  status: "pending" | "completed";
};

const emptyForm = (pet_id = ""): FormState => ({
  pet_id,
  vaccine_name: "",
  due_date: new Date().toISOString().slice(0, 10),
  administered_date: "",
  next_due_date: "",
  veterinarian: "",
  notes: "",
  status: "pending",
});

function VaccinationsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [rows, setRows] = useState<Vaccination[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Vaccination | null>(null);
  const [toDelete, setToDelete] = useState<Vaccination | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [petFilter, setPetFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<VaccStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async (uid: string) => {
    const [{ data: petRows, error: pErr }, { data: vaccs, error: vErr }] = await Promise.all([
      supabase.from("pets").select("*").eq("user_id", uid)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("vaccinations").select("*").eq("user_id", uid).order("due_date", { ascending: true }),
    ]);
    if (pErr) { toast.error(pErr.message); return; }
    if (vErr) { toast.error(vErr.message); return; }
    setPets((petRows ?? []) as Pet[]);
    setRows((vaccs ?? []) as Vaccination[]);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/signin", replace: true }); return; }
      if (!mounted) return;
      setUserId(session.user.id);
      await load(session.user.id);
      if (mounted) setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/signin", replace: true });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate, load]);

  const petsById = useMemo(() => {
    const m = new Map<string, Pet>();
    pets.forEach(p => m.set(p.id, p));
    return m;
  }, [pets]);

  const enriched = useMemo(() => rows.map(r => ({ row: r, status: computeStatus(r), pet: petsById.get(r.pet_id) })), [rows, petsById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ row, status, pet }) => {
      if (petFilter !== "all" && row.pet_id !== petFilter) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (dateFrom && row.due_date < dateFrom) return false;
      if (dateTo && row.due_date > dateTo) return false;
      if (q) {
        const hay = `${row.vaccine_name} ${row.veterinarian ?? ""} ${row.notes ?? ""} ${pet?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, search, petFilter, statusFilter, dateFrom, dateTo]);

  const counts = useMemo(() => {
    const c = { upcoming: 0, due_today: 0, overdue: 0, completed: 0 };
    enriched.forEach(({ status }) => { c[status] += 1; });
    return c;
  }, [enriched]);

  function openAdd() {
    const defaultPet = pets.find(p => p.is_default) ?? pets[0];
    setForm(emptyForm(defaultPet?.id ?? ""));
    setFormOpen(true);
  }

  function openEdit(v: Vaccination) {
    setForm({
      id: v.id,
      pet_id: v.pet_id,
      vaccine_name: v.vaccine_name,
      due_date: v.due_date,
      administered_date: v.administered_date ?? "",
      next_due_date: v.next_due_date ?? "",
      veterinarian: v.veterinarian ?? "",
      notes: v.notes ?? "",
      status: v.status,
    });
    setFormOpen(true);
  }

  async function save() {
    if (!userId) return;
    if (!form.pet_id) { toast.error("Select a pet"); return; }
    if (!form.vaccine_name.trim()) { toast.error("Vaccine name is required"); return; }
    if (!form.due_date) { toast.error("Due date is required"); return; }
    setSaving(true);
    const payload = {
      user_id: userId,
      pet_id: form.pet_id,
      vaccine_name: form.vaccine_name.trim(),
      due_date: form.due_date,
      administered_date: form.administered_date || null,
      next_due_date: form.next_due_date || null,
      veterinarian: form.veterinarian.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    };
    const { error } = form.id
      ? await supabase.from("vaccinations").update(payload).eq("id", form.id)
      : await supabase.from("vaccinations").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Vaccination updated" : "Vaccination added");
    setFormOpen(false);
    load(userId);
  }

  async function markCompleted(v: Vaccination) {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("vaccinations").update({
      status: "completed",
      administered_date: v.administered_date ?? today,
    }).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as completed");
    load(userId);
  }

  async function confirmDelete() {
    if (!toDelete || !userId) return;
    const v = toDelete;
    setToDelete(null);
    const { error } = await supabase.from("vaccinations").delete().eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vaccination deleted");
    load(userId);
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center gradient-hero-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero-bg">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-12">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Vaccinations</h1>
            <p className="text-muted-foreground mt-1">Track shots, due dates, and history for every pet.</p>
          </div>
          <Button onClick={openAdd} className="shadow-glow" disabled={pets.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Add Vaccination
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(["due_today", "overdue", "upcoming", "completed"] as VaccStatus[]).map(k => (
            <button
              key={k}
              onClick={() => setStatusFilter(prev => prev === k ? "all" : k)}
              className={`glass rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-glow ${statusFilter === k ? "ring-2 ring-primary/40" : ""}`}
            >
              <div className="text-xs text-muted-foreground">{STATUS_LABEL[k]}</div>
              <div className="text-2xl font-bold mt-1">{counts[k]}</div>
            </button>
          ))}
        </div>

        {pets.length === 0 ? (
          <div className="glass rounded-3xl p-10 sm:p-16 text-center shadow-glow animate-fade-up">
            <div className="mx-auto h-20 w-20 rounded-3xl gradient-cta grid place-items-center shadow-soft mb-5">
              <Syringe className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold">Add a pet first</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Vaccinations attach to a pet. Add your first pet to start tracking.
            </p>
            <Button asChild size="lg" className="mt-6 shadow-glow">
              <Link to="/pets">Go to My Pets</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="glass rounded-2xl p-4 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search vaccine, vet, notes…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={petFilter} onValueChange={setPetFilter}>
                <SelectTrigger><SelectValue placeholder="All pets" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pets</SelectItem>
                  {pets.map(p => <SelectItem key={p.id} value={p.id}>{speciesEmoji(p.species)} {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VaccStatus | "all")}>
                <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any status</SelectItem>
                  <SelectItem value="due_today">Due Today</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="Due from" />
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="Due to" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <div className="text-muted-foreground">No vaccinations match your filters.</div>
                <Button variant="ghost" className="mt-3" onClick={() => { setSearch(""); setPetFilter("all"); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}>
                  Reset filters
                </Button>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-primary/5 text-left">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Pet</th>
                        <th className="px-4 py-3 font-semibold">Vaccine</th>
                        <th className="px-4 py-3 font-semibold">Due Date</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(({ row, status, pet }) => (
                        <tr key={row.id} className="border-t border-border/40 hover:bg-primary/5">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{pet ? speciesEmoji(pet.species) : "🐾"}</span>
                              <div>
                                <div className="font-medium">{pet?.name ?? "—"}</div>
                                <div className="text-xs text-muted-foreground">{pet ? [pet.species, pet.breed].filter(Boolean).join(" · ") : ""}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.vaccine_name}</div>
                            {row.veterinarian && <div className="text-xs text-muted-foreground">{row.veterinarian}</div>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.due_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
                              {STATUS_LABEL[status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setViewing(row)} title="View"><Eye className="h-4 w-4" /></Button>
                              {status !== "completed" && (
                                <Button variant="ghost" size="icon" onClick={() => markCompleted(row)} title="Mark completed" className="text-emerald-600">
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => setToDelete(row)} title="Delete" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="glass max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Vaccination" : "Add Vaccination"}</DialogTitle>
            <DialogDescription>Track when your pet's next shot is due.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Pet</Label>
              <Select value={form.pet_id} onValueChange={v => setForm(f => ({ ...f, pet_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select pet" /></SelectTrigger>
                <SelectContent>
                  {pets.map(p => <SelectItem key={p.id} value={p.id}>{speciesEmoji(p.species)} {p.name}{p.breed ? ` · ${p.breed}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Vaccine Name</Label>
              <Input value={form.vaccine_name} onChange={e => setForm(f => ({ ...f, vaccine_name: e.target.value }))} placeholder="e.g. Rabies, DHPP" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Administered Date</Label>
                <Input type="date" value={form.administered_date} onChange={e => setForm(f => ({ ...f, administered_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Next Due Date</Label>
                <Input type="date" value={form.next_due_date} onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as "pending" | "completed" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Veterinarian</Label>
              <Input value={form.veterinarian} onChange={e => setForm(f => ({ ...f, veterinarian: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="shadow-glow">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.id ? "Save Changes" : "Add Vaccination"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={v => !v && setViewing(null)}>
        <DialogContent className="glass max-w-md">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.vaccine_name}</DialogTitle>
                <DialogDescription>{petsById.get(viewing.pet_id)?.name ?? "Pet"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <Row label="Status">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[computeStatus(viewing)]}`}>
                    {STATUS_LABEL[computeStatus(viewing)]}
                  </span>
                </Row>
                <Row label="Due Date">{formatDate(viewing.due_date)}</Row>
                {viewing.administered_date && <Row label="Administered">{formatDate(viewing.administered_date)}</Row>}
                {viewing.next_due_date && <Row label="Next Due">{formatDate(viewing.next_due_date)}</Row>}
                {viewing.veterinarian && <Row label="Veterinarian">{viewing.veterinarian}</Row>}
                {viewing.notes && <Row label="Notes"><span className="whitespace-pre-wrap">{viewing.notes}</span></Row>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={v => !v && setToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vaccination?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FloatingAssistantButton />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return d; }
}
