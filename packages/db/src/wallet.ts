import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Prepaid wallet data access (C5).
 *
 * The wallet holds ONLY the seller's own money for InvoxAI's fees — never buyer
 * money (hard rule). Credits come from top-up orders (handled idempotently by
 * markPlatformOrderPaid). Debits (InvoxAI fees, from C7/C9) go through
 * `debitWallet`, which is idempotent on `referenceId` and never lets the balance
 * go negative.
 *
 * Tenant isolation: every function takes the `tenantId` the caller derived from
 * the session (or a server-trusted order), never client input.
 */

/** The tenant's wallet, or null if they haven't one yet. Scoped by tenantId. */
export function getWalletByTenant(tenantId: string) {
  return prisma.wallet.findUnique({ where: { tenantId } });
}

/** Balance + outstanding commission for low-balance warnings (Phase 1.5). */
export async function getWalletStatus(
  tenantId: string,
): Promise<{ balancePaise: number; dueCommissionPaise: number }> {
  const [wallet, due] = await Promise.all([
    prisma.wallet.findUnique({
      where: { tenantId },
      select: { balancePaise: true },
    }),
    prisma.commissionCharge.aggregate({
      where: { tenantId, status: "DUE" },
      _sum: { amountPaise: true },
    }),
  ]);
  return {
    balancePaise: wallet?.balancePaise ?? 0,
    dueCommissionPaise: due._sum.amountPaise ?? 0,
  };
}

/** Ensure a wallet row exists for the tenant (idempotent), returning it. */
export function ensureWallet(tenantId: string) {
  return prisma.wallet.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

/** Recent ledger entries for the tenant, newest first. Scoped by tenantId. */
export function listWalletTransactions(tenantId: string, take = 50) {
  return prisma.walletTransaction.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Lock the tenant's wallet row FOR UPDATE inside an already-open transaction, so
 * a balance read-modify-write can't lose a concurrent debit/credit. The row stays
 * locked until the surrounding transaction commits, serialising every other
 * writer on it (Postgres row lock). Returns the locked wallet, or null if the
 * tenant has no wallet row yet. MUST be called inside a `$transaction` (FOR
 * UPDATE outside a transaction locks nothing). Postgres-only.
 *
 * Use this before ANY read-then-write balance mutation (compute `balanceAfter`
 * in JS, then write the literal). Atomic relative writes (`{ increment }` /
 * `{ decrement }`) take their own row lock and don't need it; a read-then-write
 * does — otherwise two concurrent fees on the same wallet both read the same
 * starting balance and one write is silently lost.
 */
export async function lockWalletForUpdate(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<{ id: string; balancePaise: number } | null> {
  const rows = await tx.$queryRaw<{ id: string; balance_paise: number }[]>`
    SELECT id, balance_paise FROM wallets WHERE tenant_id = ${tenantId}::uuid FOR UPDATE
  `;
  const w = rows[0];
  return w ? { id: w.id, balancePaise: Number(w.balance_paise) } : null;
}

export type DebitResult =
  | { ok: true; alreadyApplied: boolean; balancePaise: number }
  | { ok: false; reason: "insufficient_funds" | "no_wallet" };

/**
 * Debit the wallet for an InvoxAI fee (C7/C9 will call this).
 *
 * IDEMPOTENT: pass a stable `referenceId` (the fee event id). If a transaction
 * with that reference already exists, this no-ops and reports the current
 * balance — so a retried charge never double-debits. The balance check + write
 * run in one transaction, and the unique `referenceId` constraint is the final
 * guard against a concurrent double-charge.
 */
export async function debitWallet(input: {
  tenantId: string;
  amountPaise: number;
  reason: string;
  referenceId: string;
  referenceType?: string;
}): Promise<DebitResult> {
  return prisma.$transaction(async (tx) => {
    // Already applied? (idempotency)
    const prior = await tx.walletTransaction.findUnique({
      where: { referenceId: input.referenceId },
      select: { balanceAfter: true },
    });
    if (prior) {
      return { ok: true, alreadyApplied: true, balancePaise: prior.balanceAfter };
    }

    // Lock the row so a concurrent fee on the same wallet can't lose this debit.
    const wallet = await lockWalletForUpdate(tx, input.tenantId);
    if (!wallet) return { ok: false, reason: "no_wallet" };
    if (wallet.balancePaise < input.amountPaise) {
      return { ok: false, reason: "insufficient_funds" };
    }

    const balanceAfter = wallet.balancePaise - input.amountPaise;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePaise: balanceAfter },
    });
    try {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          tenantId: input.tenantId,
          direction: "DEBIT",
          amountPaise: input.amountPaise,
          balanceAfter,
          reason: input.reason,
          referenceType: input.referenceType ?? "fee",
          referenceId: input.referenceId,
        },
      });
    } catch (e) {
      // Lost a concurrent race on the same referenceId — the other tx applied it.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new Error("debit_conflict_retry");
      }
      throw e;
    }
    return { ok: true, alreadyApplied: false, balancePaise: balanceAfter };
  });
}
