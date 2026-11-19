<div align="center">

# LIFTERA

**Drop Chain. Add weight. Keep your belt.**

To help avid lifters spend less money and reduce time wasted while pursuing greatness.

[Live website](https://liftera.shop/) · [Preview website](https://preview.lifterashop.pages.dev/) · [Team guides](docs/README.md)

[![Repository checks](https://github.com/ryan12274/Liftera-Website/actions/workflows/checks.yml/badge.svg?branch=preview)](https://github.com/ryan12274/Liftera-Website/actions/workflows/checks.yml)

<img src="drop-chain-prototype.jpg" width="640" alt="Drop Chain prototype with black webbing and a metal chain">

<sub>Prototype shown. Final design and specifications may change.</sub>

</div>

---

LIFTERA's website introduces the Drop Chain lifting-belt attachment, demonstrates the prototype, and connects visitors with product updates and purchasing options. Built with HTML, CSS, and JavaScript, hosted on Cloudflare Pages.

## Project status

| Environment | Branch | Purpose |
| --- | --- | --- |
| [Production](https://liftera.shop/) | `main` | Published website |
| [Preview](https://preview.lifterashop.pages.dev/) | `preview` | Changes to review before publishing |

The preview contains a **test-only Stripe preorder checkout** and **moderated customer reviews**. Physical-product payments are not open. The VE purchase link is a separate educational transaction.

Shopify is being evaluated for online sales; no migration has been made. See the [launch guide](docs/preorders.md) for outstanding decisions and checks.

## Find your way around

| Location | Contents |
| --- | --- |
| `index.html` | Homepage |
| `drop-chain.html` | Product, purchasing options, and reviews |
| `about.html`, `supporters.html` | Team and supporters |
| `privacy.html`, `preorder-policy.html` | Customer policies |
| Root CSS and JavaScript files | Shared styling, page behavior, checkout, and forms |
| `media/` | Product photographs and demonstration videos |
| `functions/api/` | Cloudflare endpoints for signups, checkout, webhooks, and reviews |
| `migrations/` | Database schemas |
| `tests/` | Automated checkout and review checks |
| `scripts/` | Repository validation tools |
| `docs/` | Setup, launch, and operations guides |

Public pages and assets stay at their existing paths. `font-options.html` and the unused Bernoru font are retained from the earlier design exploration.

## Work on the site

Use **Node.js 24 or newer** for the checks. There are no project dependencies to install and no application build step.

```sh
npm run check
npm test
```

Without npm, the same checks can be run directly with `node scripts/check-repo.mjs` and `node --test tests/*.test.mjs`.

The first command checks JavaScript syntax, JSON, and local file references. Tests use local fixtures and in-memory SQLite; they do not charge cards, contact Stripe, or write to Cloudflare databases.

For local Pages development, use [Cloudflare Wrangler](https://developers.cloudflare.com/pages/functions/local-development/). Preview checkout, signups, and reviews also require the appropriate environment bindings, listed in the [environment guide](docs/environments.md). Opening an HTML file alone does not run these APIs.

## Editing and publishing

1. Make and review changes on `preview`.
2. Run the checks and test the affected flow on the preview website.
3. Publish to `main` only when the owner asks.

Production has performance and favicon changes that are not all present on preview. Preserve those when merging. See [contributing](CONTRIBUTING.md) and [deployment notes](docs/environments.md).

## Team guides

- [Environments and deployment](docs/environments.md)
- [Preorder readiness and fulfillment](docs/preorders.md)
- [Stripe checkout](docs/stripe-checkout.md)
- [Customer review moderation](docs/reviews.md)
- [Waitlist management and private exports](docs/waitlist.md)

Questions about the product: [Liftera.mn@yahoo.com](mailto:Liftera.mn@yahoo.com).
