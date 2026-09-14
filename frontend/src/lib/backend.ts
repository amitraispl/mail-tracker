import { cookies } from "next/headers";
import { API_URL } from "./api";

/** Server Component / Server Action fetch against the backend, forwarding
 *  the incoming request's cookies so the user's session carries over. */
async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const store = await cookies();
  const cookieHeader = store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie: cookieHeader },
    cache: "no-store",
  });
}

export interface PerLinkStats {
  id: string;
  label: string | null;
  originalUrl: string;
  totalClicks: number;
}

export interface CampaignStats {
  sent: number;
  rawOpens: number;
  totalClicks: number;
  uniqueOpens: number;
  uniqueClicks: number;
}

export interface CampaignDetail {
  id: string;
  name: string;
  subject: string | null;
  openToken: string;
  sentCount: number;
  createdAt: string;
  processedHtml: string | null;
  archived: boolean;
  stats: CampaignStats;
  perLink: PerLinkStats[];
}

export interface CampaignListItem {
  id: string;
  name: string;
  subject: string | null;
  openToken: string;
  sentCount: number;
  createdAt: string;
  processedHtml: string | null;
  archived: boolean;
  _count: { opens: number; clicks: number; links: number };
}

export interface LoadCampaignListOptions {
  search?: string;
  archived?: boolean;
}

export async function loadCampaignList(
  options: LoadCampaignListOptions = {},
): Promise<CampaignListItem[]> {
  const params = new URLSearchParams();
  if (options.search) params.set("search", options.search);
  if (options.archived) params.set("archived", "true");
  const query = params.toString();

  const res = await serverFetch(`/api/campaigns${query ? `?${query}` : ""}`);
  if (!res.ok) return [];
  return res.json();
}

export async function loadCampaign(id: string): Promise<CampaignDetail | null> {
  const res = await serverFetch(`/api/campaigns/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export interface CurrentUser {
  id: string;
  email: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const res = await serverFetch("/api/auth/me");
  if (!res.ok) return null;
  return res.json();
}
