import "server-only";
import { getSellerGateway } from "@invoxai/db";
import { decryptSecret } from "@invoxai/utils/crypto";

export interface GatewayCredentials {
  keyId: string;
  keySecret: string;
  mode: "TEST" | "LIVE";
}

/**
 * Decrypt the seller's own gateway credentials for server-side use (issuing
 * refunds, Phase 1). The plaintext secret is used only in-process and is never
 * sent to the browser. Returns null if no gateway is connected.
 */
export async function getGatewayCredentials(
  tenantId: string,
): Promise<GatewayCredentials | null> {
  const gw = await getSellerGateway(tenantId);
  if (!gw || gw.status !== "CONNECTED") return null;
  return { keyId: gw.keyId, keySecret: decryptSecret(gw.secretEnc), mode: gw.mode };
}
