export const SPECIES_OPTIONS = [
  "Dog",
  "Cat",
  "Bird",
  "Rabbit",
  "Fish",
  "Reptile",
  "Small Mammal",
  "Other",
] as const;

export const GENDER_OPTIONS = ["Male", "Female", "Unknown"] as const;

export const VACCINATION_STATUS_OPTIONS = [
  "Up to date",
  "Partially vaccinated",
  "Not vaccinated",
  "Unknown",
] as const;

export type PetSpecies = (typeof SPECIES_OPTIONS)[number];

export type Pet = {
  id: string;
  user_id: string;
  name: string;
  species: string;
  breed: string | null;
  date_of_birth: string | null;
  age_text: string | null;
  gender: string | null;
  weight_kg: number | null;
  color: string | null;
  microchip_id: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  vaccination_status: string | null;
  notes: string | null;
  photo_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export function speciesEmoji(species: string): string {
  switch (species) {
    case "Dog": return "🐶";
    case "Cat": return "🐱";
    case "Bird": return "🐦";
    case "Rabbit": return "🐰";
    case "Fish": return "🐟";
    case "Reptile": return "🦎";
    case "Small Mammal": return "🐹";
    default: return "🐾";
  }
}

export function petAge(pet: Pick<Pet, "date_of_birth" | "age_text">): string | null {
  if (pet.date_of_birth) {
    const dob = new Date(pet.date_of_birth);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    if (years <= 0 && months <= 0) return "< 1 mo";
    if (years <= 0) return `${months} mo`;
    if (months <= 0) return `${years} yr`;
    return `${years} yr ${months} mo`;
  }
  return pet.age_text || null;
}
