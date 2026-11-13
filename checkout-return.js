(async () => {
 const status = document.getElementById('return-checkout-status');
 const title = document.querySelector('h1');
 const sessionId = new URLSearchParams(location.search).get('session_id');
 if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId || '')) {
  title.textContent='No test checkout to verify.';
  status.textContent='Return to Drop Chain to start a Stripe test checkout.';
  return;
 }
 try {
  const response = await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',sessionId})});
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'The test checkout could not be verified.');
  title.textContent = result.paid ? 'Test payment complete.' : 'Test checkout is incomplete.';
  status.textContent = result.paid ? 'Stripe confirmed the test payment. No real payment was taken, and no product has been reserved.' : 'Return to Drop Chain to continue or retry the test checkout.';
 } catch (error) {
  title.textContent='We could not verify this test checkout.';
  status.textContent=error.message;
 }
})();