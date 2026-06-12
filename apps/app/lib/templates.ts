import "server-only";
import type { BuilderContent } from "@invoxai/utils/blocks";

/**
 * Starter page templates for the AI builder (Phase 11 slice 3).
 *
 * A template is a hand-authored {title, blocks, theme}. Creating a page from a
 * template runs NO AI generation, so it carries no AI-page fee — it's a free
 * quick-start the seller then edits. Content is plain text + safe block types;
 * it's still re-validated through normalizeToBlocks at creation time.
 */

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  content: BuilderContent;
}

export const TEMPLATES: PageTemplate[] = [
  {
    id: "product-launch",
    name: "Product launch",
    description: "Announce a new product with a hero, benefits and a call to action.",
    content: {
      title: "Introducing your product",
      theme: { preset: "midnight", accent: "#06B6D4" },
      blocks: [
        { type: "heading", text: "The easier way to get it done", level: 1 },
        { type: "text", text: "A short, punchy line about what your product does and who it's for." },
        { type: "button", label: "Get started", href: "/store" },
        { type: "divider" },
        { type: "heading", text: "Why people love it", level: 2 },
        { type: "text", text: "Describe the main benefit. Focus on the outcome your customer gets, not the features." },
        { type: "heading", text: "Built for your workflow", level: 2 },
        { type: "text", text: "Explain how it fits into their day and saves them time or money." },
        { type: "heading", text: "Loved by early users", level: 2 },
        { type: "text", text: "“This changed how we work.” Add a real quote from a happy customer here." },
        { type: "divider" },
        { type: "text", text: "Ready to try it?" },
        { type: "button", label: "Buy now", href: "/store" },
      ],
    },
  },
  {
    id: "coaching-services",
    name: "Coaching & services",
    description: "A warm landing page for coaches, consultants and service providers.",
    content: {
      title: "Work with me",
      theme: { preset: "sand", accent: "#C2682E" },
      blocks: [
        { type: "heading", text: "Helping you reach your goals", level: 1 },
        { type: "text", text: "One line on who you help and the transformation you offer." },
        { type: "button", label: "Book a session", href: "/pay/booking" },
        { type: "divider" },
        { type: "heading", text: "How it works", level: 2 },
        { type: "text", text: "1. Tell me where you are. 2. We build a plan. 3. You make progress with support." },
        { type: "heading", text: "What you'll get", level: 2 },
        { type: "text", text: "List the outcomes a client can expect from working with you." },
        { type: "heading", text: "About me", level: 2 },
        { type: "text", text: "A short, personal intro that builds trust — your background and why you do this." },
        { type: "divider" },
        { type: "button", label: "Start today", href: "/pay/booking" },
      ],
    },
  },
  {
    id: "event-webinar",
    name: "Event / webinar",
    description: "Drive sign-ups for a live event, workshop or webinar.",
    content: {
      title: "Join the event",
      theme: { preset: "aurora", accent: "#A855F7" },
      blocks: [
        { type: "heading", text: "A live workshop you don't want to miss", level: 1 },
        { type: "text", text: "Date, time and a one-line promise of what attendees will walk away with." },
        { type: "button", label: "Save my spot", href: "/store" },
        { type: "divider" },
        { type: "heading", text: "What we'll cover", level: 2 },
        { type: "text", text: "Three to five bullet-style takeaways. Keep each one short and benefit-led." },
        { type: "heading", text: "Who it's for", level: 2 },
        { type: "text", text: "Describe the ideal attendee so the right people sign up." },
        { type: "heading", text: "Your host", level: 2 },
        { type: "text", text: "A short credibility line about who's running the session." },
        { type: "divider" },
        { type: "text", text: "Seats are limited." },
        { type: "button", label: "Register now", href: "/store" },
      ],
    },
  },
];

export function getTemplate(id: string): PageTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
