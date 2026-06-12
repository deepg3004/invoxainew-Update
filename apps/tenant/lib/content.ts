import "server-only";
import { cache } from "react";
import {
  getPublishedAiPage,
  getPublishedProduct,
  getPublishedCourse,
  getActivePaymentPage,
} from "@invoxai/db";

/**
 * React `cache()`-wrapped storefront content lookups. Each detail page resolves
 * its item in BOTH generateMetadata and the page body; with the same
 * (tenantId, slug) per request these share one query instead of two.
 */
export const cachedAiPage = cache(getPublishedAiPage);
export const cachedProduct = cache(getPublishedProduct);
export const cachedCourse = cache(getPublishedCourse);
export const cachedPaymentPage = cache(getActivePaymentPage);
