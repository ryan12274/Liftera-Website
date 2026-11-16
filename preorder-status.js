(() => {
 const box=document.querySelector('.trade-physical');
 if(!box)return;
 fetch('/api/preorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'config'})})
 .then(r=>r.ok?r.json():null).then(config=>{
  if(!config?.open)return;
  const link=box.querySelector('.button'),note=box.querySelector('p');
  link.textContent='Preorder Drop Chain →';link.href='drop-chain.html#checkout';
  note.textContent='$35 USD + shipping. Estimated to ship '+config.shippingEstimate+' to the lower 48 states and Washington, D.C. Full payment at checkout.';
 }).catch(()=>{});
})();
