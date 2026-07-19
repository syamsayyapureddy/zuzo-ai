import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SPECIES_OPTIONS, GENDER_OPTIONS, VACCINATION_STATUS_OPTIONS,
  type Pet, speciesEmoji,
} from "@/lib/pets";

const petSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  species: z.enum(SPECIES_OPTIONS),
  breed: z.string().trim().max(80).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  age_text: z.string().trim().max(40).optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  weight_kg: z.string().optional().or(z.literal("")),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  microchip_id: z.string().trim().max(60).optional().or(z.literal("")),
  allergies: z.string().max(1000).optional().or(z.literal("")),
  medical_conditions: z.string().max(1000).optional().or(z.literal("")),
  current_medications: z.string().max(1000).optional().or(z.literal("")),
  vaccination_status: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  is_default: z.boolean(),
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  pet: Pet | null;
  onSaved: () => void;
};

const emptyForm = {
  name: "", species: "Dog" as string, breed: "", date_of_birth: "", age_text: "",
  gender: "", weight_kg: "", color: "", microchip_id: "", allergies: "",
  medical_conditions: "", current_medications: "", vaccination_status: "",
  notes: "", is_default: false,
};

export function PetFormDialog({ open, onOpenChange, userId, pet, onSaved }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (pet) {
      setForm({
        name: pet.name,
        species: pet.species,
        breed: pet.breed ?? "",
        date_of_birth: pet.date_of_birth ?? "",
        age_text: pet.age_text ?? "",
        gender: pet.gender ?? "",
        weight_kg: pet.weight_kg?.toString() ?? "",
        color: pet.color ?? "",
        microchip_id: pet.microchip_id ?? "",
        allergies: pet.allergies ?? "",
        medical_conditions: pet.medical_conditions ?? "",
        current_medications: pet.current_medications ?? "",
        vaccination_status: pet.vaccination_status ?? "",
        notes: pet.notes ?? "",
        is_default: pet.is_default,
      });
      setPhotoPath(pet.photo_url);
      loadSignedUrl(pet.photo_url);
    } else {
      setForm(emptyForm);
      setPhotoUrl(null);
      setPhotoPath(null);
    }
  }, [open, pet]);

  async function loadSignedUrl(path: string | null) {
    if (!path) { setPhotoUrl(null); return; }
    const { data } = await supabase.storage.from("pet-photos").createSignedUrl(path, 3600);
    setPhotoUrl(data?.signedUrl ?? null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("pet-photos").upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setPhotoPath(path);
    loadSignedUrl(path);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = petSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const v = parsed.data;
    const payload = {
      user_id: userId,
      name: v.name,
      species: v.species,
      breed: v.breed || null,
      date_of_birth: v.date_of_birth || null,
      age_text: v.age_text || null,
      gender: v.gender || null,
      weight_kg: v.weight_kg ? Number(v.weight_kg) : null,
      color: v.color || null,
      microchip_id: v.microchip_id || null,
      allergies: v.allergies || null,
      medical_conditions: v.medical_conditions || null,
      current_medications: v.current_medications || null,
      vaccination_status: v.vaccination_status || null,
      notes: v.notes || null,
      photo_url: photoPath,
      is_default: v.is_default,
    };
    setSaving(true);
    const { error } = pet
      ? await supabase.from("pets").update(payload).eq("id", pet.id)
      : await supabase.from("pets").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(pet ? "Pet updated" : "Pet added");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {pet ? "Edit Pet" : "Add a Pet"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl glass-strong grid place-items-center text-3xl overflow-hidden">
              {photoUrl ? (
                <img src={photoUrl} alt="Pet" className="h-full w-full object-cover" />
              ) : (
                <span>{speciesEmoji(form.species)}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {photoPath ? "Change photo" : "Upload photo"}
              </Button>
              {photoPath && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPhotoPath(null); setPhotoUrl(null); }}>
                  <X className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} />
            </Field>
            <Field label="Species *">
              <Select value={form.species} onValueChange={(v) => setForm({ ...form, species: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIES_OPTIONS.map((s) => <SelectItem key={s} value={s}>{speciesEmoji(s)} {s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Breed">
              <Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
            </Field>
            <Field label="Date of Birth">
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value, age_text: "" })} />
            </Field>
            <Field label="Age (if DOB unknown)">
              <Input placeholder="e.g. 3 years" value={form.age_text} onChange={(e) => setForm({ ...form, age_text: e.target.value })} disabled={!!form.date_of_birth} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender || undefined} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Weight (kg)">
              <Input type="number" step="0.1" min="0" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
            </Field>
            <Field label="Color">
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </Field>
            <Field label="Microchip ID">
              <Input value={form.microchip_id} onChange={(e) => setForm({ ...form, microchip_id: e.target.value })} />
            </Field>
            <Field label="Vaccination Status">
              <Select value={form.vaccination_status || undefined} onValueChange={(v) => setForm({ ...form, vaccination_status: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{VACCINATION_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Allergies">
            <Textarea rows={2} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          </Field>
          <Field label="Medical Conditions">
            <Textarea rows={2} value={form.medical_conditions} onChange={(e) => setForm({ ...form, medical_conditions: e.target.value })} />
          </Field>
          <Field label="Current Medications">
            <Textarea rows={2} value={form.current_medications} onChange={(e) => setForm({ ...form, current_medications: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <div className="flex items-center justify-between rounded-xl glass-strong px-4 py-3">
            <div>
              <div className="text-sm font-medium">Set as default pet</div>
              <div className="text-xs text-muted-foreground">Used across features by default</div>
            </div>
            <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pet ? "Save changes" : "Add pet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
