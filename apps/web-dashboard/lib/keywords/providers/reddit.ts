import { cachedToken, missingEnv, ProviderHttpError, requestJson } from "../http";
import type { KeywordProvider, ProviderContext } from "../provider";
import { isQuestion, normalizeKeyword, recordId } from "../text";
import type { KeywordRecord, Metric } from "../types";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const SEARCH_URL = "https://oauth.reddit.com/search";

type RedditPost = {
  data?: {
    id?: string;
    title?: string;
    permalink?: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    subreddit?: string;
  };
};

type RedditListing = {
  data?: {
    children?: RedditPost[];
  };
};

export function parseReddit(body: unknown, fetchedAt: string): KeywordRecord[] {
  const listing = body as RedditListing | undefined;
  const children = listing?.data?.children;
  if (!children || !Array.isArray(children)) return [];

  return children.flatMap((c) => {
    const post = c.data;
    const title = post?.title?.trim();
    if (!post?.id || !title) return [];

    const metrics: Metric[] = [];
    if (typeof post.score === "number") {
      metrics.push({
        key: "reddit_score",
        label: "Post upvotes",
        value: post.score,
        unit: "points",
        kind: "engagement",
        definition: "Net upvotes on this Reddit submission. Community engagement, not search volume.",
      });
    }
    if (typeof post.num_comments === "number") {
      metrics.push({
        key: "reddit_comments",
        label: "Post comments",
        value: post.num_comments,
        unit: "comments",
        kind: "engagement",
        definition: "Total comments on this Reddit thread.",
      });
    }

    const category = isQuestion(title) ? "question" : "related";
    return [
      {
        id: recordId("reddit", category, post.id),
        keyword: title,
        normalized: normalizeKeyword(title),
        category,
        provider: "reddit",
        method: "Submission title from Reddit OAuth Search API",
        dataType: "observed",
        sourceUrl: post.permalink ? `https://reddit.com${post.permalink}` : undefined,
        sourceRecordId: post.id,
        fetchedAt,
        observedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : undefined,
        metrics,
      } satisfies KeywordRecord,
    ];
  });
}

async function getRedditToken(ctx: ProviderContext): Promise<string> {
  return cachedToken(`reddit:${ctx.env.REDDIT_CLIENT_ID}`, ctx.now.getTime(), async () => {
    const basic = Buffer.from(`${ctx.env.REDDIT_CLIENT_ID}:${ctx.env.REDDIT_CLIENT_SECRET}`).toString("base64");
    const r = await requestJson<{ access_token?: string; expires_in?: number }>(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "EcomSeoApp/1.0",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      errorDetail: (t) => (JSON.parse(t) as { message?: string }).message,
    }).catch((err) => {
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        throw new ProviderHttpError(`Reddit client credentials rejected (${err.message})`, "auth", err.status);
      }
      throw err;
    });

    if (!r?.access_token) throw new ProviderHttpError("Reddit token response had no access_token", "parse");
    return { token: r.access_token, expiresInS: r.expires_in ?? 3600 };
  });
}

export const reddit: KeywordProvider = {
  id: "reddit",
  name: "Reddit",
  group: "Social",
  glyph: "R",
  color: "#f97316",
  implemented: true,
  access: "Reddit Data API with Script/Web app client credentials OAuth. Rate limits apply.",
  docsUrl: "https://www.reddit.com/dev/api/",
  provides: ["Discussion titles matching query", "Post upvotes and comment engagement counts"],
  notProvided: ["Reddit search volume", "CPC"],
  supports: { country: false, language: false, window: true },
  defaultEnabled: false,
  configuration({ env }) {
    const missing = missingEnv(env, ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"]);
    return missing.length
      ? { ok: false, state: "NOT_CONFIGURED", reason: `Adapter implemented; credentials missing: ${missing.join(", ")}.` }
      : { ok: true };
  },

  async liveCheck(ctx) {
    const token = await getRedditToken(ctx);
    const r = await requestJson<unknown>(`${SEARCH_URL}?q=ecommerce&limit=1`, {
      headers: { authorization: `Bearer ${token}`, "user-agent": "EcomSeoApp/1.0" },
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
    });
    if (!r || typeof r !== "object") throw new Error("unexpected response from Reddit");
  },

  async search(req, ctx) {
    const token = await getRedditToken(ctx);
    const body = await requestJson<unknown>(`${SEARCH_URL}?q=${encodeURIComponent(req.query)}&limit=25&sort=relevance`, {
      headers: { authorization: `Bearer ${token}`, "user-agent": "EcomSeoApp/1.0" },
      fetchImpl: ctx.fetchImpl,
      signal: ctx.signal,
      retries: 1,
    });
    return {
      records: parseReddit(body, ctx.now.toISOString()),
      message: "Titles and engagement from relevant Reddit discussions.",
    };
  },
};
