import { beforeEach, describe, expect, it, vi } from "vitest";

// server.ts is guarded by `import "server-only"`, which throws outside a real
// Next server bundle — stub it so the module loads under vitest's node env.
vi.mock("server-only", () => ({}));

// One shared set of Supabase storage op stubs, mutable per test.
const h = vi.hoisted(() => ({
  ops: {
    upload: vi.fn(async () => ({ error: null })),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://cdn.example/x.png" } })),
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/dl" },
      error: null,
    })),
    remove: vi.fn(async () => ({ error: null })),
    // "already exists" is the normal idempotent path for ensureDownloadsBucket.
    createBucket: vi.fn(async () => ({ error: { message: "Bucket already exists" } })),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: h.ops.upload,
        getPublicUrl: h.ops.getPublicUrl,
        createSignedUrl: h.ops.createSignedUrl,
        remove: h.ops.remove,
      }),
      createBucket: h.ops.createBucket,
    },
  })),
}));

vi.mock("@invoxai/config", () => ({
  serverEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  }),
}));

import {
  createSignedDownloadUrl,
  uploadImageFromForm,
  uploadPrivateFileFromForm,
  uploadPublicImage,
} from "./server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSignedDownloadUrl — tenant ownership guard", () => {
  it("returns null for an empty key without touching storage", async () => {
    expect(await createSignedDownloadUrl("")).toBeNull();
    expect(h.ops.createSignedUrl).not.toHaveBeenCalled();
  });

  it("refuses to sign a key outside the expected tenant's prefix (cross-tenant)", async () => {
    const url = await createSignedDownloadUrl("tenant/attacker/file.zip", 3600, "victim");
    expect(url).toBeNull();
    expect(h.ops.createSignedUrl).not.toHaveBeenCalled();
  });

  it("signs a key that lives under the expected tenant prefix", async () => {
    const url = await createSignedDownloadUrl("tenant/victim/file.zip", 3600, "victim");
    expect(url).toBe("https://signed.example/dl");
    expect(h.ops.createSignedUrl).toHaveBeenCalledWith("tenant/victim/file.zip", 3600);
  });

  it("signs unconditionally when no tenant is expected", async () => {
    const url = await createSignedDownloadUrl("anything/here.bin");
    expect(url).toBe("https://signed.example/dl");
  });

  it("returns null when storage reports an error", async () => {
    h.ops.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "nope" } } as any);
    expect(await createSignedDownloadUrl("tenant/t/file.zip", 3600, "t")).toBeNull();
  });

  it("returns null (never throws) when storage throws", async () => {
    h.ops.createSignedUrl.mockRejectedValueOnce(new Error("network down"));
    await expect(createSignedDownloadUrl("tenant/t/file.zip", 3600, "t")).resolves.toBeNull();
  });
});

describe("uploadImageFromForm — input validation", () => {
  function form(file?: unknown): FormData {
    const fd = new FormData();
    if (file !== undefined) fd.set("file", file as Blob);
    return fd;
  }

  it("rejects when no file is present", async () => {
    expect(await uploadImageFromForm(form(), "p")).toEqual({
      ok: false,
      error: "No file provided.",
    });
  });

  it("rejects a non-image MIME type", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "doc.pdf", { type: "application/pdf" });
    const res = await uploadImageFromForm(form(file), "p");
    expect(res.ok).toBe(false);
    expect(h.ops.upload).not.toHaveBeenCalled();
  });

  it("rejects an empty image file", async () => {
    const file = new File([], "empty.png", { type: "image/png" });
    expect(await uploadImageFromForm(form(file), "p")).toEqual({
      ok: false,
      error: "The file is empty.",
    });
  });

  it("rejects an image larger than 5 MB", async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    expect(await uploadImageFromForm(form(file), "p")).toEqual({
      ok: false,
      error: "Image must be under 5 MB.",
    });
  });

  it("uploads a valid PNG and returns the public url", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "logo.png", { type: "image/png" });
    const res = await uploadImageFromForm(form(file), "tenant/t1/logos");
    expect(res).toEqual({ ok: true, url: "https://cdn.example/x.png" });
    expect(h.ops.upload).toHaveBeenCalledTimes(1);
  });
});

describe("uploadPublicImage — key sanitization", () => {
  it("strips path-traversal characters from the key prefix and lowercases the ext", async () => {
    await uploadPublicImage({
      bytes: new Uint8Array([1, 2, 3]).buffer,
      ext: "PNG!",
      contentType: "image/png",
      keyPrefix: "../../etc",
    });
    const key = (h.ops.upload.mock.calls[0] as any[])[0] as string;
    expect(key).toMatch(/^etc\/[0-9a-f-]+\.png$/);
  });

  it("throws a clear error when storage upload fails", async () => {
    h.ops.upload.mockResolvedValueOnce({ error: { message: "boom" } } as any);
    await expect(
      uploadPublicImage({
        bytes: new Uint8Array([1]).buffer,
        ext: "png",
        contentType: "image/png",
        keyPrefix: "p",
      }),
    ).rejects.toThrow("upload failed: boom");
  });
});

describe("uploadPrivateFileFromForm — validation + safe key", () => {
  function form(file?: unknown): FormData {
    const fd = new FormData();
    if (file !== undefined) fd.set("file", file as Blob);
    return fd;
  }

  it("rejects when no file is present", async () => {
    expect(await uploadPrivateFileFromForm(form(), "tenant/t1")).toEqual({
      ok: false,
      error: "No file provided.",
    });
  });

  it("rejects an empty file", async () => {
    const file = new File([], "x.zip", { type: "application/zip" });
    expect(await uploadPrivateFileFromForm(form(file), "tenant/t1")).toEqual({
      ok: false,
      error: "The file is empty.",
    });
  });

  it("rejects a file larger than 25 MB", async () => {
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "big.zip", {
      type: "application/zip",
    });
    expect(await uploadPrivateFileFromForm(form(file), "tenant/t1")).toEqual({
      ok: false,
      error: "File must be under 25 MB.",
    });
  });

  it("stores a valid file under a randomised key and keeps the original name", async () => {
    const file = new File([new Uint8Array([9, 9, 9])], "Course Notes.PDF", {
      type: "application/pdf",
    });
    const res = await uploadPrivateFileFromForm(form(file), "tenant/t1/downloads");
    expect(res).toEqual(
      expect.objectContaining({ ok: true, name: "Course Notes.PDF" }),
    );
    if (res.ok) expect(res.key).toMatch(/^tenant\/t1\/downloads\/[0-9a-f-]+\.pdf$/);
  });
});
