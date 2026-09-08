import { createAllowlistedRssTransport } from "@adeptify/goalboard-integration-rss/host";
import type { SqliteDatabase } from "@adeptify/goalboard-storage";
import {
  createSearchRuntime,
  type SearchRuntime,
} from "@adeptify/search-evidence-layer";
import {
  createPortBackedNodeSearchHost,
  createNodePinnedSearchHost,
  type PortBackedNodeSearchHost,
  type SearchHostContentPort,
  type SearchTransportProfileInput,
} from "@adeptify/search-evidence-layer/host/node";
import { createAnySearchProvider } from "@adeptify/search-evidence-layer/providers/anysearch";
import { createRssProvider } from "@adeptify/search-evidence-layer/providers/rss";

import { createFeedEvidenceContentStore, type FeedEvidenceContentStore } from "@adeptify/goalboard-module-feed";
import { createFileSecretStore, type SecretStore } from "@adeptify/goalboard-storage";
import { createIntelligenceCollectAdapter, type IntelligenceCollectAdapter } from "./feed-intelligence-client.js";
import { listFeedUrls } from "@adeptify/goalboard-integration-rss";
import { isYouTubePublicFeedUrl } from "@adeptify/goalboard-integration-youtube";
import {
  readRssHttpState,
  type RssFetchReceipt,
} from "@adeptify/goalboard-integration-rss";

const APP_ID = "goalboard";
const APP_VERSION = "0.1.14";

type FetchPort = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface FeedSourceRuntime {
  intelligenceCollect: IntelligenceCollectAdapter;
  content: FeedEvidenceContentStore;
  publicFeedReceipt?(): RssFetchReceipt | null;
  shutdown(): Promise<void>;
}

const ANYSEARCH_PROFILE: SearchTransportProfileInput = {
  schema: "search-transport-profile-v1",
  id: "anysearch-mcp-v1",
  providerId: "anysearch",
  protocol: "https",
  origin: "https://api.anysearch.com",
  pathname: "/mcp",
  method: "POST",
  rpcProtocol: "jsonrpc-2.0-tools-call",
  authMode: "optional-bearer",
  redirectPolicy: "reject-all",
  requestByteLimit: 65_536,
  responseByteLimit: 1_048_576,
};

export function createFeedSourceRuntime(options: {
  db: SqliteDatabase;
  fetch?: FetchPort;
  secretStore?: SecretStore;
  content?: FeedEvidenceContentStore;
  sourceCursor?: unknown;
}): FeedSourceRuntime {
  const secretStore = options.secretStore ?? createFileSecretStore();
  const content = options.content ?? createFeedEvidenceContentStore({ secretStore });
  const hostContent = createEncryptedContentPort(content);
  const httpState = readRssHttpState(options.sourceCursor);
  let publicFeedReceipt: RssFetchReceipt | null = null;
  const rssHost = createPortBackedNodeSearchHost({
    appId: APP_ID,
    transport: createAllowlistedRssTransport(
      listFeedUrls(),
      options.fetch ?? globalThis.fetch,
      {
        isPublicChannelFeed: isYouTubePublicFeedUrl,
        userAgent: `GoalBoard/${APP_VERSION} (+local feed ingest)`,
        allowCustomPublicFeeds: true,
        conditional: { etag: httpState.etag, lastModified: httpState.last_modified },
        onReceipt(receipt) { publicFeedReceipt = receipt; },
      },
    ),
    content: hostContent,
  });
  const rssRuntime = createRssRuntime(rssHost);
  const queryHost = createNodePinnedSearchHost({
    appId: APP_ID,
    transportProfiles: [ANYSEARCH_PROFILE],
    content: hostContent,
  });
  const queryRuntime = createAnySearchRuntime(queryHost.host);
  const intelligenceCollect = createIntelligenceCollectAdapter({
    db: options.db,
    secretStore,
    searchRuntime: rssRuntime,
    querySearchRuntime: queryRuntime,
  });
  return {
    intelligenceCollect,
    content,
    publicFeedReceipt() { return publicFeedReceipt; },
    async shutdown() {
      const results = await Promise.allSettled([
        intelligenceCollect.shutdown(),
        rssRuntime.shutdown(),
        queryRuntime.shutdown(),
      ]);
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failure) throw failure.reason;
    },
  };
}

function createRssRuntime(hostBundle: PortBackedNodeSearchHost): SearchRuntime {
  return createSearchRuntime({
    app: { id: APP_ID, version: APP_VERSION, dataCompatibilityVersion: 1 },
    host: hostBundle.host,
    providers: [
      {
        revision: 1,
        provider: createRssProvider({ appId: APP_ID }),
        transportProfileId: "goalboard-rss-allowlist-v1",
      },
    ],
  });
}

function createAnySearchRuntime(
  host: Parameters<typeof createSearchRuntime>[0]["host"],
): SearchRuntime {
  return createSearchRuntime({
    app: { id: APP_ID, version: APP_VERSION, dataCompatibilityVersion: 1 },
    host,
    providers: [
      {
        revision: 1,
        provider: createAnySearchProvider(),
        transportProfileId: ANYSEARCH_PROFILE.id,
      },
    ],
  });
}

function createEncryptedContentPort(store: FeedEvidenceContentStore): SearchHostContentPort {
  return {
    async write({ appId, markdown }) {
      if (appId !== APP_ID || typeof markdown !== "string") {
        throw new Error("feed evidence content rejected");
      }
      return store.write(markdown);
    },
    async read({ appId, contentRef }) {
      if (appId !== APP_ID || !/^goalboard-feed\/sha256\/[0-9a-f]{64}$/u.test(contentRef)) {
        throw new Error("feed evidence content reference rejected");
      }
      return store.read(contentRef);
    },
  };
}
