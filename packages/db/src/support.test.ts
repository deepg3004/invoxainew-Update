import { describe, expect, it } from "vitest";
import { canBuyerAccess } from "./support";

// canBuyerAccess is the buyer-side isolation boundary for support threads: a buyer
// must be able to read ONLY their own tickets, on the right tenant. A bug here would
// let one buyer read another's support messages. Pinned here.

const TENANT = "t-1";
const ticket = {
  tenantId: TENANT,
  buyerProfileId: "prof-1",
  buyerEmail: "Buyer@Example.com",
};

describe("canBuyerAccess", () => {
  it("allows the owning buyer by profile id", () => {
    expect(canBuyerAccess(ticket, TENANT, { profileId: "prof-1" })).toBe(true);
  });

  it("allows the owning buyer by email (case-insensitive)", () => {
    expect(canBuyerAccess(ticket, TENANT, { email: "buyer@example.com" })).toBe(true);
    expect(canBuyerAccess(ticket, TENANT, { email: "BUYER@EXAMPLE.COM" })).toBe(true);
  });

  it("denies a different tenant even with a matching identity", () => {
    expect(canBuyerAccess(ticket, "t-2", { profileId: "prof-1" })).toBe(false);
    expect(canBuyerAccess(ticket, "t-2", { email: "buyer@example.com" })).toBe(false);
  });

  it("denies a different buyer", () => {
    expect(canBuyerAccess(ticket, TENANT, { profileId: "prof-2" })).toBe(false);
    expect(canBuyerAccess(ticket, TENANT, { email: "someone@else.com" })).toBe(false);
  });

  it("denies an empty / anonymous identity", () => {
    expect(canBuyerAccess(ticket, TENANT, {})).toBe(false);
    expect(canBuyerAccess(ticket, TENANT, { profileId: null, email: null })).toBe(false);
    expect(canBuyerAccess(ticket, TENANT, { email: "  " })).toBe(false);
  });

  it("does not match a null stored profile id against a null lookup", () => {
    // A guest-opened ticket (no profile id) must not be accessible by a logged-in user
    // whose profile id is absent — only the email path can match it.
    const guestTicket = { tenantId: TENANT, buyerProfileId: null, buyerEmail: "g@x.com" };
    expect(canBuyerAccess(guestTicket, TENANT, { profileId: null })).toBe(false);
    expect(canBuyerAccess(guestTicket, TENANT, { email: "g@x.com" })).toBe(true);
  });
});
