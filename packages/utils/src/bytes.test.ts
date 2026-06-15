import { describe, expect, it } from "vitest";
import { formatBytes, storageUsagePct, exceedsStorageLimit } from "./bytes";

describe("formatBytes", () => {
  it("formats across units, whole vs fractional", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });
});

describe("storageUsagePct", () => {
  it("is a clamped integer percentage", () => {
    expect(storageUsagePct(0, 1000)).toBe(0);
    expect(storageUsagePct(500, 1000)).toBe(50);
    expect(storageUsagePct(1000, 1000)).toBe(100);
    expect(storageUsagePct(5000, 1000)).toBe(100); // clamp over
    expect(storageUsagePct(100, 0)).toBe(0); // no limit
  });
});

describe("exceedsStorageLimit", () => {
  it("gates an upload against the remaining allowance", () => {
    expect(exceedsStorageLimit(900, 50, 1000)).toBe(false);
    expect(exceedsStorageLimit(900, 100, 1000)).toBe(false); // exactly fits
    expect(exceedsStorageLimit(900, 101, 1000)).toBe(true);
  });
});
