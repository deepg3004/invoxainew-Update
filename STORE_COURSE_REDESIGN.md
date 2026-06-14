# Store (Shopify-style) + Course (Udemy-style) — Design & Fetcher Spec / Build Prompt

> **Reality check first.** The GitHub repo `deepg3004/hello` is a **stale earlier prototype**
> (single Next.js 14 app, Supabase-direct, no Prisma, Telegram-VIP focus). **Do not build from it.**
> The current project is this monorepo (`apps/web|app|admin|tenant` + `packages/*`, Prisma/Postgres),
> which already has a deep store + course layer. This spec reuses what exists and lists only the
> genuine new work.

## What already exists (reuse — do NOT rebuild)

**Store** (`packages/db/src/products.ts`, `apps/tenant/app/{store,p,cart}`):
`listPublishedProducts`, `getPublishedProduct(slug)`, `listPublishedProductsByIds`, `getProductSalesCounts`,
`getStoreAnalytics`, `getOrderBumpProduct`, cart (`previewCartCoupon`, `startCartCheckout`, `startCartUpiSession`),
coupons, reviews + ratings (`getProductReviews`, `getProductRatingSummary/Summaries`). Storefront page,
ProductCard, cart view, `/p/[slug]` product+checkout, Razorpay + manual UPI, commission-from-wallet.

**Course** (`packages/db/src/courses.ts`, `apps/tenant/app/{c,account/learn}`):
`getPublishedCourse(slug)`, `listLessons`, `getEnrolment`, `listEnrolledCourses`, `getCourseProgress`,
`toggleLessonProgress`, course reviews + ratings, `getCourseRatingSummary`. Course landing `/c/[slug]`,
learn portal `/account/learn/[slug]` (gated lessons, progress bar, complete toggle, review form).

So ~80% of the data layer is done. The work is **(A) design upgrade** and **(B) a few new fields/fetchers**.

---

## PART 1 — Shopify-style STORE

### Design (apps/tenant)
- **Storefront `/store`**: hero/announcement bar; **collections** rail; responsive product **grid** with image, title, price, compare-at (strike), rating stars, "Bestseller" badge (already have sales counts), quick "Add to cart"; sticky cart pill with count; search + sort (price, newest, best-selling); category/collection filter chips.
- **Product detail `/p/[slug]`**: image **gallery** (thumbnails), title, price + compare-at, rating + review count (jump to reviews), short + long description, **variants** (size/color) if any, quantity stepper, Add-to-cart + Buy-now, trust badges, order-bump, **reviews section** (list + write-review for verified buyers), **related products**.
- **Cart**: slide-over **drawer** (not just a page) with line items, qty edit, coupon field (live `previewCartCoupon`), subtotal, "Checkout" → existing seller-gateway checkout. Keep `/cart` page as fallback.
- **Checkout success**: order summary + receipt + "track order" link (buyer portal).
- Mobile-first, premium dark per the brand tokens.

### Fetchers — existing vs NEW
| Need | Status | Action |
|---|---|---|
| Product list/grid | ✅ `listPublishedProducts` | reuse; add `sort` + `search` + `collectionId` args |
| Product detail | ✅ `getPublishedProduct` | reuse |
| Bestseller / units | ✅ `getProductSalesCounts` | reuse for badges |
| Ratings on cards/detail | ✅ `getProductRatingSummaries` | wire into grid + detail |
| Reviews list + write | ✅ `getProductReviews`, `createProductReview` | wire on detail page |
| Cart + coupon + checkout | ✅ cart actions | reuse; build the drawer UI |
| **Collections/categories** | ❌ NEW | `Collection` model + `productId↔collection`; `listCollections`, `listProductsByCollection` |
| **Variants** (size/color) | ❌ NEW | `ProductVariant` model (name, options, priceDelta, stock); checkout must price the chosen variant server-side |
| **Product search** | ❌ NEW | `searchPublishedProducts(tenantId, q)` (name/description contains, indexed) |
| **Related products** | ❌ NEW (cheap) | `listPublishedProducts` by same collection, exclude current |
| **Product gallery (multi-image)** | ⚠️ check | confirm `Product.images` is an array; if single, add `galleryUrls String[]` |

**New schema (migration):** `Collection`, `ProductVariant`, optional `Product.galleryUrls`. Variants are the
biggest change — checkout (`startCartCheckout`) must use the variant's server-side price/stock.

---

## PART 2 — Udemy-style COURSE

### Design (apps/tenant)
- **Course landing `/c/[slug]`**: big hero (title, subtitle, rating + #ratings + #students, price + compare-at, "Enroll"/"Buy" CTA, preview-video button); **"What you'll learn"** checklist; **curriculum accordion** grouped into **sections/modules** (lesson count + total duration, preview lessons playable free); **instructor** block (seller bio + avatar); **reviews** (rating breakdown bars + list); requirements/description; sticky purchase card on desktop.
- **Learn portal `/account/learn/[slug]`** (Udemy player): **two-pane** — left = collapsible curriculum sidebar (sections → lessons, checkmarks, current highlighted, progress %); right = **video/content player** + lesson title + "Mark complete & next" + tabs (Overview / Q&A-later / Resources/downloads). Top progress bar + "X% complete". Auto-advance to next lesson.
- Certificate on 100% (later).

### Fetchers — existing vs NEW
| Need | Status | Action |
|---|---|---|
| Course landing data | ✅ `getPublishedCourse` | reuse; add fields below |
| Lessons list | ✅ `listLessons` | reuse; group by section |
| Enrolment gate | ✅ `getEnrolment` | reuse |
| Progress + toggle | ✅ `getCourseProgress`, `toggleLessonProgress` | reuse in the player |
| Reviews + rating breakdown | ✅ course reviews + `getCourseRatingSummary` | add a 1–5 star **distribution** count |
| **Sections/modules** | ❌ NEW | `CourseSection` model (title, sortOrder); `Lesson.sectionId`; group curriculum by section |
| **Video lessons** | ⚠️ partial | `Lesson` is text today; add `videoUrl`/provider (YouTube/Vimeo/Mux) + `durationSec` |
| **"What you'll learn" / requirements** | ❌ NEW | `Course.learnPoints String[]`, `Course.requirements String[]`, `subtitle` |
| **Instructor block** | ⚠️ derive | from Tenant/Profile (name, bio, avatar) — add `Tenant.bio`/`avatarUrl` if missing |
| **Student/rating counts on landing** | ✅ stats exist | wire `getCourseEnrolmentStats` + rating summary into the hero |
| **Lesson duration totals** | ❌ NEW | from `Lesson.durationSec` sum per section/course |

**New schema (migration):** `CourseSection`, `Lesson.sectionId/videoUrl/durationSec`,
`Course.subtitle/learnPoints/requirements`, optional `Tenant.bio/avatarUrl`.

---

## PART 3 — The build prompt (paste-ready)

> Build a **Shopify-style store** and **Udemy-style course** experience in the InvoxAI monorepo
> (`apps/tenant` for public/buyer UI, `packages/db` for data, Prisma/Postgres). **Reuse the existing
> fetchers** listed above — do not rebuild products/cart/courses/enrolment/reviews. Add only: store
> **Collections**, **ProductVariants**, product **search/gallery/related**; course **Sections**,
> **video lessons** (`videoUrl`+`durationSec`), **"what you'll learn"/requirements/subtitle**, and
> **instructor** fields. Create all schema changes as **additive Prisma migrations** (`--create-only`,
> applied via `deploy.sh`). Redesign `/store`, `/p/[slug]`, the cart (slide-over drawer), `/c/[slug]`
> (curriculum accordion + what-you'll-learn + instructor + rating breakdown), and the learn player
> (two-pane sidebar + video + progress + auto-advance). Match the premium dark brand tokens; mobile-first.
> Keep checkout on the seller's own gateway with wallet commission. Verify each: `pnpm typecheck`,
> build, and the deploy lockstep (migrate → build → restart).

## Suggested build order (each a commit, reuse-first)
1. **Course Sections + video fields** (migration) → regroup curriculum + landing "what you'll learn" → Udemy landing redesign.
2. **Udemy player** (two-pane sidebar + video + auto-advance) on the existing progress fetchers.
3. **Store Collections + search + gallery** (migration) → Shopify storefront redesign (grid, filters, badges, ratings).
4. **Cart drawer** + product-detail redesign (gallery, reviews, related, quantity).
5. **ProductVariants** (migration) — last, since it touches checkout pricing (money path → review carefully).

> Each migration is additive; apply it in lockstep with the build+restart (per DEPLOY.md) so the
> stale-build mismatch that caused the earlier outages can't recur.
