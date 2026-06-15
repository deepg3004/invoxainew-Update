import { describe, expect, it } from "vitest";
import { otoOfferPricePaise } from "./upsells";

// otoOfferPricePaise is the SERVER-TRUSTED price of a one-time offer: the offer
// product's price minus the OTO-only discount, clamped into [₹1, price]. The buyer
// never supplies this amount — it's always recomputed here — so a wrong clamp would
// over/under-charge or let an order go to ₹0 (which Razorpay rejects). These tests
// pin the contract.

const RUPEE = 100; // paise per ₹1 (= MIN_CHARGE_PAISE floor)

describe("otoOfferPricePaise", () => {
  it("returns the full price when there is no discount", () => {
    expect(otoOfferPricePaise(50000, 0)).toBe(50000);
  });

  it("applies a percentage discount in basis points (floored)", () => {
    // ₹500 at 30% off (3000 bps) = ₹350.
    expect(otoOfferPricePaise(50000, 3000)).toBe(35000);
    // ₹999 at 10% off = floor(99900*1000/10000)=9990 off → 89910.
    expect(otoOfferPricePaise(99900, 1000)).toBe(89910);
  });

  it("never charges below the ₹1 gateway minimum, even at 100% off", () => {
    expect(otoOfferPricePaise(50000, 10000)).toBe(RUPEE);
  });

  it("clamps an over-range discount (bps > 10000) to the ₹1 floor", () => {
    expect(otoOfferPricePaise(50000, 99999)).toBe(RUPEE);
  });

  it("ignores a negative discount (treated as 0%)", () => {
    expect(otoOfferPricePaise(50000, -5000)).toBe(50000);
  });

  it("never exceeds the product's own price", () => {
    // A defensive upper clamp: even with weird inputs the OTO can't cost more than list.
    expect(otoOfferPricePaise(20000, 0)).toBeLessThanOrEqual(20000);
  });

  it("floors fractional paise from the bps math (no rounding up)", () => {
    // ₹3.33 (333 paise) at 33% (3300 bps): floor(333*3300/10000)=floor(109.89)=109 off → 224.
    expect(otoOfferPricePaise(333, 3300)).toBe(224);
  });

  it("coerces non-integer inputs down to whole paise", () => {
    expect(otoOfferPricePaise(50000.9, 3000.9)).toBe(35000);
  });
});
