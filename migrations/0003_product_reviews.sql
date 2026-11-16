CREATE TABLE IF NOT EXISTS product_reviews (
 id TEXT PRIMARY KEY,
 display_name TEXT NOT NULL,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body TEXT NOT NULL,
 experience TEXT NOT NULL CHECK(experience IN ('prototype','product')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','hidden')),
 test_mode INTEGER NOT NULL CHECK(test_mode IN (0,1)),
 dedupe_key TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 published_at TEXT
);
CREATE INDEX IF NOT EXISTS product_reviews_public ON product_reviews(test_mode,status,published_at);
