# Stripe preorder integration
See PREORDERS.md for confirmed terms, setup, test cases, and launch controls.
The preview storefront now uses /api/preorder and /api/stripe-webhook. The legacy /api/checkout endpoint is still test-only.
No real payments are enabled. TERMS.readyForLive=false is intentional.
Preview variables: matching STRIPE_SECRET_KEY (encrypted sk_test), STRIPE_PUBLISHABLE_KEY (pk_test), STRIPE_WEBHOOK_SECRET (encrypted whsec), ORDERS_DB binding, and an explicit PREORDER_SHIPPING_CENTS once approved.
Use separate live keys, webhook and database in Production only during the reviewed launch release.
Never put secret values in source control, logs, screenshots, or chat.
