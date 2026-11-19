# Environments and deployment

[All guides](README.md)

## Branches

| Branch | Website | Use |
| --- | --- | --- |
| `main` | [liftera.shop](https://liftera.shop/) | Production |
| `preview` | [preview.lifterashop.pages.dev](https://preview.lifterashop.pages.dev/) | Review and testing |

Cloudflare Pages project: **lifterashop**. Cloudflare's environment settings are managed in its dashboard, not in this repository. The project serves the static files at the repository root and the endpoints under `functions/`. There is no application build step.

Do not replace production settings with preview settings, copy preview subscribers into production, or use live payment keys in Preview.

## Environment bindings

| Name | Type | Purpose |
| --- | --- | --- |
| `WAITLIST_DB` | D1 binding | Private signup records |
| `TURNSTILE_SECRET` | Encrypted secret | Server verification for signup and review forms |
| `ORDERS_DB` | D1 binding | Order ledger, webhook events, and moderated reviews |
| `STRIPE_SECRET_KEY` | Encrypted secret | Server-side Stripe requests |
| `STRIPE_PUBLISHABLE_KEY` | Variable | Stripe's browser integration |
| `STRIPE_WEBHOOK_SECRET` | Encrypted secret | Verification of Stripe webhook signatures |
| `PREORDER_SHIPPING_CENTS` | Variable | Approved shipping charge in cents |
| `PREORDERS_OPEN` | Variable | Explicit live-sales switch, closed until approved |

Preview uses test Stripe keys and isolated D1 databases. Production needs separate live payment configuration and order storage before real sales open. `TERMS.readyForLive` in the preorder endpoint is deliberately false. Changing a key or publishing code must not silently open payments.

See [Stripe](stripe-checkout.md), [preorders](preorders.md), and [waitlist](waitlist.md) for setup details.

## Database schemas

Run migrations only against the intended database:

| File | Target |
| --- | --- |
| [0001_waitlist.sql](../migrations/0001_waitlist.sql) | `WAITLIST_DB` |
| [0002_preorders.sql](../migrations/0002_preorders.sql) | `ORDERS_DB` |
| [0003_product_reviews.sql](../migrations/0003_product_reviews.sql) | `ORDERS_DB` |

The waitlist and commerce databases are separate. Do not apply the entire migrations folder indiscriminately to either database. Do not commit database files, customer exports, or secret values.

## Reviewing a release

1. Start from the current remote branch, not a folder of exported files.
2. Run `npm run check` and `npm test`.
3. Review the diff for unintended asset, policy, payment, or environment changes.
4. Check the Cloudflare **lifterashop** deployment result.
5. Test the changed pages on preview, including a phone-sized screen when layout changes.
6. Update `main` only after the owner requests publication.

Main has mobile-performance and favicon work that preview does not fully contain. Preserve its optimized WebP images, `home.css`, font loading, lazy Turnstile, `robots.txt`, favicons, and VE thank-you page when preparing the eventual release. Do not overwrite main with preview's entire file tree.

## Local development

Checks require Node.js 24 or newer. No dependency installation is needed.

Use the official [Pages local development guide](https://developers.cloudflare.com/pages/functions/local-development/) for Wrangler and local bindings. Local checks do not read Cloudflare credentials or connect to remote databases. The hosted preview remains the place to verify real service integration with test credentials.
