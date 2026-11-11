# Physical preorder launch
Preview preparation only. Real checkout is not enabled.
## Confirm before enabling payments
- Final USD price (currently a tentative $35).
- Estimated shipping date, shipping charges, and supported U.S. destinations.
- Cancellation and refund terms approved by LIFTERA.
- Product version, included items, belt compatibility, and usage/load guidance.
## Stripe connection
Create a hosted Stripe checkout/payment link for the physical Drop Chain preorder after those details are confirmed. Clearly label it as a preorder, state when payment is collected and the estimated shipping date, collect customer email and shipping address, and restrict delivery to supported U.S. destinations.
Configure shipping charges and applicable taxes in Stripe, customer receipts, and seller notifications. Provide the approved shipping/cancellation/refund terms before checkout.
Use Stripe test mode to check successful/failed payments, shipping totals and addresses, receipts, and refunds before connecting a live link. Do not treat a browser return page as proof of payment.
Replace the launch-updates link in .drop-preorder with the verified Stripe link only when ready. Update the status, price and shipping copy at the same time. Keep the VE link and price separate.
The Cloudflare waitlist remains an update list, not an order database. Manage paid orders and fulfillment using the selected Stripe workflow. No card information or secret API keys belong in this static site.
