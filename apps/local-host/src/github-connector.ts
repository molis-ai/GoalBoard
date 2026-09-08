import {
  createGithubProvider,
  type GithubFetch,
} from "@adeptify/goalboard-integration-github";

import { connectorFixtureAllowed } from "./connector-execution-mode.js";
import { resolveGithubToken } from "./connector-credentials.js";
import type { IntegrationProviderItem, IntegrationProviderPort } from "@adeptify/goalboard-contracts/platform/plugin";

export function createGithubConnector(opts?: {
  fixture?: IntegrationProviderItem[];
  token?: string;
  allowFixture?: boolean;
  fetchImpl?: GithubFetch;
  now?: () => Date;
}): IntegrationProviderPort {
  return createGithubProvider({
    ...opts,
    allowFixture: opts?.allowFixture ?? connectorFixtureAllowed(),
    resolveToken: resolveGithubToken,
  });
}
