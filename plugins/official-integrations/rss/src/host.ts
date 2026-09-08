import { SearchError } from "@adeptify/search-evidence-layer";
import type { SearchHostTransportPort } from "@adeptify/search-evidence-layer/host/node";
import { isCustomRssFeedUrl, isDisallowedResolvedAddress } from "./custom-rss.js";
import { classifyFeedBody } from "./feed-body.js";
import { extractRssDocumentMetadata, type RssFetchReceipt } from "./http-state.js";
type FetchPort = (input: string | URL, init?: RequestInit) => Promise<Response>;
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 2;

export function createAllowlistedRssTransport(
  feedUrls: readonly string[],
  fetchPort: FetchPort,
  options: {
    isPublicChannelFeed?: (url: string) => boolean;
    userAgent: string;
    allowCustomPublicFeeds?: boolean;
    lookup?: (hostname: string) => Promise<readonly string[]>;
    conditional?: { etag?: string; lastModified?: string };
    onReceipt?: (receipt: RssFetchReceipt) => void;
  },
): SearchHostTransportPort {
  const allowedUrls = new Set(feedUrls.map(normalizeFeedUrl));
  const lookupHost = options.lookup ?? lookupPublicAddresses;
  return {
    async execute(call) {
      if (
        call.binding.providerId !== "rss" ||
        call.request.providerId !== "rss" ||
        call.request.operation !== "ingest"
      ) {
        throw searchPolicyError();
      }
      const feedUrl = readFeedUrl(call.request.body);
      let current = normalizeFeedUrl(feedUrl);
      const staticFeed = allowedUrls.has(current);
      const youtubePublicFeed = options.isPublicChannelFeed?.(current) === true;
      const customPublicFeed =
        options.allowCustomPublicFeeds === true &&
        !staticFeed &&
        !youtubePublicFeed &&
        isCustomRssFeedUrl(current);
      if (!staticFeed && !youtubePublicFeed && !customPublicFeed) {
        throw searchPolicyError();
      }
      const initialHost = new URL(current).hostname.toLowerCase();
      if (customPublicFeed) await assertResolvedHostIsPublic(initialHost, lookupHost);

      for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        const headers: Record<string, string> = {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
          "User-Agent": options.userAgent,
        };
        if (options.conditional?.etag) headers["If-None-Match"] = options.conditional.etag;
        if (options.conditional?.lastModified) headers["If-Modified-Since"] = options.conditional.lastModified;
        const response = await fetchPort(current, {
          method: "GET",
          redirect: "manual",
          signal: call.signal,
          headers,
        });
        if (isRedirect(response.status)) {
          const location = response.headers.get("location");
          if (!location || redirect === MAX_REDIRECTS) return { status: response.status, body: "" };
          const next = normalizeFeedUrl(new URL(location, current).toString());
          const nextHost = new URL(next).hostname.toLowerCase();
          if (staticFeed && nextHost !== initialHost) throw searchPolicyError();
          if (youtubePublicFeed && options.isPublicChannelFeed?.(next) !== true) throw searchPolicyError();
          if (customPublicFeed) {
            if (nextHost !== initialHost || !isCustomRssFeedUrl(next)) throw searchPolicyError();
            await assertResolvedHostIsPublic(nextHost, lookupHost);
          }
          current = next;
          continue;
        }
        if (response.status === 304) {
          options.onReceipt?.({
            status: 304,
            not_modified: true,
            final_url: current,
            ...(response.headers.get("etag") ? { etag: response.headers.get("etag")! } : {}),
            ...(response.headers.get("last-modified") ? { last_modified: response.headers.get("last-modified")! } : {}),
          });
          return {
            status: 200,
            body: { body: "<rss version=\"2.0\"><channel><title>Not modified</title><link>https://example.invalid/</link></channel></rss>" },
          };
        }
        if (!response.ok) return { status: response.status, body: "" };
        const bodyText = await readBoundedResponse(response, MAX_FEED_BYTES);
        const classification = classifyFeedBody(bodyText, response.headers.get("content-type"));
        if (classification.class !== "rss_xml") {
          throw new SearchError({
            code: classification.class === "empty" ? "feed_unavailable" : "feed_parse_failed",
            retryable: false,
            sideEffectState: "none",
            recoveryAction: "none",
            safeContext: { providerId: "rss" },
          });
        }
        options.onReceipt?.({
          status: response.status,
          not_modified: false,
          final_url: current,
          ...(response.headers.get("etag") ? { etag: response.headers.get("etag")! } : {}),
          ...(response.headers.get("last-modified") ? { last_modified: response.headers.get("last-modified")! } : {}),
          ...extractRssDocumentMetadata(bodyText, current),
        });
        return { status: response.status, body: { body: bodyText } };
      }
      return { status: 508, body: "" };
    },
  };
}

function readFeedUrl(body: unknown): string {
  if (body === null || typeof body !== "object" || Array.isArray(body)) throw searchPolicyError();
  const feedUrl = (body as { feedUrl?: unknown }).feedUrl;
  if (typeof feedUrl !== "string") throw searchPolicyError();
  return feedUrl;
}

function normalizeFeedUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw searchPolicyError();
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw searchPolicyError();
  }
  url.hash = "";
  return url.toString();
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function lookupPublicAddresses(hostname: string): Promise<readonly string[]> {
  const dns = await import("node:dns/promises");
  return (await dns.lookup(hostname, { all: true, verbatim: true })).map((record) => record.address);
}

async function assertResolvedHostIsPublic(
  hostname: string,
  lookup: (hostname: string) => Promise<readonly string[]>,
): Promise<void> {
  let addresses: readonly string[];
  try {
    addresses = await lookup(hostname);
  } catch {
    throw feedUnavailableError();
  }
  if (addresses.length === 0 || addresses.some(isDisallowedResolvedAddress)) {
    throw searchPolicyError();
  }
}

async function readBoundedResponse(response: Response, limit: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error("feed response exceeds local ingest limit");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error("feed response exceeds local ingest limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

function searchPolicyError(): SearchError {
  return new SearchError({
    code: "provider_protocol_invalid",
    retryable: false,
    sideEffectState: "none",
    recoveryAction: "none",
  });
}

function feedUnavailableError(): SearchError {
  return new SearchError({
    code: "feed_unavailable",
    retryable: false,
    sideEffectState: "none",
    recoveryAction: "none",
    safeContext: { providerId: "rss" },
  });
}
