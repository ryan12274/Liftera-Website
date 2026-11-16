# Customer product reviews
On preview only until the launch release is approved.
## Storage
Uses ORDERS_DB, separate databases for Preview and Production. Apply migrations/0003_product_reviews.sql.
Submissions are pending by default. Only approved rows for the current environment are public. No sample reviews are seeded, no verified-purchase badges are assigned, and no review structured data is generated.
Name, stars, experience type, body and publication date are public after approval. No email or full card/address information is collected by this form. Cloudflare Turnstile action review, same-origin checks, payload limits and duplicate suppression with a daily hashed request identifier reduce spam.
## Review moderation in Cloudflare D1 Studio
Use the correct environment database. Read pending entries:
SELECT id,display_name,rating,body,experience,created_at FROM product_reviews WHERE status='pending' ORDER BY created_at;
After checking authenticity, personal details, relevance, abuse and experience context, approve an actual review:
UPDATE product_reviews SET status='approved',published_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='REPLACE_WITH_REVIEW_ID';
Hide a review for re-review or a removal request:
UPDATE product_reviews SET status='hidden' WHERE id='REPLACE_WITH_REVIEW_ID';
Do not reject a review merely because the rating is negative. Do not present prototype comments as purchased-product feedback. Test submissions remain in the preview database and must never be copied into production.
Distinct reviewers sharing a school or household network can submit independently. Duplicate name/content submissions on the same day and network do not add another rating.
The public product page shows six reviews at a time with Load more; the average uses all approved reviews in the environment. No-review state has no aggregate star rating.
