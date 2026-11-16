# Physical preorder launch
Prepared on preview. Production and real payments remain closed.

## Confirmed November 16
- $35 USD for one Drop Chain attachment. No belt or plates.
- Lower 48 U.S. states plus Washington, D.C. No Alaska, Hawaii, territories or military addresses.
- Estimated shipment: mid-December 2026. This is not a guaranteed delivery date.
- Full payment at checkout. Cancel before handing the order to the carrier for a full refund, including shipping and tax.
- Unused returns requested within 30 days of delivery; buyer pays return shipping.
- Review the published policy's details for original outbound shipping and defective/incorrect goods before enabling live sales.

## Still required before opening
1. Pack and weigh a sample; obtain actual dimensions and origin ZIP. Current weight estimate is 3–5 lb, packaging unconfirmed. Pick a shipping service and confirm the customer charge. PREORDER_SHIPPING_CENTS must be explicitly set; no default free shipping in live mode.
2. Configure Stripe live account/business details, payouts, sales-tax treatment, support details, and automatic successful-payment/refund receipts. Live checkout requests Stripe automatic tax; configure actual registrations and product tax treatment in Stripe. Do not enable tax collection for registrations you do not hold.
3. Create separate preview and production order databases. Bind each as ORDERS_DB. Apply migrations/0002_preorders.sql to each. No order emails/addresses are copied into D1; Stripe keeps fulfillment details.
4. Register the test and live webhook destinations below, using separate matching STRIPE_WEBHOOK_SECRET secrets. Add secret keys directly to Cloudflare, never to chat or GitHub.
5. Verify paid and declined cards, 3DS, lower-48 acceptance, AK/HI/territory/military rejection, correct shipping/tax totals, replayed webhook, storage failure/retry, receipt, and a full refund. A test payment must create exactly one order even if the customer closes the browser.
6. Confirm manufacturing capacity, final included hardware, usage/load guidance, packaging, and the process/person responsible for fulfillment and customer support.
7. Review final preorder and return terms, including no refund of original outbound shipping for change-of-mind returns and LIFTERA covering necessary return shipping for confirmed defective/damaged/incorrect goods.

## Payment architecture
The new endpoint is POST /api/preorder. The old /api/checkout endpoint remains a test-only legacy demonstration and cannot accept live payments.
- Preview hostnames always require matching test keys; production liftera.shop/www.liftera.shop always require matching live keys.
- Create requires the current policy acknowledgement; price, quantity, shipping amount, and terms metadata are server-owned.
- Signed HttpOnly, Secure, SameSite=Lax session cookies expire within 24h and are host-bound.
- Stripe Checkout Elements SDK (ui_mode=elements). Shipping and card fields use secure Stripe Elements. The merchant Pay button validates the shipping address on the server and refreshes the shipping/tax totals before confirming payment. Server-only shipping permissions prevent the browser from replacing the validated address. Unsupported states can be corrected without locking the form.\n- Express wallet buttons are not mounted for this initial launch so they cannot bypass delivery validation. Cards and 3DS use Stripe Elements.
- Stripe is the source of truth. Status checks and signed webhooks retrieve the latest session and expanded line items/payment. D1 records only paid + complete orders.
- Records are idempotent by session; duplicate delivery cannot reset a shipped order or erase refunds. Unexpected shipping/total/line-item cases become needs_review.
- Full refunds and dispute flags are tracked. No automatic shipment or refund is performed.
- No confirmation is based solely on a browser URL. An uncertain result tells the buyer to verify/contact support before trying to pay again.
- Checkout uses stable idempotency parameters; retries after a lost response do not create a second payment.

## Webhook destinations
Preview: https://preview.lifterashop.pages.dev/api/stripe-webhook
Production: https://liftera.shop/api/stripe-webhook
Use snapshot events with API version 2026-10-28.endive:
checkout.session.completed
checkout.session.async_payment_succeeded
charge.refunded
charge.dispute.created
charge.dispute.closed
The handler re-fetches current Stripe objects, verifies raw-body HMAC with a five-minute timestamp tolerance, and returns 503 if recording fails so Stripe retries. The webhook remains active when the sales switch is off.

## Enabling live payments is a separate reviewed release
TERMS.readyForLive remains false in functions/api/preorder.js.
PREORDERS_OPEN must also be the exact string true in Production. Both are required, along with matching live keys, shipping charge, database and webhook secret. The shipping estimate is invalidated after December 20, 2026; update the estimate and review terms before selling beyond that window.
Set readiness only AFTER the checks above pass and the owner asks to publish. Update the policy's closed-sales banner at the same time. Keep preview in test mode. A key replacement alone cannot open sales.
To pause new orders, set PREORDERS_OPEN=false and redeploy production. Existing sessions need to be expired in Stripe as well; stopping creation does not revoke already-open Stripe sessions. Status and webhooks must continue working for existing orders.

## Daily operations
Assign someone to review Stripe successful payments and failed webhook deliveries every day while preorders are open. Turn on seller payment notifications in Stripe.
D1 is a reconciliation ledger, not a packing/shipping system. Use Stripe's collected email and shipping details for each verified paid order, and track shipment/carrier/tracking in the team's private fulfillment workflow.
Never ship rows with amount_refunded>0, disputed=1, fulfillment_status=needs_review or canceled without resolving them first.
For cancellation: locate the Stripe payment by order_ref, confirm unshipped, issue a full refund through Stripe, confirm it to the customer, and mark fulfillment canceled. The site has no public refund endpoint.
Before the promised shipping window ends, ship or contact each affected buyer about any delay, obtain affirmative agreement to wait, or cancel/refund according to the policy. Keep the communications.
Test receipts do not send automatically; verify the live receipt setting separately.

## Production merge caution
Main has later mobile-performance and favicon work that preview does not fully contain. Preserve main's optimized images, fonts, lazy Turnstile, robots.txt and favicons when preparing the final launch merge. Do not overwrite main with the entire preview tree.

References:
https://docs.stripe.com/checkout/fulfillment?ui=full-page
https://docs.stripe.com/receipts
https://docs.stripe.com/events/manage-webhook-endpoints
https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule

## Preview configuration completed November 16
The isolated liftera-commerce-preview D1 database is bound as ORDERS_DB in Preview. Order/event/review schemas were applied. The LIFTERA sandbox event destination sends the five listed test event types to the preview webhook; its signing secret is encrypted in Preview. Production has not been configured or enabled. Actual shipping charge, live Stripe/tax/receipt checks, production storage/webhook, and final terms/product readiness remain launch requirements.

Payment collection uses an explicit same-as-shipping billing choice, with a separate Stripe Billing Address Element if needed. The validated Shipping Address Element is unmounted for confirmation as required by Stripe's server_only permission, then restored after a declined card. Shipping permission is never relaxed. Wallets including Link are disabled in the Payment Element for this card-only initial launch.
