(() => {
 const button = document.getElementById('start-checkout');
 const section = document.getElementById('stripe-preview');
 const status = document.getElementById('checkout-status');
 if (!button || !section || !status) return;
 const mount = document.getElementById('stripe-checkout');
 const stateCard = document.getElementById('checkout-state');
 const stateTitle = document.getElementById('checkout-state-title');
 const stateIcon = document.getElementById('checkout-state-icon');
 const action = document.getElementById('checkout-action');
 const successLink = document.getElementById('checkout-success-link');
 const heading = document.getElementById('stripe-preview-title');
 const headerLink = document.querySelector('.header-cta');
 const review = document.getElementById('preorder-review');
 const agreement = document.getElementById('preorder-agreement');
 const continueButton = document.getElementById('preorder-continue');
 let config;
 const originalHeaderText = headerLink?.textContent;
 const originalHeaderHref = headerLink?.getAttribute('href');
 let checkout;
 let loadingStripe;
 let requestId = crypto.randomUUID();
 let phase = 'idle';
 let productScroll = 0;
 let ownsHistoryEntry = false;
 const originalScrollRestoration = history.scrollRestoration;

 const setState = (next, title = '', message = '', actionText = '') => {
  phase = next;
  section.dataset.state = next;
  section.setAttribute('aria-busy', String(next === 'loading' || next === 'verifying'));
  stateCard.hidden = next === 'ready' || next === 'review';
  review.hidden = next !== 'review';
  mount.hidden = next !== 'ready';
  stateTitle.textContent = title;
  stateIcon.textContent = next === 'success' ? '✓' : (next === 'error' || next === 'verify-error') ? '!' : '';
  status.textContent = message;
  action.textContent = actionText;
  action.hidden = !actionText;
  successLink.hidden = next !== 'success';
  resumeButton.hidden = true;
 };
 const loadStripe = () => {
  if (window.Stripe) return Promise.resolve();
  if (!loadingStripe) loadingStripe = new Promise((resolve, reject) => {
   const script = document.createElement('script');
   const fail = () => {
    clearTimeout(timer);
    script.remove();
    loadingStripe = null;
    reject(new Error('Stripe could not load. Check your connection and try again.'));
   };
   const timer = setTimeout(fail, 20000);
   script.src = 'https://js.stripe.com/endive/stripe.js';
   script.onload = () => {clearTimeout(timer); resolve();};
   script.onerror = fail;
   document.head.appendChild(script);
  });
  return loadingStripe;
 };
 const api = async body => {
  try {
   const response = await fetch('/api/preorder', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
   });
   const data = await response.json();
   if (!response.ok) throw new Error(data.message || 'Checkout is temporarily unavailable. Please try again.');
   return data;
  } catch (error) {
   if (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) {
    throw new Error('We could not connect to checkout. Check your connection and try again.');
   }
   throw error;
  }
 };
 const verify = async () => {
  if (phase === 'verifying') return;
  setState('verifying', config?.testMode ? 'Checking your test payment' : 'Checking your payment', 'Please keep this page open while we confirm the result.');
  try {
   const result = await api({action:'status'});
   if (result.paid) {
    checkout?.destroy();
    checkout = null;
    requestId = crypto.randomUUID();
    if (result.refunded) {
     setState('success', 'Your payment has been refunded', 'Reference ' + result.orderReference + '. The refund goes to the original payment method. Contact LIFTERA with questions.');
    } else if (result.testMode) {
     setState('success', 'Test checkout complete', 'Reference ' + result.orderReference + '. No real payment or reservation. Estimated shipment for real preorders: ' + result.shippingEstimate + '.', 'Start another test');
    } else {
     setState('success', result.needsReview ? 'Payment received. We’re reviewing your order.' : 'Your preorder is confirmed', 'Order ' + result.orderReference + '. Estimated to ship ' + result.shippingEstimate + '. Keep your order reference for questions or cancellation.');
     successLink.textContent = 'Questions or cancellations? Contact LIFTERA ↗';
     successLink.href = 'mailto:Liftera.mn@yahoo.com?subject=' + encodeURIComponent('Preorder ' + result.orderReference);
    }
   } else {
    setState('verify-error', 'Payment is not complete', 'No completed payment was confirmed. You can return to checkout or check its status again.', 'Check payment status');
    resumeButton.hidden = false;
   }
  } catch (error) {
   setState('verify-error', 'Could not confirm the result', error.message + ' Check the payment status before attempting another payment.', 'Check payment status');
  }
 };
 const resumeButton = document.createElement('button');
 resumeButton.type = 'button';
 resumeButton.className = 'checkout-back';
 resumeButton.textContent = 'Return to checkout';
 resumeButton.hidden = true;
 resumeButton.addEventListener('click', () => {resumeButton.hidden = true; setState('ready');});
 stateCard.appendChild(resumeButton);

 const loadConfig = async () => {
  if (!config) config = await api({action:'config'});
  button.hidden = !config.canCheckout;
  if (config.open) {
   button.textContent = 'Preorder Drop Chain →';
   document.getElementById('preorder-availability').textContent = 'Preorders open';
   document.querySelector('.drop-order-note').textContent = 'Estimated to ship ' + config.shippingEstimate + '. Delivery to the lower 48 states and Washington, D.C. Shipping: ' + new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(config.shippingCents/100) + '. Applicable taxes are shown before payment.';
   document.getElementById('preorder-mode-note').textContent = 'Physical product preorder. Full payment at checkout.';
   document.getElementById('preorder-updates').textContent = 'Prefer updates? Join the list';
   document.querySelector('.trade-checkout-note').textContent = 'Estimated to ship ' + config.shippingEstimate + '.';
   document.querySelector('.checkout-test-pill').textContent = 'PREORDER';
   document.getElementById('preorder-checkout-note').textContent = 'Full payment now. Estimated to ship ' + config.shippingEstimate + '. Cancel before shipment for a full refund.';
   document.querySelector('.checkout-test-help').hidden = true;
   document.querySelector('.checkout-help a[href="preorder-policy.html"]').firstChild.textContent = 'Preorder & return policy ';
   document.getElementById('preorder-agreement-text').textContent = 'I understand this is a preorder, payment is collected now, shipment is estimated for ' + config.shippingEstimate + ', and I agree to the preorder and return terms.';
   continueButton.textContent = 'Continue to secure payment →';
  }
  document.getElementById('preorder-shipping-line').textContent = config.shippingCents === null ? 'Not finalized (test only)' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(config.shippingCents/100);
  document.getElementById('preorder-review-note').textContent = config.testMode ? 'Test mode only. No charge or reservation. Shipping and taxes shown here are not a final quote.' : 'Shipping and applicable taxes are included in the total shown before you pay.';
  return config;
 };
 const showReview = async () => {
  setState('loading', 'Preparing your preorder', 'Loading the current preorder details.');
  try {
   await loadConfig();
   if (!config.canCheckout) {setState('error', 'Preorders are not open yet', 'Join launch updates to hear when ordering opens.'); return;}
   agreement.checked = false;
   continueButton.disabled = true;
   setState('review');
  } catch (error) {setState('error', 'Checkout could not load', error.message, 'Try again');}
 };
 agreement.addEventListener('change', () => {continueButton.disabled = !agreement.checked;});
 continueButton.addEventListener('click', () => {if (agreement.checked) start();});
 const start = async () => {
  if (phase === 'loading' || phase === 'verifying' || checkout || !agreement.checked || !config) return;
  resumeButton.hidden = true;
  setState('loading', 'Loading your checkout', config?.testMode ? 'Connecting securely to Stripe in test mode.' : 'Connecting securely to Stripe.');
  try {
   const data = await api({action:'create', requestId, acceptedTerms:config.policyVersion});
   if (data.paid) {await verify(); return;}
   await loadStripe();
   const stripe = window.Stripe(data.publishableKey);
   const sdk = stripe.initCheckoutFormSdk({
    clientSecret:data.clientSecret,
    appearance:{theme:'stripe',variables:{colorPrimary:'#48D1CC',colorPrimaryText:'#101010',fontFamily:'Arial, sans-serif',borderRadius:'4px'}},
    savedPaymentMethod:{enableSave:'never',enableRedisplay:'never'}
   });
   const loaded = await sdk.loadActions();
   if (loaded.type !== 'success') throw new Error('Stripe could not prepare checkout. Please try again.');
   const actions = loaded.actions;
   const form = sdk.createForm({layout:'expanded',expressCheckout:{paymentMethods:{applePay:'never',googlePay:'never',link:'never',paypal:'never',klarna:'never',amazonPay:'never'}}});
   checkout = form;
   const formError = document.getElementById('stripe-form-error');
   let confirming = false;
   let latestAddress;
   form.on('change', event => {latestAddress = event.value?.shippingAddress;});
   const showTotal = session => {
    document.getElementById('preorder-live-total').textContent = session.total.total.amount;
   };
   showTotal(actions.getSession());
   sdk.on('change', showTotal);
   form.on('confirm', async event => {
    if (confirming) return;
    confirming = true;
    formError.textContent = '';
    try {
     const current = actions.getSession();
     const shippingDetails = latestAddress || current.shippingAddress;
     const update = await actions.runServerUpdate(() => api({action:'shipping',sessionId:current.id,shippingDetails}));
     if (update.type === 'error') throw new Error(update.error.message);
     showTotal(actions.getSession());
     const result = await actions.confirm({formConfirmEvent:event,redirect:'if_required'});
     if (result.type === 'error') throw new Error(result.error.message);
     await verify();
    } catch (error) {
     formError.textContent = error.message || 'Payment could not be completed. Check the details and try again.';
     formError.focus({preventScroll:true});
    } finally {confirming = false;}
   });
   mount.hidden = false;
   checkout.mount('#stripe-form');
   setState('ready');
  } catch (error) {
   checkout?.destroy();
   checkout = null;
   setState('error', 'Checkout could not load', error.message, 'Try again');
  }
 };
 const showCheckout = () => {
  if (!section.hidden) return;
  productScroll = window.scrollY;
  history.scrollRestoration = 'manual';
  document.body.classList.add('checkout-open');
  section.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  if (headerLink) {headerLink.textContent = '← Back to product'; headerLink.setAttribute('href','#purchase');}
  window.scrollTo({top:0, behavior:'instant'});
  heading.focus({preventScroll:true});
  if (phase === 'idle' || phase === 'error') showReview();
 };
 const showProduct = () => {
  if (section.hidden) return;
  section.hidden = true;
  document.body.classList.remove('checkout-open');
  button.setAttribute('aria-expanded', 'false');
  if (headerLink) {headerLink.textContent = originalHeaderText; headerLink.setAttribute('href', originalHeaderHref);}
  button.focus({preventScroll:true});
  window.scrollTo({top:productScroll, behavior:'instant'});
  ownsHistoryEntry = false;
  history.scrollRestoration = originalScrollRestoration;
 };
 const goBack = () => {
  if (ownsHistoryEntry) history.back();
  else {
   history.replaceState(null, '', location.pathname + location.search + '#purchase');
   showProduct();
  }
 };
 button.addEventListener('click', () => {
  if (location.hash !== '#checkout') {
   history.pushState(null, '', '#checkout');
   ownsHistoryEntry = true;
  }
  showCheckout();
 });
 headerLink?.addEventListener('click', event => {
  if (!section.hidden) {event.preventDefault(); goBack();}
 });
 action.addEventListener('click', () => {
  if (phase === 'verify-error') verify();
  else if (phase === 'success' || (phase === 'error' && !config)) showReview();
  else if (phase === 'error') start();
 });
 window.addEventListener('hashchange', () => {
  if (location.hash === '#checkout') showCheckout();
  else showProduct();
 });
 window.addEventListener('pageshow', () => {
  if (!section.hidden) requestAnimationFrame(() => requestAnimationFrame(() => {
   if (!section.hidden && document.activeElement === heading) window.scrollTo({top:0, behavior:'instant'});
  }));
 });
 loadConfig().catch(() => {});
 if (location.hash === '#checkout') showCheckout();
})();
