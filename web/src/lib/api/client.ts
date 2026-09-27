import { ApiError } from "./errors";

type QueryValue = string | number | boolean | null | undefined;

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

const BACKEND_PREFIX = "/api/backend";
const RACE_RETRY_DELAY_MS = 300;

let pendingSignOut: Promise<void> | null = null;

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
  }
  const search = params.toString();
  return `${BACKEND_PREFIX}${path}${search ? `?${search}` : ""}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function send(url: string, options: RequestOptions): Promise<Response> {
  const hasBody = options.body !== undefined;
  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers: hasBody
        ? { "Content-Type": "application/json", Accept: "application/json" }
        : { Accept: "application/json" },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw ApiError.network();
  }
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export function signOutAndRedirect(reason: "expired" | "signed-out" = "expired"): Promise<void> {
  if (pendingSignOut) return pendingSignOut;
  pendingSignOut = fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
    .catch(() => undefined)
    .then(() => {
      const next = `${window.location.pathname}${window.location.search}`;
      const params = new URLSearchParams({ reason });
      if (reason === "expired" && next !== "/") params.set("next", next);
      window.location.replace(`/login?${params.toString()}`);
    });
  return pendingSignOut;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  let response = await send(url, options);

  if (response.status === 401) {
    await wait(RACE_RETRY_DELAY_MS);
    response = await send(url, options);
  }

  if (response.status === 401) {
    const error = await ApiError.fromResponse(response);
    void signOutAndRedirect("expired");
    throw error;
  }

  if (!response.ok) throw await ApiError.fromResponse(response);

  return parseBody<T>(response);
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
