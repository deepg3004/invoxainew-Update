"use client";

import Script from "next/script";

export interface TrackingIds {
  metaPixelId?: string | null;
  ga4MeasurementId?: string | null;
  googleAdsId?: string | null;
  gtmId?: string | null;
  tiktokPixelId?: string | null;
}

type PixelWindow = {
  fbq?: (...a: unknown[]) => void;
  gtag?: (...a: unknown[]) => void;
  ttq?: { track: (...a: unknown[]) => void };
};
const pixels = (): PixelWindow | null =>
  typeof window === "undefined" ? null : (window as unknown as PixelWindow);

/** Fire a Purchase/conversion event to whatever pixels are loaded on the page. */
export function firePurchase(valuePaise: number, currency = "INR") {
  const w = pixels();
  if (!w) return;
  const value = valuePaise / 100;
  w.fbq?.("track", "Purchase", { value, currency });
  w.gtag?.("event", "purchase", { value, currency });
  w.ttq?.track("CompletePayment", { value, currency });
}

/** Fire a Lead event (form submitted). */
export function fireLead() {
  const w = pixels();
  if (!w) return;
  w.fbq?.("track", "Lead");
  w.gtag?.("event", "generate_lead");
  w.ttq?.track("SubmitForm");
}

/** Fire a ViewContent event (buyer viewed a product/course). */
export function fireViewContent(name: string, valuePaise?: number, currency = "INR") {
  const w = pixels();
  if (!w) return;
  const value = valuePaise != null ? valuePaise / 100 : undefined;
  w.fbq?.("track", "ViewContent", { content_name: name, value, currency });
  w.gtag?.("event", "view_item", {
    value,
    currency,
    items: [{ item_name: name }],
  });
  w.ttq?.track("ViewContent", { content_name: name, value, currency });
}

/** Fire an AddToCart event. */
export function fireAddToCart(name: string, valuePaise?: number, currency = "INR") {
  const w = pixels();
  if (!w) return;
  const value = valuePaise != null ? valuePaise / 100 : undefined;
  w.fbq?.("track", "AddToCart", { content_name: name, value, currency });
  w.gtag?.("event", "add_to_cart", {
    value,
    currency,
    items: [{ item_name: name }],
  });
  w.ttq?.track("AddToCart", { content_name: name, value, currency });
}

/** Fire an InitiateCheckout event (buyer started paying). */
export function fireInitiateCheckout(valuePaise: number, currency = "INR") {
  const w = pixels();
  if (!w) return;
  const value = valuePaise / 100;
  w.fbq?.("track", "InitiateCheckout", { value, currency });
  w.gtag?.("event", "begin_checkout", { value, currency });
  w.ttq?.track("InitiateCheckout", { value, currency });
}

/**
 * Injects the seller's ads/analytics pixels on a public page (Final Plan §21).
 * Meta Pixel + GA4/Google-Ads (gtag) + GTM, each only when configured. Fires
 * PageView on load; Purchase is fired separately by the checkout (firePurchase).
 */
export function TrackingScripts({ ids }: { ids: TrackingIds }) {
  const gaId = ids.ga4MeasurementId || ids.googleAdsId;
  return (
    <>
      {ids.metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');`}
        </Script>
      ) : null}

      {gaId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());${ids.ga4MeasurementId ? `gtag('config','${ids.ga4MeasurementId}');` : ""}${ids.googleAdsId ? `gtag('config','${ids.googleAdsId}');` : ""}`}
          </Script>
        </>
      ) : null}

      {ids.gtmId ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${ids.gtmId}');`}
        </Script>
      ) : null}

      {ids.tiktokPixelId ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${ids.tiktokPixelId}');ttq.page();}(window,document,'ttq');`}
        </Script>
      ) : null}
    </>
  );
}
