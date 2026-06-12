"use client";

import Script from "next/script";

export interface TrackingIds {
  metaPixelId?: string | null;
  ga4MeasurementId?: string | null;
  googleAdsId?: string | null;
  gtmId?: string | null;
}

type PixelWindow = {
  fbq?: (...a: unknown[]) => void;
  gtag?: (...a: unknown[]) => void;
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
}

/** Fire a Lead event (form submitted). */
export function fireLead() {
  const w = pixels();
  if (!w) return;
  w.fbq?.("track", "Lead");
  w.gtag?.("event", "generate_lead");
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
    </>
  );
}
