# Stripe checkout

[All guides](README.md) · [Preorder launch guide](preorders.md)

This is the existing preview implementation. Shopify is being evaluated, but no checkout migration has been made.

## Current status

- The storefront uses `/api/preorder` and `/api/stripe-webhook`.
- `/api/checkout` is a legacy, test-only demonstration.
- Real payments are closed. `TERMS.readyForLive=false` is intentional.
- Preview always uses matching test keys. Production requires separate live configuration and an approved release.

## Configuration

| Setting | Preview value or purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Encrypted test secret key |
| `STRIPE_PUBLISHABLE_KEY` | Matching test publishable key |
| `STRIPE_WEBHOOK_SECRET` | Encrypted signing secret for the preview event destination |
| `ORDERS_DB` | Isolated preview commerce database |
| `PREORDER_SHIPPING_CENTS` | Explicit shipping charge once approved |

Keep secret values in Cloudflare. Never put them in source control, logs, screenshots, or chat.

See the [launch guide](preorders.md) for product terms, webhook event types, payment checks, fulfillment operations, and every live-sales gate. Do not enable real payments as part of repository maintenance.
