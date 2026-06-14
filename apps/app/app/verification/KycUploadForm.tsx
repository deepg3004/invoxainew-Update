"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FileUpload } from "@invoxai/ui";
import { uploadKycDocAction } from "../upload-actions";
import { addKycDocumentAction, type KycDocFormState } from "./actions";

const DOC_TYPES = [
  { value: "identity", label: "Identity proof (PAN / Aadhaar / passport)" },
  { value: "business", label: "Business registration / GST certificate" },
  { value: "address", label: "Address proof" },
  { value: "other", label: "Other supporting document" },
];

const selectCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function KycUploadForm() {
  const [state, action, pending] = useActionState<KycDocFormState, FormData>(addKycDocumentAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  // Bump this on success to remount <FileUpload> and clear its picked file.
  const [uploaderKey, setUploaderKey] = useState(0);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setUploaderKey((k) => k + 1);
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Document type</span>
        <select name="docType" defaultValue="identity" className={selectCls}>
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <FileUpload
        key={uploaderKey}
        keyName="storageKey"
        nameName="fileName"
        action={uploadKycDocAction}
        recommend="PDF, PNG or JPG · under 25 MB · private to you and InvoxAI"
      />

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">Document added.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add document"}
      </button>
    </form>
  );
}
