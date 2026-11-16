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
 const originalHeaderText = headerLink?.textContent;
 const originalHeaderHref = headerLink?.getAttribute('href');
 let checkout;
 let loadingStripe;
 let requestId = crypto.randomUUID();
 let phase = 'idle';
 let productScroll = 0;
 let ownsHistoryEntry = false;

 const setState = (next, title = '', message = '', actionText = '') => {
  phase = next;
  section.dataset.state = next;
  section.setAttribute('aria-busy', String(next === 'loading' || next === 'verifying'));
  stateCard.hidden = next === 'ready';
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
   const response = await fetch('/api/checkout', {
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
  setState('verifying', 'Checking your test payment', 'Please keep this page open while we confirm the result.');
  try {
   const result = await api({action:'status'});
   if (result.paid) {
    checkout?.destroy();
    checkout = null;
    requestId = crypto.randomUUID();
    setState('success', 'Test checkout complete', 'No real payment was taken, and no product has been reserved. Join launch updates to hear when real preorders open.', 'Start another test');
   } else {
    setState('verify-error', 'Test payment is not complete', 'No completed test payment was confirmed. You can return to checkout or check its status again.', 'Check payment status');
    resumeButton.hidden = false;
   }
  } catch (error) {
   setState('verify-error', 'Could not confirm the result', error.message + ' Check the payment status before starting another test.', 'Check payment status');
  }
 };
 const resumeButton = document.createElement('button');
 resumeButton.type = 'button';
 resumeButton.className = 'checkout-back';
 resumeButton.textContent = 'Return to checkout';
 resumeButton.hidden = true;
 resumeButton.addEventListener('click', () => {resumeButton.hidden = true; setState('ready');});
 stateCard.appendChild(resumeButton);

 const start = async () => {
  if (phase === 'loading' || phase === 'verifying' || checkout) return;
  resumeButton.hidden = true;
  setState('loading', 'Loading your checkout', 'Connecting securely to Stripe in test mode.');
  try {
   const data = await api({action:'create', requestId});
   await loadStripe();
   const stripe = window.Stripe(data.publishableKey);
   checkout = await stripe.createEmbeddedCheckoutPage({
    fetchClientSecret: () => Promise.resolve(data.clientSecret),
    onComplete: verify
   });
   mount.hidden = false;
   checkout.mount('#stripe-checkout');
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
  document.body.classList.add('checkout-open');
  section.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  if (headerLink) {headerLink.textContent = 'Back to product'; headerLink.setAttribute('href','#purchase');}
  window.scrollTo({top:0, behavior:'instant'});
  heading.focus({preventScroll:true});
  if (phase === 'idle' || phase === 'error') start();
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
 document.getElementById('back-to-product').addEventListener('click', goBack);
 headerLink?.addEventListener('click', event => {
  if (!section.hidden) {event.preventDefault(); goBack();}
 });
 action.addEventListener('click', () => {
  if (phase === 'verify-error') verify();
  else if (phase === 'error' || phase === 'success') start();
 });
 window.addEventListener('hashchange', () => {
  if (location.hash === '#checkout') showCheckout();
  else showProduct();
 });
 if (location.hash === '#checkout') showCheckout();
})();
