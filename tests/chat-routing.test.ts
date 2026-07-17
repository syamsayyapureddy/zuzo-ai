/**
 * Router logic tests for /api/chat.
 *
 * Run:  bun run tests/chat-routing.test.ts
 *
 * These tests hit ONLY the deterministic pre-RAG routing helpers
 * (small-talk, emergency, pet-scope). They do not call Supabase or Gemini.
 */
import assert from "node:assert/strict";
import {
  detectSmallTalk,
  isEmergency,
  classifyPetScope,
} from "../src/routes/api/chat";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// --- Small talk: short-circuit BEFORE embeddings / vector search ---
test("Hello -> greeting only", () => {
  assert.equal(detectSmallTalk("Hello"), "greeting");
  assert.equal(detectSmallTalk("hello!"), "greeting");
  assert.equal(detectSmallTalk("Good morning"), "greeting");
});

test("Hi -> greeting only", () => {
  assert.equal(detectSmallTalk("Hi"), "greeting");
  assert.equal(detectSmallTalk("Hiii 👋"), "greeting");
  assert.equal(detectSmallTalk("Hey"), "greeting");
});

test("Thank you -> conversational reply", () => {
  assert.equal(detectSmallTalk("Thanks"), "thanks");
  assert.equal(detectSmallTalk("Thank you!"), "thanks");
  assert.equal(detectSmallTalk("ty"), "thanks");
});

test("Bye -> conversational reply", () => {
  assert.equal(detectSmallTalk("Bye"), "bye");
  assert.equal(detectSmallTalk("Goodbye!"), "bye");
});

// --- Pet questions: MUST fall through small-talk & scope so RAG runs ---
test("Dog vaccination -> RAG (no small-talk, in scope)", () => {
  const q = "Dog vaccination schedule";
  assert.equal(detectSmallTalk(q), null);
  assert.equal(isEmergency(q), false);
  assert.equal(classifyPetScope(q), "IN_SCOPE");
});

test("Cat not eating -> RAG (no small-talk, in scope)", () => {
  const q = "Cat not eating";
  assert.equal(detectSmallTalk(q), null);
  assert.equal(isEmergency(q), false);
  assert.equal(classifyPetScope(q), "IN_SCOPE");
});

// --- Sanity: out-of-domain still blocked ---
test("Programming question -> out of scope", () => {
  assert.equal(detectSmallTalk("How do I write a for loop in Python?"), null);
  assert.equal(classifyPetScope("How do I write a for loop in Python?"), "OUT_OF_SCOPE");
});

// --- Run ---
let passed = 0;
let failed = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(e instanceof Error ? e.message : e);
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
