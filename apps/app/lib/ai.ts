import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@invoxai/config";

/**
 * Claude-powered landing-page generation (C9).
 *
 * Claude returns STRUCTURED content (not raw HTML), which the tenant app renders
 * into its own styled markup — so a generated page can never inject arbitrary
 * HTML/scripts onto a seller's site. Uses the default model (Opus 4.8) with
 * adaptive thinking and structured outputs (json_schema) so the response is
 * always valid against the shape below.
 */

export interface LandingPageContent {
  title: string;
  tagline: string;
  sections: { heading: string; body: string }[];
  ctaLabel: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    tagline: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
        },
        required: ["heading", "body"],
        additionalProperties: false,
      },
    },
    ctaLabel: { type: "string" },
  },
  required: ["title", "tagline", "sections", "ctaLabel"],
  additionalProperties: false,
};

/** Whether the Anthropic API key is configured. */
export function aiConfigured(): boolean {
  return Boolean(serverEnv().ANTHROPIC_API_KEY);
}

export type GenerateResult =
  | { ok: true; content: LandingPageContent }
  | { ok: false; error: string };

/**
 * Generate a landing page from the seller's brief. Returns a structured result;
 * the caller charges the wallet ONLY when this returns ok (charge-on-success).
 * Errors are mapped to friendly messages — internals are logged, not surfaced.
 */
export async function generateLandingPage(input: {
  businessName: string;
  brief: string;
}): Promise<GenerateResult> {
  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "AI generation is not configured yet." };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const system =
    "You are a senior landing-page copywriter. Given a business name and a short brief, write concise, compelling landing-page copy: a punchy title, a one-line tagline, 3–5 sections (each a short heading plus a 1–2 sentence body), and a call-to-action button label. Make the copy specific and benefit-led for this exact business. Use plain text only — no HTML, no markdown, no placeholder text.";

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [
        {
          role: "user",
          content: `Business name: ${input.businessName}\n\nBrief: ${input.brief}`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "The AI returned no content. Please try again." };
    }
    const content = JSON.parse(textBlock.text) as LandingPageContent;
    return { ok: true, content };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", e.status, e.message);
      return { ok: false, error: "The AI service is busy. Please try again shortly." };
    }
    console.error("AI generation failed:", e);
    return { ok: false, error: "Couldn’t generate the page. Please try again." };
  }
}
