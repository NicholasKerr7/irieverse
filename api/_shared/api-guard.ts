import type { ApiRequest, ApiResponse } from "../../src/types/api";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://irieverse.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type ApiGuardOptions = {
  routeId: string;
  allowedMethods: string[];
  cacheControl: string;
  rateLimitMax: number;
  rateLimitWindowMs?: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function guardApiRequest(req: ApiRequest, res: ApiResponse, options: ApiGuardOptions): boolean {
  const method = (req.method || "GET").toUpperCase();
  const allowedMethods = normalizeMethods(options.allowedMethods);
  setStandardHeaders(req, res, allowedMethods, options.cacheControl);

  if (!isAllowedRequestOrigin(req)) {
    res.status(403).json({ error: "Origin not allowed." });
    return false;
  }

  if (method === "OPTIONS") {
    res.status(204).end();
    return false;
  }

  if (method === "HEAD" && allowedMethods.includes("HEAD")) {
    res.status(200).end();
    return false;
  }

  if (!allowedMethods.includes(method)) {
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }

  if (isRateLimited(req, res, options)) {
    return false;
  }

  return true;
}

export function resetApiGuardStateForTest() {
  rateLimitBuckets.clear();
}

function setStandardHeaders(
  req: ApiRequest,
  res: ApiResponse,
  allowedMethods: string[],
  cacheControl: string
) {
  const origin = getHeader(req, "origin");
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", [...allowedMethods, "OPTIONS"].join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", cacheControl);
}

function normalizeMethods(methods: string[]): string[] {
  return Array.from(new Set(methods.map((method) => method.toUpperCase())));
}

function isAllowedRequestOrigin(req: ApiRequest): boolean {
  const origin = getHeader(req, "origin");
  return !origin || isAllowedOrigin(origin);
}

function isAllowedOrigin(origin: string): boolean {
  if (!isHttpOrigin(origin)) return false;
  return getAllowedOrigins().has(origin.replace(/\/$/, ""));
}

function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value.replace(/\/$/, "");
  } catch {
    return false;
  }
}

function getAllowedOrigins(): Set<string> {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS);
  addOriginList(origins, process.env.IRIEVERSE_ALLOWED_ORIGINS);
  addVercelOrigin(origins, process.env.VERCEL_URL);
  addVercelOrigin(origins, process.env.VERCEL_BRANCH_URL);
  return origins;
}

function addOriginList(origins: Set<string>, value: string | undefined) {
  if (!value) return;
  value
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach((origin) => {
      if (isHttpOrigin(origin)) origins.add(origin);
    });
}

function addVercelOrigin(origins: Set<string>, host: string | undefined) {
  const normalizedHost = host?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!normalizedHost) return;
  origins.add(`https://${normalizedHost}`);
}

function isRateLimited(req: ApiRequest, res: ApiResponse, options: ApiGuardOptions): boolean {
  if (/^(1|true|yes|on)$/i.test(process.env.IRIEVERSE_API_RATE_LIMIT_DISABLED ?? "")) return false;

  const routeKey = routeEnvKey(options.routeId);
  const maxRequests = getPositiveEnvNumber(`IRIEVERSE_API_RATE_LIMIT_${routeKey}`, options.rateLimitMax);
  const windowMs = getPositiveEnvNumber(
    `IRIEVERSE_API_RATE_LIMIT_${routeKey}_WINDOW_SECONDS`,
    getPositiveEnvNumber("IRIEVERSE_API_RATE_LIMIT_WINDOW_SECONDS", (options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS) / 1000)
  ) * 1000;
  const clientId = getClientIdentifier(req);
  const key = `${options.routeId}:${clientId}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    setRateLimitHeaders(res, maxRequests, Math.max(0, maxRequests - 1), now + windowMs);
    return false;
  }

  if (bucket.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    setRateLimitHeaders(res, maxRequests, 0, bucket.resetAt);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: "Too many requests. Try again shortly." });
    return true;
  }

  bucket.count += 1;
  setRateLimitHeaders(res, maxRequests, Math.max(0, maxRequests - bucket.count), bucket.resetAt);
  return false;
}

function setRateLimitHeaders(res: ApiResponse, limit: number, remaining: number, resetAt: number) {
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}

function getClientIdentifier(req: ApiRequest): string {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();
  return (
    firstForwardedIp ||
    getHeader(req, "cf-connecting-ip") ||
    getHeader(req, "x-real-ip") ||
    req.ip ||
    "anonymous"
  );
}

function getHeader(req: ApiRequest, name: string): string | undefined {
  const headers = req.headers ?? {};
  const targetName = name.toLowerCase();
  const value = Object.entries(headers).find(([headerName]) => headerName.toLowerCase() === targetName)?.[1];
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === "string" && firstValue.trim() ? firstValue.trim() : undefined;
}

function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function routeEnvKey(routeId: string): string {
  return routeId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}
