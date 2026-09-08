import { createGithubDeviceFlow } from "@adeptify/goalboard-integration-github";
import { createFileSecretStore } from "@adeptify/goalboard-storage";
import { GITHUB_CLIENT_ID_REF, bindConnectorToken } from "./connector-credentials.js";
const deviceFlow = createGithubDeviceFlow({
  clientId() {
    try {
      const stored = createFileSecretStore().get(GITHUB_CLIENT_ID_REF);
      if (stored?.trim()) return stored.trim();
    } catch { /* Preserve environment fallback when the local store is unavailable. */ }
    return process.env.GOALBOARD_GITHUB_CLIENT_ID?.trim() || null;
  },
  storeClientId: (value) => createFileSecretStore().put(GITHUB_CLIENT_ID_REF, value),
  bindToken: (value) => { bindConnectorToken("github", value); },
});
export const { storeGithubClientId, startGithubDeviceFlow, pollGithubDeviceFlow } = deviceFlow;
