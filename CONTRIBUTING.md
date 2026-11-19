# Working on LIFTERA

## Before editing

Use the current remote `preview` branch for website changes. Treat `main` as the published site. The [environment guide](docs/environments.md) explains the differences.

Keep the site's black, white, and turquoise palette, Oswald headings, and Alata body type. Product photos depict a prototype, so retain the prototype disclosure when presenting them.

## Keep changes focused

- Preserve public page and asset URLs unless a move includes updated references and an intentional redirect.
- Keep product specifications, prices, shipping promises, and policies consistent across pages.
- Keep real purchases separate from VE educational purchases.
- Do not remove the current checkout while Shopify is only being evaluated.
- Add tests when behavior or risk warrants them, particularly for payments and customer data.
- Update the relevant guide when configuration or operations change.

## Validate

```sh
npm run check
npm test
```

These checks are local. Also verify the affected flow on the deployed preview. A passing unit test does not verify live receipts, payment-account settings, fulfillment readiness, or shipping rates.

## Publish

Review changes on preview and publish to main only when the owner asks. Preserve main's newer performance and favicon work during the final merge. Never replace the whole production tree with preview's tree.

Keep secret keys in Cloudflare's encrypted environment settings. Keep customer exports, local databases, and temporary media-processing files outside version control.

The existing brand assets, photos, videos, and fonts do not gain a new license through this cleanup.
