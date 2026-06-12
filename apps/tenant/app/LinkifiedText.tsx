import { Fragment } from "react";

// Renders text with http(s) URLs turned into links. SECURITY: only http/https
// URLs become anchors (so no javascript:/data: hrefs), and all non-URL text is
// rendered as React children (escaped) — safe for untrusted seller notes.
const URL_RE = /(https?:\/\/[^\s]+)/g;
const isUrl = (s: string) => /^https?:\/\//.test(s);

export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        isUrl(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
