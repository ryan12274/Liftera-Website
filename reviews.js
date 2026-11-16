(() => {
 const panel=document.getElementById('reviews-panel'),form=document.getElementById('review-form');
 if(!panel||!form)return;
 const summary=document.getElementById('reviews-summary'),list=document.getElementById('reviews-list'),more=document.getElementById('reviews-more'),status=document.getElementById('review-form-status');
 let page=0,loaded=false,busy=false,securityPromise,widget;
 const showReview=review=>{
  const article=document.createElement('article'),rating=document.createElement('p'),heading=document.createElement('h3'),context=document.createElement('p'),body=document.createElement('p');
  rating.className='review-stars';rating.textContent='★'.repeat(review.rating)+'☆'.repeat(5-review.rating);rating.setAttribute('aria-label',review.rating+' out of 5 stars');
  heading.textContent=review.display_name;
  context.className='review-context';context.textContent=(review.experience==='prototype'?'Prototype experience':'Product experience');
  body.className='review-body';body.textContent=review.body;
  article.append(rating,heading,context,body);list.append(article);
 };
 const load=async()=>{
  if(busy)return;busy=true;more.disabled=true;summary.textContent='Loading reviews…';
  try{
   const response=await fetch('/api/reviews?page='+page),data=await response.json();
   if(!response.ok)throw Error(data.message||'Reviews could not load.');
   if(page===0)list.replaceChildren();
   data.reviews.forEach(showReview);loaded=true;
   document.getElementById('reviews-count').textContent=data.count?'('+data.count+')':'';
   summary.textContent=data.count?data.average.toFixed(1)+' out of 5 · '+data.count+' '+(data.count===1?'review':'reviews'):'No reviews yet. Tried Drop Chain? Share your own experience below.';
   more.hidden=!data.hasMore;more.textContent='Load more reviews';page++;
  }catch(error){summary.textContent=error.message;more.hidden=false;more.textContent='Try loading reviews again';}
  finally{busy=false;more.disabled=false;}
 };
 panel.addEventListener('toggle',()=>{if(panel.open&&!loaded)load();});more.addEventListener('click',load);
 const security=()=>{
  if(securityPromise)return securityPromise;
  securityPromise=new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{securityPromise=null;reject(Error('The security check took too long. Please try opening the form again.'));},20000);
   const ready=()=>{
    try {if(widget===undefined)widget=window.turnstile.render('#review-turnstile',{sitekey:'0x4AAAAAAF1OpIwAiZ1GFxTO',action:'review',theme:'dark',size:'flexible'});clearTimeout(timeout);resolve();}
    catch(error){clearTimeout(timeout);securityPromise=null;reject(Error('The security check could not start. Please reload and try again.'));}
   };
   if(window.turnstile){ready();return;}
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
   script.onload=ready;script.onerror=()=>{clearTimeout(timeout);script.remove();securityPromise=null;reject(Error('The security check could not load. Please try again.'));};document.head.append(script);
  });return securityPromise;
 };
 document.getElementById('review-write').addEventListener('toggle',event=>{if(event.target.open)security().catch(error=>status.textContent=error.message);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{
   await security();const token=window.turnstile.getResponse(widget);
   if(!token){status.textContent='Complete the security check, then submit your review.';return;}
   const values=new FormData(form);status.textContent='Submitting your review…';
   const response=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:values.get('displayName'),rating:Number(values.get('rating')),body:values.get('body'),experience:values.get('experience'),consent:values.get('consent')==='on',website:values.get('website'),token})});
   const data=await response.json();status.textContent=data.message;status.dataset.success=String(response.ok);if(response.ok)form.reset();window.turnstile.reset(widget);
  }catch(error){status.textContent=error.message||'We could not connect. Please try again.';if(widget!==undefined&&window.turnstile)window.turnstile.reset(widget);}
  finally{button.disabled=false;}
 });
})();
