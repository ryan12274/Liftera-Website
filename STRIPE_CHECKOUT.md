# Stripe embedded checkout: preview only

The product page has an on-demand embedded Stripe test checkout for one Drop Chain at USD 35.00. It collects a U.S. shipping address. Shipping fees and tax are deliberately not modeled yet; the UI and Stripe submit text identify this as a demonstration with no real purchase or reservation.

## Connect the account
In Cloudflare Pages project lifterashop, Settings > Variables and Secrets, select Preview:
- STRIPE_SECRET_KEY: the account's Stripe test secret key, encrypted.
- STRIPE_PUBLISHABLE_KEY: the matching test publishable key.

Use keys from the same Stripe sandbox/account. Save them in Cloudflare, not the repository or chat. Redeploy preview after changing variables. No live keys are accepted by the endpoint.

The allowed hosts are preview.lifterashop.pages.dev and the project's eight-character hexadecimal deployment URLs. Production hosts are rejected. No production environment settings need to change.

## Implementation
- POST /api/checkout creates server-priced embedded_page sessions using Stripe API 2026-10-28.endive.
- checkout.js loads Stripe.js endive directly from js.stripe.com only when the visitor asks to test checkout, then mounts createEmbeddedCheckoutPage.
- A signed, host-bound, one-hour HttpOnly cookie identifies the visitor's test session.
- The completion callback and checkout-return page verify paid + complete with Stripe. The API returns no customer details.
- All responses are no-store. Request origins, payload sizes, test keys, and session ownership are checked.
- Session creation uses an idempotency key; open sessions resume using the signed cookie.
- The existing waitlist and VE checkout are separate.

## Validate after configuration
Use Stripe's official test cards and fictitious customer details. Check a successful card, a declined card, and a 3DS challenge; inspect the corresponding test payments in Stripe. Verify return/cancellation status and mobile layout. Never enter real payment information into a test checkout.

## Before real preorders
This test-only integration does not fulfill orders. Confirm price, estimated shipping date, shipping rates, taxes, cancellation/refund terms, final product details, and an order/fulfillment workflow. Add signed webhooks and persistent order records before enabling real orders. Review privacy text for customer/order information. Live mode requires a separate reviewed change; replacing keys alone cannot enable it.

## Checkout branding and draft terms
The embedded session requests background #101010 and primary buttons #48D1CC. Branding settings are per session. The integration marker v2 causes prior test sessions to be replaced when starting a newly branded checkout.
preorder-policy.html contains proposed terms for review only. It is noindex, linked from the preview product page, and does not collect acceptance. Real payment timing, shipping, refund-processing procedures and returns remain to be approved. Draft source: https://www.ftc.gov/legal-library/browse/rules/mail-internet-or-telephone-order-merchandise-rule
