import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@invoxai/config";
import { normalizeToBlocks, type BuilderContent } from "@invoxai/utils/blocks";

/**
 * Claude-powered page generation (AI builder, Phase 11 slice 1).
 *
 * Claude returns an ordered list of STRUCTURED blocks (not raw HTML), which the
 * tenant app renders into its own styled markup — so a generated page can never
 * inject arbitrary HTML/scripts onto a seller's site. The output is validated +
 * sanitized through normalizeToBlocks before storage. Uses the default model
 * (Opus 4.8) with adaptive thinking and structured outputs (json_schema).
 *
 * The generator emits text-only blocks (heading/text/divider + the Part-2 widgets
 * list/testimonial/callout) — NO image/button, whose URLs it would fabricate; the
 * seller adds links/images in the block editor. Every field is re-validated +
 * capped by normalizeToBlocks before storage.
 */

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["hero", "heading", "text", "divider", "list", "testimonial", "callout"],
          },
          // Present for heading/text; also the callout body. Omitted for divider/list.
          text: { type: "string" },
          // Heading level 1 (hero) → 3. Ignored for non-headings.
          level: { type: "integer", enum: [1, 2, 3] },
          // For `list`: the bullet items.
          items: { type: "array", items: { type: "string" } },
          // For `testimonial`: the quote + who said it.
          quote: { type: "string" },
          author: { type: "string" },
          // For `hero`: the headline, supporting line, and CTA label. The image and
          // CTA link are added by the seller in the editor (the AI never invents URLs).
          heading: { type: "string" },
          subheading: { type: "string" },
          ctaLabel: { type: "string" },
        },
        required: ["type"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "blocks"],
  additionalProperties: false,
};

/** Whether the Anthropic API key is configured. */
export function aiConfigured(): boolean {
  return Boolean(serverEnv().ANTHROPIC_API_KEY);
}

export type GenerateResult =
  | { ok: true; content: BuilderContent }
  | { ok: false; error: string };

/**
 * Generate a landing page from the seller's brief as an ordered block list.
 * Returns a structured result; the caller charges the wallet ONLY when this
 * returns ok (charge-on-success). Errors map to friendly messages — internals
 * are logged, not surfaced.
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
    "You are a senior landing-page copywriter and designer. Given a business name and a short brief, return a `title` and an ordered list of `blocks` that compose a compelling, premium landing page. Use these block types: ONE `hero` block FIRST (its `heading` is the big headline, `subheading` is a one-line value proposition, and `ctaLabel` is a short call-to-action like \"Get started\" — do NOT include any URL or image; the seller adds those); `text` blocks for body copy; `heading` blocks with level 2 for section titles and level 3 for sub-points; `divider` blocks to separate major sections; a `list` block (with an `items` array of 3–6 short strings) for benefits or features; a `testimonial` block (a `quote` plus an `author`) for social proof; and a `callout` block (its `text` field) to highlight a key promise or offer. Aim for ~8–16 blocks: start with the `hero`, then 3–5 sections — include at least one `list` of benefits and, where it fits, one `testimonial` and one `callout` — ending with a closing call-to-action text block. Make the copy specific and benefit-led for this exact business. Plain text only — no HTML, no markdown, no placeholder text; testimonials must be plausible but clearly illustrative.";

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
    // Validate + sanitize the model output into safe blocks before it's stored.
    const content = normalizeToBlocks(JSON.parse(textBlock.text));
    if (content.blocks.length === 0) {
      return { ok: false, error: "The AI returned an empty page. Please try again." };
    }
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
