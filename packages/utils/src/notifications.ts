/**
 * Phase 14 (slice 3): the notification EVENT CATALOG — the source of truth for
 * which events exist, their default copy, and the variables their templates may
 * use. Plain data + pure helpers (NOT server-only) so it can be imported by the
 * admin template editor, the seller preferences panel, AND the server send path.
 *
 * An admin-edited NotificationTemplate overrides `defaultSubject`/`defaultBody`
 * for an event; everything else (heading/button/footer chrome) stays in code so
 * the structured receipt can't be broken. A per-tenant NotificationPreference
 * toggles an event on/off (default on).
 */

export type NotifChannel = "email";

export type NotifEvent = {
  key: string;
  label: string;
  description: string;
  /** Who receives it — drives the send target + which URL the button points at. */
  audience: "buyer" | "seller";
  channel: NotifChannel;
  /** Template variables available as {{name}} in subject/body. */
  variables: string[];
  /** Fixed chrome (not template-editable) so the layout stays consistent. */
  heading: string;
  buttonLabel: string;
  footer: string;
  /** Editable copy — overridden by a NotificationTemplate row when present. */
  defaultSubject: string;
  defaultBody: string;
};

export const NOTIFICATION_EVENTS: NotifEvent[] = [
  {
    key: "buyer.receipt",
    label: "Buyer receipt",
    description: "Emailed to the buyer after a successful payment.",
    audience: "buyer",
    channel: "email",
    variables: ["storeName", "item", "amount"],
    heading: "Thanks for your purchase 🎉",
    buttonLabel: "Visit store",
    footer: "You're receiving this because you made a purchase on this store.",
    defaultSubject: "Your purchase from {{storeName}}",
    defaultBody: "Your payment to {{storeName}} was successful.",
  },
  {
    key: "seller.sale",
    label: "Seller sale alert",
    description: "Emailed to you when a buyer completes a purchase.",
    audience: "seller",
    channel: "email",
    variables: ["storeName", "item", "amount"],
    heading: "You made a sale 💸",
    buttonLabel: "View order",
    footer: "Manage email alerts in your InvoxAI dashboard.",
    defaultSubject: "New sale: {{amount}}",
    defaultBody: "A buyer just paid on {{storeName}}.",
  },
  {
    key: "buyer.abandoned",
    label: "Abandoned checkout reminder",
    description:
      "Emailed to a buyer who started checking out but didn't finish, with a link to complete it.",
    audience: "buyer",
    channel: "email",
    variables: ["storeName", "item", "amount"],
    heading: "You left something behind 👀",
    buttonLabel: "Finish checkout",
    footer: "You're receiving this because you started a purchase on this store.",
    defaultSubject: "Complete your order at {{storeName}}",
    defaultBody:
      "You were so close! Your order for {{item}} ({{amount}}) is waiting — finish checking out below.",
  },
];

export function getNotifEvent(key: string): NotifEvent | undefined {
  return NOTIFICATION_EVENTS.find((e) => e.key === key);
}

/** Interpolate {{name}} placeholders. Unknown names render empty. Pure. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k]! : "",
  );
}
