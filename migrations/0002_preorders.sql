CREATE TABLE IF NOT EXISTS preorder_orders (
 session_id TEXT PRIMARY KEY, order_ref TEXT NOT NULL, payment_intent_id TEXT NOT NULL,
 test_mode INTEGER NOT NULL CHECK(test_mode IN (0,1)),
 base_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL, tax_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,
 ship_estimate TEXT NOT NULL, policy_version TEXT NOT NULL,
 fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled','needs_review','shipped','canceled')),
 amount_refunded INTEGER NOT NULL DEFAULT 0, disputed INTEGER NOT NULL DEFAULT 0 CHECK(disputed IN (0,1)),
 stripe_created INTEGER NOT NULL, recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(test_mode,order_ref)
);
CREATE INDEX IF NOT EXISTS preorder_payment_intent ON preorder_orders(payment_intent_id);
CREATE TABLE IF NOT EXISTS preorder_events (
 event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, session_id TEXT,
 test_mode INTEGER NOT NULL CHECK(test_mode IN (0,1)),
 received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
