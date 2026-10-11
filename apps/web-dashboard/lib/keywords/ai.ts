import { normalizeKeyword } from "./text";

export type AiIdea = { keyword: string; rationale: string };
export type AiExpansion = { model: string; generatedAt: string; ideas: AiIdea[] };

export function aiConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

export function buildAiPrompt(query: string, observed: string[], country: string, language: string): string {
  return [
    `Seed keyword: "${query}". Target country: ${country}. Language: ${language}.`,
    observed.length ? `Keywords already observed from data providers (do not repeat): ${observed.slice(0, 60).join("; ")}` : "",
    "Suggest up to 20 additional keyword ideas a researcher could validate with a search-volume tool.",
    "Do not state or guess search volumes, CPC, competition or trends.",
    'Respond with JSON only: {"ideas":[{"keyword":"...","rationale":"short reason"}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

/** Parses model output defensively; drops anything that isn't a short keyword string. */
export function parseAiIdeas(content: string, observed: string[]): AiIdea[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  const ideas = (parsed as { ideas?: unknown })?.ideas;
  if (!Array.isArray(ideas)) return [];
  const seen = new Set(observed.map(normalizeKeyword));
  const out: AiIdea[] = [];
  for (const i of ideas) {
    const kw = typeof i?.keyword === "string" ? i.keyword.trim() : "";
    const n = normalizeKeyword(kw);
    if (!n || kw.length > 100 || seen.has(n)) continue;
    seen.add(n);
    out.push({ keyword: kw, rationale: typeof i?.rationale === "string" ? i.rationale.slice(0, 200) : "" });
    if (out.length >= 20) break;
  }
  return out;
}
