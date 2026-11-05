# Cloudflare waitlist

Preview uses the liftera-waitlist-preview D1 database through WAITLIST_DB and an encrypted TURNSTILE_SECRET. Production requires its own database, schema migration, binding and Turnstile widget/secret before merging. Never use preview subscribers as the production list.

Subscribers remain private in Cloudflare D1 Studio. Sign in to Cloudflare, open Storage & databases > D1 > liftera-waitlist-preview > Explore Data. Select waitlist to view records and export results as CSV. No public subscriber-list endpoint exists. Existing Brevo subscribers have not been migrated or deleted.

Removal requests go to Liftera.mn@yahoo.com. Remove requested subscribers in D1 Studio before sending updates. A future email service must provide unsubscribe handling; this implementation only collects signups.
