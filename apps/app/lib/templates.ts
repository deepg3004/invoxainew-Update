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
  // ── Premium typed templates (Phase 3) — use the full block + theme system ─────
  {
    id: "ad-landing",
    name: "Ad landing page",
    description: "High-urgency single-offer page for paid traffic — hero, proof, pricing, FAQ.",
    content: {
      title: "Limited-time offer",
      theme: { preset: "aurora-glow", accent: "#7C3AED" },
      blocks: [
        { type: "hero", heading: "The shortcut to [your result]", subheading: "Everything you need to [outcome] — without [the pain]. One simple offer, instant access.", ctaLabel: "Get instant access", ctaHref: "", imageUrl: "" },
        { type: "stats", items: [{ value: "12,400+", label: "Happy customers" }, { value: "4.9★", label: "Average rating" }, { value: "30-day", label: "Money-back" }] },
        { type: "featureGrid", items: [
          { icon: "⚡", title: "Fast results", text: "See progress from day one with a clear, proven path." },
          { icon: "🎯", title: "Made for you", text: "Built for exactly your situation — no fluff, no filler." },
          { icon: "🔒", title: "Risk-free", text: "Love it or get a full refund within 30 days." },
        ] },
        { type: "countdown", until: "2027-12-31T18:30:00.000Z", label: "Offer ends in" },
        { type: "pricingTable", plans: [
          { name: "Today only", price: "₹999", period: "one-time", features: ["Full access", "All bonuses", "30-day guarantee"], ctaLabel: "Buy now", ctaHref: "", highlighted: true },
        ] },
        { type: "testimonial", quote: "I was skeptical, but this paid for itself in a week. Wish I'd found it sooner.", author: "A happy customer" },
        { type: "faq", items: [
          { q: "How do I get access?", a: "Instantly by email the moment you pay." },
          { q: "Is there a refund?", a: "Yes — 30 days, no questions asked." },
        ] },
      ],
    },
  },
  {
    id: "premium-landing",
    name: "Premium landing",
    description: "A modern SaaS/product landing — hero, features, stats, testimonial, pricing.",
    content: {
      title: "Your premium product",
      theme: { preset: "gradient-mesh", accent: "#8B5CF6" },
      blocks: [
        { type: "hero", heading: "Build it beautifully, ship it fast", subheading: "The all-in-one way to [do the thing]. Loved by creators and teams everywhere.", ctaLabel: "Start free", ctaHref: "", imageUrl: "" },
        { type: "logoStrip", logos: [] },
        { type: "featureGrid", items: [
          { icon: "✨", title: "Beautiful by default", text: "Premium design out of the box — no designer needed." },
          { icon: "🚀", title: "Lightning fast", text: "Built for speed so your customers never wait." },
          { icon: "🔌", title: "Works with your stack", text: "Connect the tools you already use in a click." },
        ] },
        { type: "stats", items: [{ value: "99.9%", label: "Uptime" }, { value: "2M+", label: "Requests/day" }, { value: "150+", label: "Countries" }] },
        { type: "imageText", imageUrl: "", heading: "Designed around you", text: "Explain the core workflow and how it removes friction from your customer's day.", ctaLabel: "See how", ctaHref: "", flip: false },
        { type: "testimonial", quote: "We switched and never looked back. It just works, and it looks incredible.", author: "Founder, a happy company" },
        { type: "pricingTable", plans: [
          { name: "Starter", price: "₹0", period: "free", features: ["Core features", "1 project"], ctaLabel: "Start free", ctaHref: "", highlighted: false },
          { name: "Pro", price: "₹999", period: "/month", features: ["Everything in Starter", "Unlimited projects", "Priority support"], ctaLabel: "Go Pro", ctaHref: "", highlighted: true },
        ] },
        { type: "faq", items: [{ q: "Can I cancel anytime?", a: "Yes, anytime — no lock-in." }, { q: "Do you offer support?", a: "Pro plans get priority support." }] },
      ],
    },
  },
  {
    id: "lead-magnet",
    name: "Lead magnet (opt-in)",
    description: "Capture emails with a free resource — promise, benefits, opt-in CTA.",
    content: {
      title: "Get the free guide",
      theme: { preset: "cloud-mint", accent: "#10B981" },
      blocks: [
        { type: "hero", heading: "The free guide to [your topic]", subheading: "Drop your email and get the exact steps we use to [achieve outcome] — delivered instantly.", ctaLabel: "Send me the guide", ctaHref: "", imageUrl: "" },
        { type: "list", items: ["The 5 mistakes everyone makes (and how to skip them)", "A simple framework you can use today", "Real examples you can copy"] },
        { type: "callout", text: "No spam, ever. Unsubscribe in one click." },
        { type: "testimonial", quote: "This free guide was better than most paid courses I've taken.", author: "A grateful reader" },
        { type: "button", label: "Get the free guide", href: "" },
      ],
    },
  },
  {
    id: "webinar-live",
    name: "Webinar / live session",
    description: "Drive registrations for a live class — countdown, agenda, host, urgency.",
    content: {
      title: "Join the live class",
      theme: { preset: "galaxy-deep", accent: "#A855F7" },
      blocks: [
        { type: "hero", heading: "Live masterclass: [your topic]", subheading: "A free 60-minute session where you'll learn exactly how to [outcome]. Replay for registrants.", ctaLabel: "Save my seat", ctaHref: "", imageUrl: "" },
        { type: "countdown", until: "2027-12-31T18:30:00.000Z", label: "Class starts in" },
        { type: "featureGrid", items: [
          { icon: "🎓", title: "What you'll learn", text: "The 3-step system to [result], live and explained simply." },
          { icon: "🎁", title: "Free bonus", text: "Attend live to get a downloadable toolkit worth ₹2,000." },
          { icon: "💬", title: "Live Q&A", text: "Bring your questions — we'll answer them on the call." },
        ] },
        { type: "testimonial", quote: "Easily the most useful free session I've ever attended.", author: "A past attendee" },
        { type: "callout", text: "Seats are limited — register now to lock in your spot." },
        { type: "button", label: "Register free", href: "" },
      ],
    },
  },
  {
    id: "course-sales",
    name: "Course sales page",
    description: "Sell a course — outcomes, curriculum highlights, proof, pricing, FAQ.",
    content: {
      title: "Enroll in the course",
      theme: { preset: "midnight-pro", accent: "#3B82F6" },
      blocks: [
        { type: "hero", heading: "Master [skill] in [timeframe]", subheading: "A step-by-step course that takes you from beginner to confident — at your own pace.", ctaLabel: "Enroll now", ctaHref: "", imageUrl: "" },
        { type: "stats", items: [{ value: "8 hrs", label: "On-demand video" }, { value: "40+", label: "Lessons" }, { value: "∞", label: "Lifetime access" }] },
        { type: "heading", text: "What you'll learn", level: 2 },
        { type: "list", items: ["The fundamentals, explained simply", "Real projects you build as you go", "Pro workflows that save hours", "A certificate on completion"] },
        { type: "testimonial", quote: "Clear, practical, and worth every rupee. I use what I learned every day.", author: "A course graduate" },
        { type: "pricingTable", plans: [
          { name: "Full course", price: "₹2,499", period: "one-time", features: ["All lessons + updates", "Certificate", "Community access"], ctaLabel: "Enroll now", ctaHref: "", highlighted: true },
        ] },
        { type: "faq", items: [{ q: "Do I get lifetime access?", a: "Yes, including all future updates." }, { q: "Is there a certificate?", a: "Yes, awarded when you finish every lesson." }] },
      ],
    },
  },
  {
    id: "ebook-digital",
    name: "E-book / digital product",
    description: "Sell a download — cover gallery, what's inside, proof, buy button.",
    content: {
      title: "Get the e-book",
      theme: { preset: "ivory-editorial", accent: "#9A3B3B" },
      blocks: [
        { type: "hero", heading: "[Your book title]", subheading: "A practical guide to [topic] you can read in an afternoon and use for years.", ctaLabel: "Buy the e-book", ctaHref: "", imageUrl: "" },
        { type: "gallery", images: [] },
        { type: "heading", text: "What's inside", level: 2 },
        { type: "list", items: ["120 pages of actionable advice", "Templates and checklists you can reuse", "Real examples and case studies"] },
        { type: "stats", items: [{ value: "120", label: "Pages" }, { value: "12", label: "Templates" }, { value: "4.8★", label: "Reader rating" }] },
        { type: "testimonial", quote: "Concise, beautifully written, and immediately useful.", author: "A reader" },
        { type: "button", label: "Buy now — instant download", href: "" },
      ],
    },
  },
  {
    id: "coaching-premium",
    name: "Coaching (premium)",
    description: "An elegant 1-on-1 coaching page — story, outcomes, proof, booking CTA.",
    content: {
      title: "Work with me 1-on-1",
      theme: { preset: "sage-studio", accent: "#5B7553" },
      blocks: [
        { type: "hero", heading: "Personal coaching for [your niche]", subheading: "Tailored 1-on-1 support to help you [transformation], with a plan built around your life.", ctaLabel: "Book a call", ctaHref: "", imageUrl: "" },
        { type: "imageText", imageUrl: "", heading: "My approach", text: "Share your philosophy and how you work with clients — what makes your coaching different.", ctaLabel: "", ctaHref: "", flip: false },
        { type: "featureGrid", items: [
          { icon: "🧭", title: "A clear plan", text: "We map exactly where you are and where you want to be." },
          { icon: "🤝", title: "Real accountability", text: "Regular check-ins keep you moving forward." },
          { icon: "🌱", title: "Lasting change", text: "Build habits and skills that stick long after we finish." },
        ] },
        { type: "stats", items: [{ value: "200+", label: "Clients coached" }, { value: "10 yrs", label: "Experience" }, { value: "4.9★", label: "Client rating" }] },
        { type: "testimonial", quote: "The most valuable investment I've made in myself. I finally got unstuck.", author: "A coaching client" },
        { type: "button", label: "Book your first session", href: "" },
      ],
    },
  },
];

export function getTemplate(id: string): PageTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
