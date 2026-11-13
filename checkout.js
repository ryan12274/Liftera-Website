(() => {
 const button = document.getElementById('start-checkout');
 const section = document.getElementById('stripe-preview');
 const status = document.getElementById('checkout-status');
 if (!button || !section || !status) return;
 let checkout;
 let loadingStripe;
 let requestId = crypto.randomUUID();
 const loadStripe = () => {
  if (window.Stripe) return Promise.resolve();
  if (!loadingStripe) loadingStripe = new Promise((resolve,reject) => {
   const script = document.createElement('script');
   script.src = 'https://js.stripe.com/endive/stripe.js';
   script.onload = resolve;
   script.onerror = () => {script.remove();loadingStripe=null;reject(new Error('Stripe could not load. Please try again.'));};
   document.head.appendChild(script);
  });
  return loadingStripe;
 };
 const api = async body => {
  const response = await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Checkout could not load. Please try again.');
  return data;
 };
 const showStatus = message => {status.textContent=message;};
 const complete = async () => {
  showStatus('Verifying the test payment…');
  try {
   const result = await api({action:'status'});
   if (result.paid) {
    checkout?.destroy();
    checkout = null;
    document.getElementById('stripe-checkout').hidden=true;
    showStatus('Test payment complete. No real payment was taken, and no product has been reserved.');
    requestId=crypto.randomUUID();
    button.textContent='Start another test checkout';
    button.disabled=false;
   } else showStatus('The test payment is not complete. You can try again in checkout.');
  } catch (error) {showStatus(error.message);}
 };
 button.addEventListener('click',async () => {
  section.hidden=false;
  section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  if (checkout) return;
  button.disabled=true;
  showStatus('Loading secure Stripe test checkout…');
  try {
   const data = await api({action:'create',requestId});
   await loadStripe();
   const stripe = window.Stripe(data.publishableKey);
   checkout = await stripe.createEmbeddedCheckoutPage({fetchClientSecret:()=>Promise.resolve(data.clientSecret),onComplete:complete});
   document.getElementById('stripe-checkout').hidden=false;
   checkout.mount('#stripe-checkout');
   showStatus('');
  } catch (error) {
   showStatus(error.message);
   button.disabled=false;
  }
 });
})();
