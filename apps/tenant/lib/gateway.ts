import "server-only";
import { getSellerGateway } from "@invoxai/db";
import { decryptSecret } from "@invoxai/utils/crypto";

export interface GatewayCredentials {
  keyId: string;
  keySecret: string;
  mode: "TEST" | "LIVE";
}

/**
 * Resolve a tenant's connected gateway credentials, decrypting the secret for
 * server-side use (creating buyer orders / verifying signatures). Returns null
 * if the seller hasn't connected a gateway. The decrypted secret is used only
 * in-process and is never sent to the browser.
 */
export async function getGatewayCredentials(
  tenantId: string,
): Promise<GatewayCredentials | null> {
  const gw = await getSellerGateway(tenantId);
  if (!gw || gw.status !== "CONNECTED") return null;
  return {
    keyId: gw.keyId,
    keySecret: decryptSecret(gw.secretEnc),
    mode: gw.mode,
  };
}
