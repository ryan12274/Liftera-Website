# Cloudflare waitlist

Production subscriber database: liftera-waitlist. Preview database: liftera-waitlist-preview.

Preview uses the liftera-waitlist-preview D1 database through WAITLIST_DB and an encrypted TURNSTILE_SECRET. Production uses its own liftera-waitlist database (6382918d-c0ae-476c-8cb0-8da0ec709ffe) with the same schema and its own environment binding. The Turnstile widget supports liftera.shop, lifterashop.pages.dev and the preview hostname. Never use preview subscribers as the production list.

Subscribers remain private in Cloudflare D1 Studio. Sign in to Cloudflare, open Storage & databases > D1 > liftera-waitlist-preview > Explore Data. Select waitlist to view records. For a CSV export, use the authenticated PowerShell command below. No export is available to website visitors. No public subscriber-list endpoint exists. Existing Brevo subscribers have not been migrated or deleted.

Removal requests go to Liftera.mn@yahoo.com. Remove requested subscribers in D1 Studio before sending updates. A future email service must provide unsubscribe handling; this implementation only collects signups.

## Private CSV export (PowerShell)
For production, replace the preview database ID below with 6382918d-c0ae-476c-8cb0-8da0ec709ffe and choose a production CSV filename.
Install the official Wrangler CLI if needed and sign in with `npx wrangler login`. Run this from a private directory outside the website checkout:

```powershell
$result = npx wrangler d1 execute d7a1e70e-5ffc-4dd9-b39d-40cb6bb67180 --remote --json --command "SELECT email, created_at, consent_version, source FROM waitlist ORDER BY created_at"
if ($LASTEXITCODE -ne 0) { throw "Cloudflare export failed" }
$parsed = ($result -join [Environment]::NewLine) | ConvertFrom-Json
$parsed[0].results | Export-Csv -LiteralPath "$env:USERPROFILE/Downloads/liftera-preview-waitlist.csv" -NoTypeInformation -Encoding UTF8
```

This requires Cloudflare account access. Keep the resulting CSV private and do not commit it to the website repository.
