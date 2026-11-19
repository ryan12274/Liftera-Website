# Customer product reviews

[All guides](README.md)

On preview only until the launch release is approved.

## Storage and public display

Uses `ORDERS_DB`, with separate databases for Preview and Production. Apply [0003_product_reviews.sql](../migrations/0003_product_reviews.sql) to the intended commerce database.

Submissions are **pending by default**. Only approved rows for the current environment are public. No sample reviews are seeded, no verified-purchase badges are assigned, and no review structured data is generated.

Name, stars, experience type, body, and publication date become public after approval. The form collects no email or card/address details.

The product page shows six reviews at a time with **Load more**. The average uses all approved reviews in the environment. An empty review list shows no aggregate star rating.

## Moderation in Cloudflare D1

Use the correct environment's commerce database.

### Read pending entries

```sql
SELECT id, display_name, rating, body, experience, created_at
FROM product_reviews
WHERE status = 'pending'
ORDER BY created_at;
```

### Approve a review

Check authenticity, personal details, relevance, abuse, and whether the experience is with a prototype or physical product. Replace the placeholder with the actual review ID.

```sql
UPDATE product_reviews
SET status = 'approved',
    published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'REPLACE_WITH_REVIEW_ID';
```

### Hide a review

Use this for re-review or a removal request.

```sql
UPDATE product_reviews
SET status = 'hidden'
WHERE id = 'REPLACE_WITH_REVIEW_ID';
```

Do not reject a review merely because its rating is negative. Do not present prototype comments as purchased-product feedback. Test submissions remain in preview and must never be copied into production.

## Spam controls

Cloudflare Turnstile action `review`, same-origin checks, payload limits, and duplicate suppression with a daily hashed request identifier reduce spam.

Distinct reviewers on the same school or household network can submit independently. Repeated name/content submissions on the same day and network do not add another rating.
