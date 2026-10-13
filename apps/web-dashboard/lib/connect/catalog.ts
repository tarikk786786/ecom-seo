/** Platforms whose official API keys can be added from the Connect page. Only these env names are writable. */

export type ConnectField = {
  env: string;
  label: string;
  /** Secrets are never sent back to the browser, not even masked. */
  secret: boolean;
  hint?: string;
  pattern?: RegExp;
};

export type ConnectPlatform = {
  /** Provider id in the keyword registry, used for the live check after saving. */
  provider: string;
  name: string;
  gain: string;
  cost: string;
  loginUrl: string;
  loginLabel: string;
  steps: string[];
  fields: ConnectField[];
};

export const CONNECT_PLATFORMS: ConnectPlatform[] = [
  {
    provider: "etsy",
    name: "Etsy",
    gain: "Real Etsy listing titles for your keyword, with favourites, views and prices.",
    cost: "Free. Etsy reviews new apps, which can take a few days.",
    loginUrl: "https://www.etsy.com/developers/register",
    loginLabel: "Log in to Etsy and create an app",
    steps: [
      "Sign in with your Etsy account and open “Create a new app”.",
      "Name it something like “Ecom SEO research”, describe it as keyword research, and submit.",
      "Open the app under “Your apps” and copy the Keystring and the Shared secret below.",
    ],
    fields: [
      { env: "ETSY_API_KEY", label: "Keystring", secret: false, pattern: /^[a-z0-9]{16,40}$/i, hint: "About 24 letters and numbers." },
      { env: "ETSY_SHARED_SECRET", label: "Shared secret", secret: true, pattern: /^[a-z0-9]{6,40}$/i },
    ],
  },
  {
    provider: "amazon",
    name: "Amazon (Creators API)",
    gain: "Official product titles, prices and ratings from Amazon, instead of only autocomplete.",
    cost: "Free for Amazon Associates. Amazon only issues keys once your affiliate account has qualifying sales.",
    loginUrl: "https://affiliate-program.amazon.in/creatorsapi",
    loginLabel: "Log in to Amazon Associates",
    steps: [
      "Sign in to Amazon Associates (affiliate-program.amazon.in for India).",
      "Go to Tools → Creators API and create credentials.",
      "Copy the Credential ID, the Credential secret and your store/partner tag (it ends in -21 in India).",
    ],
    fields: [
      { env: "AMAZON_CREATORS_CREDENTIAL_ID", label: "Credential ID", secret: false },
      { env: "AMAZON_CREATORS_CREDENTIAL_SECRET", label: "Credential secret", secret: true },
      { env: "AMAZON_PARTNER_TAG", label: "Partner tag", secret: false, pattern: /^[\w-]{3,40}-\d{2}$/, hint: "Looks like yourstore-21." },
    ],
  },
  {
    provider: "flipkart",
    name: "Flipkart (Affiliate API)",
    gain: "Official Flipkart product feed with prices, instead of reading the public search page.",
    cost: "Free with a Flipkart Affiliate account. Flipkart approves API access manually.",
    loginUrl: "https://affiliate.flipkart.com/",
    loginLabel: "Log in to Flipkart Affiliate",
    steps: [
      "Sign in (or sign up) at affiliate.flipkart.com.",
      "Open the API Token page from your dashboard and generate a token.",
      "Copy your Affiliate tracking ID and the token.",
    ],
    fields: [
      { env: "FLIPKART_AFFILIATE_ID", label: "Affiliate tracking ID", secret: false },
      { env: "FLIPKART_AFFILIATE_TOKEN", label: "Affiliate token", secret: true },
    ],
  },
  {
    provider: "ebay",
    name: "eBay (Browse API)",
    gain: "Real eBay listings with prices for your keyword.",
    cost: "Free. 5,000 calls a day by default.",
    loginUrl: "https://developer.ebay.com/my/keys",
    loginLabel: "Log in to eBay Developers",
    steps: [
      "Sign in at developer.ebay.com (create a developer account if asked).",
      "Under Application Keys, create a Production keyset.",
      "Copy the App ID (Client ID) and Cert ID (Client Secret).",
    ],
    fields: [
      { env: "EBAY_CLIENT_ID", label: "App ID (Client ID)", secret: false },
      { env: "EBAY_CLIENT_SECRET", label: "Cert ID (Client Secret)", secret: true },
    ],
  },
  {
    provider: "youtube",
    name: "YouTube Data API",
    gain: "Real video titles with view counts for your keyword.",
    cost: "Free, 10,000 quota units a day (about 100 searches).",
    loginUrl: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    loginLabel: "Log in to Google Cloud",
    steps: [
      "Sign in to Google Cloud and pick or create a project.",
      "Enable “YouTube Data API v3”.",
      "Go to APIs & Services → Credentials → Create credentials → API key, and copy it.",
    ],
    fields: [{ env: "YOUTUBE_API_KEY", label: "API key", secret: true, pattern: /^AIza[\w-]{30,}$/, hint: "Starts with AIza." }],
  },
  {
    provider: "reddit",
    name: "Reddit API",
    gain: "Reddit posts with upvotes and comment counts, without the public feed's rate limits.",
    cost: "Free for personal use. Commercial use needs Reddit's approval.",
    loginUrl: "https://www.reddit.com/prefs/apps",
    loginLabel: "Log in to Reddit apps",
    steps: [
      "Sign in to Reddit and click “create another app…” at the bottom.",
      "Choose “script”, set the redirect URI to http://localhost:3000, and create it.",
      "Copy the ID shown under the app name and the secret.",
    ],
    fields: [
      { env: "REDDIT_CLIENT_ID", label: "Client ID", secret: false },
      { env: "REDDIT_CLIENT_SECRET", label: "Secret", secret: true },
    ],
  },
];

export const CONNECT_ENV_NAMES = new Set(CONNECT_PLATFORMS.flatMap((p) => p.fields.map((f) => f.env)));
