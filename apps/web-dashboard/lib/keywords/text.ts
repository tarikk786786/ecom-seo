export function normalizeKeyword(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\p{L}\p{M}\p{N}'+#.&\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  return normalizeKeyword(s).split(" ").filter((t) => t.length > 1);
}

const QUESTION_START =
  /^(what|whats|what's|how|why|when|where|which|who|whom|whose|is|are|can|could|should|would|will|do|does|did|was|were|has|have|kya|kaise|kyun|kyon|kab|kahan|kaun|kitna|kitne)\b/i;
const HINDI_QUESTION = /(क्या|कैसे|क्यों|कब|कहाँ|कहां|कौन|कितना|कितने|किसे)(?=$|[\s?।,])/u;

export function isQuestion(s: string): boolean {
  const t = s.trim();
  return t.endsWith("?") || QUESTION_START.test(t) || HINDI_QUESTION.test(t);
}

export const PREPOSITIONS = ["for", "with", "without", "to", "near", "vs", "versus", "under", "in", "on", "like", "by", "from", "of", "at", "about", "between", "after", "before", "over"] as const;

const PREP_RE = new RegExp(`(^|\\s)(${PREPOSITIONS.join("|")})(\\s|$)`, "i");

/** Returns the first preposition found in the keyword (excluding a leading one), if any. */
export function prepositionIn(s: string): string | undefined {
  const m = normalizeKeyword(s)
    .replace(/^(how|what|where|when|why|which) to /, "")
    .match(PREP_RE);
  return m?.[2]?.toLowerCase();
}

export type Intent = "informational" | "commercial" | "transactional" | "navigational";

const TRANSACTIONAL = /\b(buy|order|price|prices|cost|cheap|deal|deals|discount|coupon|sale|shop|purchase|online|delivery|emi|kharid|kharide|sasta|daam|kimat|keemat)\b|खरीद|कीमत|सस्ता/i;
const COMMERCIAL = /\b(best|top|review|reviews|vs|versus|compare|comparison|alternative|alternatives|recommended|rating|ratings|under \d+)\b|सबसे अच्छा/i;
const NAVIGATIONAL = /\b(login|sign in|official|website|app|download|near me|customer care|contact)\b/i;

/** Rule-based estimate. Labelled as such in the UI. */
export function classifyIntent(keyword: string): Intent {
  if (TRANSACTIONAL.test(keyword)) return "transactional";
  if (COMMERCIAL.test(keyword)) return "commercial";
  if (NAVIGATIONAL.test(keyword)) return "navigational";
  return "informational";
}

/** Keeps only keywords that share at least one token with the seed (prevents off-topic provider noise). */
const STOP = new Set(["the", "and", "or", "a", "an", "of", "for", "to", "in", "on", "with", "is", "are", "how", "what", "best", "vs", "my", "your"]);

export function sharesToken(seed: string, candidate: string): boolean {
  const seedTokens = new Set(tokenize(seed).filter((t) => !STOP.has(t)));
  return tokenize(candidate).some((t) => seedTokens.has(t));
}

export function recordId(provider: string, category: string, key: string): string {
  let h = 0x811c9dc5;
  const s = `${provider}|${category}|${key}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${provider}:${(h >>> 0).toString(36)}`;
}
