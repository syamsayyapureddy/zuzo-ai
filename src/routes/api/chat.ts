import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ---- Config ---------------------------------------------------------------
const CHAT_MODEL = "google/gemini-2.5-flash"; // via Lovable AI Gateway
const EMBED_MODEL = "gemini-embedding-001"; // MUST match KB ingestion
const EMBED_DIMS = 768;
const MAX_CHUNKS = 5;
const MIN_SIMILARITY = 0.55;
const DEDUP_JACCARD = 0.85;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const LOVABLE_AI_BASE = "https://ai.gateway.lovable.dev/v1";
const GENERIC_ERROR_FALLBACK =
  "Sorry, something went wrong while processing your request. Please try again.";

const NO_KB_MATCH_FALLBACK =
  "I could not find enough information about this in the ZuZo AI Knowledge Base. Please consult a licensed veterinarian for personalised advice regarding your pet.";
const OUT_OF_SCOPE_FALLBACK =
  "This question is outside the ZuZo AI Knowledge Base. ZuZo AI provides educational guidance about pet health, nutrition, grooming, vaccinations, behavior, preventive care and general pet wellness.";
const KB_EMPTY_FALLBACK =
  "The ZuZo AI Knowledge Base does not currently contain any processed documents. Please upload and process pet-care knowledge before asking questions.";
const EDU_DISCLAIMER =
  "This information is for educational purposes only and does not replace professional veterinary care.";

const SYSTEM_PROMPT = `You are ZuZo AI 🐾, an AI-powered Pet Care Assistant.

RULES (non-negotiable):
- Answer PRIMARILY from the supplied KNOWLEDGE BASE CONTEXT.
- Never invent facts or answer from your own general knowledge when the KB is insufficient.
- Never diagnose diseases with certainty. Never prescribe medicines or dosages.
- Always recommend consulting a licensed veterinarian for serious/urgent issues.
- Use calm, supportive, simple language for pet owners.
- If the KB context is insufficient, reply EXACTLY: "${NO_KB_MATCH_FALLBACK}"
- If the question is unrelated to pet care, reply EXACTLY: "${OUT_OF_SCOPE_FALLBACK}"
- End every grounded answer with a blank line then: "${EDU_DISCLAIMER}"`;

// Emergency detection
const EMERGENCY_PATTERNS: RegExp[] = [
  /difficulty breathing|can(?:no|')?t breathe|trouble breathing|not breathing/i,
  /seizure|convulsion/i,
  /collapse|collapsed|unconscious|unresponsive/i,
  /poison|toxic|ingested|ate .*(chocolate|xylitol|grape|raisin|onion|garlic|rat poison|antifreeze)/i,
  /chocolate ingestion|xylitol/i,
  /heatstroke|overheated|heat stroke/i,
  /persistent vomiting|keeps vomiting|vomiting blood/i,
  /bloody (?:diarrhea|diarrhoea|stool)/i,
  /severe bleeding|won'?t stop bleeding|hemorrhage|haemorrhage/i,
  /cannot urinate|can'?t (?:pee|urinate)|blocked bladder/i,
  /severe trauma|hit by (?:a )?(?:car|vehicle)/i,
  /snake bite|snakebite/i,
  /severe allergic reaction|anaphylaxis|swollen (?:face|throat)/i,
  /choking/i,
];

function isEmergency(text: string): boolean {
  return EMERGENCY_PATTERNS.some((r) => r.test(text));
}

// Greeting / small-talk detection (runs before scope + retrieval).
const GREETING_RE =
  /^(hi+|hey+|hello+|yo|hola|howdy|greetings|good\s*(morning|afternoon|evening|night)|gm|ga|ge)([\s!.,?😊👋🙂🐾]*)$/i;
const THANKS_RE = /^(thanks|thank\s*you|ty|thx|thankyou|cheers|much\s*appreciated|appreciate\s*it)([\s!.,?😊🙏🐾]*)$/i;
const BYE_RE = /^(bye+|goodbye|good\s*night|see\s*you|see\s*ya|cya|later|talk\s*soon|take\s*care)([\s!.,?👋🐾]*)$/i;
const HOWAREYOU_RE = /^(how\s*are\s*you|how'?s\s*it\s*going|what'?s\s*up|sup|how\s*are\s*things)([\s!.,?🙂🐾]*)$/i;

type SmallTalk = "greeting" | "thanks" | "bye" | "howareyou" | null;

function detectSmallTalk(text: string): SmallTalk {
  const t = text.trim();
  if (!t || t.length > 60) return null;
  if (GREETING_RE.test(t)) return "greeting";
  if (THANKS_RE.test(t)) return "thanks";
  if (BYE_RE.test(t)) return "bye";
  if (HOWAREYOU_RE.test(t)) return "howareyou";
  return null;
}

function smallTalkReply(kind: Exclude<SmallTalk, null>): string {
  switch (kind) {
    case "greeting":
      return "Hello! 👋 I'm ZuZo AI, your smart pet care assistant. How can I help you care for your pet today?";
    case "thanks":
      return "You're very welcome! 🐾 If you have more questions about your pet's care, I'm right here.";
    case "bye":
      return "Goodbye! 👋 Give your pet a gentle pat from me. Come back any time you need pet-care guidance.";
    case "howareyou":
      return "I'm doing great, thank you! 🙂 Ready to help with your pet's health, nutrition, behavior, or daily care — what's on your mind?";
  }
}


// Hybrid pet-domain classifier.
// Signals are scored; strong out-of-domain hints subtract. Default is UNCERTAIN
// so borderline questions still reach embedding + retrieval instead of being blocked.

// --- Pet signal vocabulary ---
const PET_SPECIES = [
  "pet","pets","animal","animals",
  "dog","dogs","puppy","puppies","canine","canines","doggy","doggo",
  "cat","cats","kitten","kittens","feline","felines","kitty",
  "rabbit","rabbits","bunny","bunnies",
  "hamster","hamsters","guinea pig","guinea pigs","ferret","ferrets","gerbil","gerbils","chinchilla","hedgehog",
  "bird","birds","parrot","parrots","budgie","budgerigar","cockatiel","canary","finch","parakeet","macaw","cockatoo","conure",
  "fish","goldfish","betta","koi","cichlid","guppy","aquarium",
  "reptile","reptiles","lizard","gecko","iguana","bearded dragon","snake","snakes","turtle","turtles","tortoise","tortoises",
  "horse","horses","pony","ponies","equine","foal","mare","stallion","gelding",
  "rat","mice","mouse","rodent","rodents",
];

const PET_BREEDS = [
  // dogs
  "labrador","lab","golden retriever","retriever","german shepherd","alsatian","beagle","bulldog","french bulldog","frenchie",
  "pug","husky","siberian husky","poodle","dachshund","boxer","rottweiler","doberman","shih tzu","shih-tzu","maltese","yorkie","yorkshire terrier",
  "chihuahua","corgi","pomeranian","border collie","collie","dalmatian","great dane","saint bernard","st bernard","bernese","akita","shiba","shiba inu",
  "cocker spaniel","spaniel","mastiff","boxer","pit bull","pitbull","terrier","schnauzer","havanese","bichon","weimaraner","vizsla","malinois","samoyed",
  // cats
  "persian","siamese","maine coon","ragdoll","bengal","sphynx","british shorthair","american shorthair","russian blue","scottish fold","abyssinian","burmese","birman","norwegian forest",
  // rabbits/others
  "holland lop","netherland dwarf","flemish giant","angora","lionhead",
];

const PET_CARE_CONCEPTS = [
  "vaccination","vaccinations","vaccine","vaccines","vaccinate","vaccinated","booster","rabies","distemper","parvo","parvovirus","fvrcp","bordetella","leptospirosis",
  "grooming","groom","groomer","bathing","brushing","shedding","coat","fur","dander","mat","matting","nail trim","nail clip","claw trim",
  "feeding","feed","nutrition","diet","kibble","raw diet","wet food","dry food","puppy food","kitten food","meal plan","treat","treats","chew","chews","supplement","supplements",
  "symptom","symptoms","illness","illnesses","sick","disease","condition","infection","infections",
  "parasite","parasites","flea","fleas","tick","ticks","mite","mites","worm","worms","tapeworm","roundworm","hookworm","heartworm","mange","ringworm","deworm","deworming","dewormer",
  "behaviour","behavior","training","house training","potty training","crate training","clicker","obedience","socialization","socialisation","aggression","anxiety","separation anxiety",
  "exercise","walks","walking","playtime","enrichment",
  "adoption","adopt","rescue","shelter","foster",
  "veterinary","veterinarian","vet","vets","clinic","animal hospital",
  "medication","medicine","dose","dosage","antibiotic","antibiotics","painkiller","nsaid","steroid","dewormer",
  "poisoning","toxic","toxicity","emergency","surgery","spay","spaying","neuter","neutering","castration","recovery","rehabilitation","physiotherapy",
  "dental","dental care","teeth","gum","gums","tartar","plaque","bad breath","halitosis",
  "skin","ear","ears","eye","eyes","paw","paws","claw","claws","whisker","whiskers","tail","nose","snout","muzzle",
  "litter","litter box","litter tray","leash","collar","harness","kennel","crate","cage","hutch","aviary","terrarium","vivarium","tank","microchip","microchipping","id tag",
  "pregnancy","pregnant","gestation","whelping","queening","newborn puppy","newborn puppies","newborn kitten","newborn kittens","weaning","litter of","breed","breeding","breeder",
  "senior pet","senior dog","senior cat","geriatric","arthritis","hip dysplasia",
  "zoonotic","avian","canine","feline","equine",
];

const PET_SYMPTOMS = [
  "vomiting","vomit","throwing up","diarrhoea","diarrhea","loose stool","coughing","cough","sneezing","sneeze","runny nose",
  "limping","lameness","itching","itchy","scratching","scratches","hair loss","bald patch","rash","hot spot",
  "fever","lethargy","weakness","weak","tired","lethargic","seizure","seizures","tremor","tremors","shaking",
  "breathing problem","breathing problems","laboured breathing","labored breathing","panting","wheezing","gagging",
  "appetite loss","loss of appetite","not eating","won't eat","dehydration","dehydrated","excessive thirst","excessive drinking","excessive urination",
  "bleeding","wound","wounds","cut","laceration","swelling","swollen","bruise","abscess","lump","bump","tumor","tumour","cyst",
  "constipation","bloating","bloat","gas","drooling","salivating","bad breath","itchy ears","ear infection","eye discharge","red eyes","cloudy eyes",
];

const PET_VOCAB: Array<{ term: string; weight: number }> = [
  ...PET_SPECIES.map((t) => ({ term: t, weight: 2 })),
  ...PET_BREEDS.map((t) => ({ term: t, weight: 3 })),   // breed name alone is strong
  ...PET_CARE_CONCEPTS.map((t) => ({ term: t, weight: 1 })),
  ...PET_SYMPTOMS.map((t) => ({ term: t, weight: 1 })),
];

// Compile once (word-boundary, case-insensitive). Escape regex metacharacters.
function escRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const PET_VOCAB_RE: Array<{ re: RegExp; weight: number }> = PET_VOCAB.map(
  ({ term, weight }) => ({ re: new RegExp(`\\b${escRe(term)}s?\\b`, "i"), weight }),
);

// Strong out-of-domain hints (only used to override when NO pet signal is present).
const OUT_OF_DOMAIN_PATTERNS: RegExp[] = [
  /\b(movie|film|cinema|netflix|actor|actress|box office|ticket price)s?\b/i,
  /\b(weather|forecast|temperature today|rain today|snow today)\b/i,
  /\b(politic|election|president|prime minister|parliament|senator|congress)s?\b/i,
  /\b(stock|stocks|nasdaq|s&p|crypto|bitcoin|ethereum|forex|mortgage|interest rate)s?\b/i,
  /\b(recipe|recipes|cook|cooking|bake|baking|cuisine|dish|dessert)\b/i,
  /\b(flight|flights|airline|hotel booking|visa application|passport|tourism)\b/i,
  /\b(javascript|typescript|python|java|c\+\+|react|angular|kubernetes|docker|sql query|regex)\b/i,
  /\b(football|soccer|basketball|nba|nfl|cricket|tennis|olympics|world cup)\b/i,
  /\b(capital of|population of|distance from|history of (?!pet|dog|cat))\b/i,
];

type Scope = "IN_SCOPE" | "OUT_OF_SCOPE" | "UNCERTAIN";

function classifyPetScope(text: string): Scope {
  const t = text.toLowerCase();
  let score = 0;
  let hits = 0;
  for (const { re, weight } of PET_VOCAB_RE) {
    if (re.test(t)) { score += weight; hits += 1; }
  }
  // Two independent signals OR one strong signal (species+concept or breed) → in scope.
  if (hits >= 2 || score >= 3) return "IN_SCOPE";
  if (hits >= 1) return "UNCERTAIN"; // single weak hit — let retrieval decide

  // No pet hits at all: only reject when we see a strong non-pet cue.
  if (OUT_OF_DOMAIN_PATTERNS.some((r) => r.test(text))) return "OUT_OF_SCOPE";

  return "UNCERTAIN";
}


// ---- Helpers --------------------------------------------------------------

function extractUserText(msg: UIMessage | undefined): string {
  if (!msg || msg.role !== "user") return "";
  return msg.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

async function embedQuery(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = `${GEMINI_BASE}/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIMS,
      }),
    });
    if (!res.ok) {
      console.error("[rag] embed failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    return json.embedding?.values ?? null;
  } catch (e) {
    console.error("[rag] embed error", e instanceof Error ? e.message : e);
    return null;
  }
}

type Chunk = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
};

function jaccard(a: string, b: string): number {
  const sa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const sb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((w) => sb.has(w) && inter++);
  return inter / (sa.size + sb.size - inter);
}

function dedupe(chunks: Chunk[]): Chunk[] {
  const kept: Chunk[] = [];
  for (const c of chunks) {
    if (kept.some((k) => jaccard(k.chunk_text, c.chunk_text) >= DEDUP_JACCARD)) continue;
    kept.push(c);
  }
  return kept;
}

function buildContextBlock(chunks: Chunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `Source ${i + 1}\nDocument title: ${c.document_title}\nSection: chunk #${c.chunk_index + 1}\nContent:\n${c.chunk_text}`,
    )
    .join("\n\n---\n\n");
}

function staticStreamResponse(
  text: string,
  originalMessages: UIMessage[],
  persist: (finalText: string) => Promise<void>,
) {
  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const id = crypto.randomUUID();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
    onFinish: async () => {
      await persist(text);
    },
  });
  return createUIMessageStreamResponse({ stream });
}

// ---- Route ----------------------------------------------------------------

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Auth
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // 2. Parse + validate
        const body = (await request.json()) as { messages?: UIMessage[]; sessionId?: string };
        const messages = body.messages ?? [];
        const sessionId = body.sessionId;
        if (!sessionId) return new Response("Missing sessionId", { status: 400 });

        const last = messages[messages.length - 1];
        const userQuestion = extractUserText(last).slice(0, 2000);
        if (!userQuestion) return new Response("Empty question", { status: 400 });

        const geminiKey = process.env.Gemini_api;
        if (!geminiKey) return new Response("Server misconfigured", { status: 500 });

        // Persist user message
        await supabase.from("chat_messages").insert({
          user_id: userId,
          session_id: sessionId,
          role: "user",
          content: userQuestion,
        });

        const persistAssistant = async (finalText: string) => {
          const text = finalText.trim();
          if (!text) return;
          await supabase.from("chat_messages").insert({
            user_id: userId,
            session_id: sessionId,
            role: "assistant",
            content: text,
          });
        };

        // 2b. Small-talk short-circuit (before emergency, scope, embeddings, retrieval)
        const smallTalk = detectSmallTalk(userQuestion);
        if (smallTalk) {
          console.log(`[rag] SmallTalk: ${smallTalk}`);
          return staticStreamResponse(smallTalkReply(smallTalk), messages, persistAssistant);
        }

        // 3. Emergency short-circuit (before scope + retrieval)
        if (isEmergency(userQuestion)) {
          console.log("[rag] RAG: Emergency detected");
          const emergencyText = [
            "⚠️ This sounds like a possible emergency.",
            "",
            "Please contact your veterinarian or the nearest emergency animal hospital IMMEDIATELY. Do not attempt home treatment.",
            "",
            "While traveling: keep your pet calm, warm, and still. Bring any suspected toxin container or a sample if poisoning is possible.",
            "",
            EDU_DISCLAIMER,
          ].join("\n");
          return staticStreamResponse(emergencyText, messages, persistAssistant);
        }

        // 3b. Hybrid pet-scope classifier (before embeddings / Gemini)
        const scope = classifyPetScope(userQuestion);
        if (scope === "OUT_OF_SCOPE") {
          console.log("[rag] Scope: OUT_OF_SCOPE");
          return staticStreamResponse(OUT_OF_SCOPE_FALLBACK, messages, persistAssistant);
        }
        if (scope === "IN_SCOPE") {
          console.log("[rag] Scope: IN_SCOPE");
        } else {
          console.log("[rag] Scope: UNCERTAIN -> Continue Retrieval");
        }

        // 3c. Knowledge Base empty check (any ready doc for this user)
        const { count: readyCount, error: readyErr } = await supabase
          .from("knowledge_documents")
          .select("id", { count: "exact", head: true })
          .eq("processing_status", "ready");
        if (readyErr) {
          console.error("[rag] ready-doc count error", readyErr.message);
        }
        if (!readyErr && (readyCount ?? 0) === 0) {
          console.log("[rag] RAG: Knowledge Base empty");
          return staticStreamResponse(KB_EMPTY_FALLBACK, messages, persistAssistant);
        }


        // 4-9. Embed + retrieve + filter + dedupe
        const embedding = await embedQuery(userQuestion, geminiKey);
        let chunks: Chunk[] = [];
        if (embedding && embedding.length === EMBED_DIMS) {
          const { data: matches, error: matchErr } = await supabase.rpc(
            "match_knowledge_chunks" as never,
            {
              query_embedding: `[${embedding.join(",")}]` as unknown as never,
              match_count: MAX_CHUNKS,
              min_similarity: MIN_SIMILARITY,
            } as never,
          );
          if (matchErr) {
            console.error("[rag] match_knowledge_chunks error", matchErr.message);
          } else if (Array.isArray(matches)) {
            chunks = dedupe(matches as unknown as Chunk[]).slice(0, MAX_CHUNKS);
          }
        }

        // No relevant KB context → fixed fallback (no Gemini call)
        if (chunks.length === 0) {
          console.log("[rag] RAG: No relevant chunks");
          return staticStreamResponse(NO_KB_MATCH_FALLBACK, messages, persistAssistant);
        }
        console.log(`[rag] RAG: Retrieved ${chunks.length} chunks`);
        console.log("[rag] RAG: Calling Gemini");

        // 10-12. Build context, call Gemini
        const kbBlock = buildContextBlock(chunks);
        const titles = Array.from(new Set(chunks.map((c) => c.document_title)));
        const sourceLine = `\n\n— Answer based on ZuZo AI Knowledge Base (${chunks.length} source${chunks.length === 1 ? "" : "s"}: ${titles.join(", ")})`;

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          console.error("[rag] LOVABLE_API_KEY missing");
          return staticStreamResponse(GENERIC_ERROR_FALLBACK, messages, persistAssistant);
        }

        const gateway = createOpenAICompatible({
          name: "lovable-ai",
          baseURL: LOVABLE_AI_BASE,
          headers: { "Lovable-API-Key": lovableKey },
        });
        const model = gateway(CHAT_MODEL);

        const augmentedSystem = `${SYSTEM_PROMPT}\n\nKNOWLEDGE BASE CONTEXT (use this to answer):\n\n${kbBlock}`;

        try {
          const result = streamText({
            model,
            system: augmentedSystem,
            messages: convertToModelMessages(messages),
            onError: (err) => {
              const msg = err.error instanceof Error ? err.error.message : String(err.error);
              console.error("[gemini] stream error", msg);
            },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ responseMessage }) => {
              let text = responseMessage.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("")
                .trim();
              if (!text) {
                text = GENERIC_ERROR_FALLBACK;
              } else if (
                text !== NO_KB_MATCH_FALLBACK &&
                text !== OUT_OF_SCOPE_FALLBACK &&
                !text.includes("Answer based on ZuZo AI Knowledge Base")
              ) {
                text = `${text}${sourceLine}`;
              }
              await persistAssistant(text);
            },
          });
        } catch (err) {
          console.error("[gemini] request failed", err instanceof Error ? err.message : err);
          return staticStreamResponse(GENERIC_ERROR_FALLBACK, messages, persistAssistant);
        }
      },
    },
  },
});
