import { createGmailOAuth } from "@adeptify/goalboard-integration-gmail";
import { createFileSecretStore, peekSealedEntry } from "@adeptify/goalboard-storage";
import { GMAIL_AUTH_REF, bindConnectorToken, resolveGmailToken } from "./connector-credentials.js";

const gmailOAuth = createGmailOAuth({
  secrets: createFileSecretStore,
  hasSecret: (ref) => Boolean(peekSealedEntry(ref)),
  environment: () => process.env,
  legacyAuthRef: GMAIL_AUTH_REF,
  resolveLegacyToken: resolveGmailToken,
  bindLegacyToken: (value) => { bindConnectorToken("gmail", value); },
});

export const {
  defaultGmailRedirectUri, assertLoopbackGmailRedirectUri,
  publicGmailCallbackUri, assertAllowedGmailRedirectUri,
  resolveGmailClientId, resolveGmailClientSecret, storeGmailOAuthClient,
  gmailOAuthConfigured, validatePendingGmailOAuthSession,
  resolveUsableGmailAccessToken, startGmailOAuthFlow,
  completeGmailOAuthFlow, gmailAccessBound,
} = gmailOAuth;
export type { GmailOAuthComplete } from "@adeptify/goalboard-integration-gmail";
