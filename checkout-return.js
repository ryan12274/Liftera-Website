(async () => {
 const status=document.getElementById('return-checkout-status'),title=document.querySelector('h1');
 const sessionId=new URLSearchParams(location.search).get('session_id');
 if(!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId||'')){title.textContent='No checkout to verify.';status.textContent='Return to Drop Chain to begin checkout.';return;}
 try{
  const response=await fetch('/api/preorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',sessionId})});
  const r=await response.json();if(!response.ok)throw Error(r.message||'The checkout could not be verified.');
  if(r.paid){
   title.textContent=r.refunded?'Your payment has been refunded.':r.testMode?'Test checkout complete.':r.needsReview?'Payment received. We’re reviewing your order.':'Your preorder is confirmed.';
   status.textContent=r.refunded?'Reference '+r.orderReference+'. The refund goes to the original payment method. Contact LIFTERA with questions.':'Reference '+r.orderReference+'. '+(r.testMode?'No real payment or reservation. ':'')+'Estimated shipment for the physical product: '+r.shippingEstimate+'.';
  }else{title.textContent='Payment is not complete.';status.textContent='Return to Drop Chain to continue checkout. No completed payment was confirmed.';}
 }catch(error){title.textContent='We could not confirm the result.';status.textContent=error.message+' If you already submitted payment, contact LIFTERA before paying again.';}
})();
