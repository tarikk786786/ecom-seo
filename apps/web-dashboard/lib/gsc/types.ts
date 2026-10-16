export type GscConfigState =
  | { ok: true; siteUrl: string }
  | { ok: false; state: "NOT_CONFIGURED" | "ACCESS_REQUIRED"; missing: string[]; reason: string };

export type GscSiteEntry = {
  siteUrl: string;
  permissionLevel?: string;
};

export type GscAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscQueryRequest = {
  startDate: string;
  endDate: string;
  dimensions?: Array<"query" | "page" | "country" | "device" | "date" | "searchAppearance">;
  rowLimit?: number;
  startRow?: number;
  pageFilter?: string;
  queryFilter?: string;
  countryFilter?: string;
  deviceFilter?: "DESKTOP" | "MOBILE" | "TABLET";
};

export type GscQueryResult = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  rows: GscAnalyticsRow[];
  fetchedAt: string;
  dataSource: "google_search_console";
  measurementMethod: "searchanalytics.query";
  note: string;
};

export type GscStatus = {
  configured: boolean;
  state: "CONNECTED" | "NOT_CONFIGURED" | "ACCESS_REQUIRED" | "ERROR" | "DISABLED";
  missing: string[];
  siteUrl: string | null;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
  sites?: GscSiteEntry[];
};
