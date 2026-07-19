import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Star, PawPrint } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { PetFormDialog } from "@/components/PetFormDialog";
import { useSignedPhotoUrls } from "@/hooks/use-signed-photo-urls";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type Pet, speciesEmoji, petAge } from "@/lib/pets";

export const Route = createFileRoute("/pets")({
  head: () => ({
    meta: [
      { title: "My Pets — ZuZo AI" },
      { name: "description", content: "Manage your pet profiles in ZuZo AI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PetsPage,
});

function PetsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pet | null>(null);
  const [toDelete, setToDelete] = useState<Pet | null>(null);
  const urls = useSignedPhotoUrls(pets);

  const load = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("pets").select("*").eq("user_id", uid)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setPets((data ?? []) as Pet[]);
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

  async function setDefault(pet: Pet) {
    const { error } = await supabase.from("pets").update({ is_default: true }).eq("id", pet.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${pet.name} is now your default pet`);
    if (userId) load(userId);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const pet = toDelete;
    setToDelete(null);
    const { error } = await supabase.from("pets").delete().eq("id", pet.id);
    if (error) { toast.error(error.message); return; }
    if (pet.photo_url) {
      await supabase.storage.from("pet-photos").remove([pet.photo_url]);
    }
    toast.success(`${pet.name} removed`);
    if (userId) load(userId);
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
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">My Pets</h1>
            <p className="text-muted-foreground mt-1">Manage every pet in one place.</p>
          </div>
          {pets.length > 0 && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="shadow-glow">
              <Plus className="h-4 w-4 mr-2" /> Add Pet
            </Button>
          )}
        </div>

        {pets.length === 0 ? (
          <EmptyState onAdd={() => { setEditing(null); setDialogOpen(true); }} />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                photoUrl={pet.photo_url ? urls[pet.photo_url] : undefined}
                onEdit={() => { setEditing(pet); setDialogOpen(true); }}
                onDelete={() => setToDelete(pet)}
                onSetDefault={() => setDefault(pet)}
              />
            ))}
          </div>
        )}
      </main>

      {userId && (
        <PetFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={userId}
          pet={editing}
          onSaved={() => userId && load(userId)}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their profile and photo. This action cannot be undone.
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass rounded-3xl p-10 sm:p-16 text-center shadow-glow animate-fade-up">
      <div className="mx-auto h-20 w-20 rounded-3xl gradient-cta grid place-items-center shadow-soft mb-5">
        <PawPrint className="h-10 w-10 text-primary-foreground" />
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
        No pets yet
      </h2>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">
        Add your first pet to unlock personalized care, reminders, and AI-powered health insights.
      </p>
      <Button size="lg" onClick={onAdd} className="mt-6 shadow-glow">
        <Plus className="h-5 w-5 mr-2" /> Add Your First Pet
      </Button>
    </div>
  );
}

function PetCard({
  pet, photoUrl, onEdit, onDelete, onSetDefault,
}: {
  pet: Pet; photoUrl?: string;
  onEdit: () => void; onDelete: () => void; onSetDefault: () => void;
}) {
  const age = petAge(pet);
  return (
    <div className="glass rounded-2xl p-5 flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-glow">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-2xl glass-strong grid place-items-center text-3xl overflow-hidden shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt={pet.name} className="h-full w-full object-cover" />
          ) : (
            <span>{speciesEmoji(pet.species)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-lg truncate">{pet.name}</div>
            {pet.is_default && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                <Star className="h-3 w-3 fill-current" /> Default
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}
          </div>
          {(age || pet.gender || pet.weight_kg) && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {[age, pet.gender, pet.weight_kg ? `${pet.weight_kg} kg` : null].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>

      {pet.vaccination_status && (
        <div className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-primary/5 text-primary/90 inline-block w-fit">
          💉 {pet.vaccination_status}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit} className="flex-1">
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
        {!pet.is_default && (
          <Button variant="ghost" size="sm" onClick={onSetDefault} title="Set as default">
            <Star className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
