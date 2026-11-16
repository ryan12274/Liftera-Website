export const API_VERSION='2026-10-28.endive';
export const MARKER='liftera-preorder-v2';
export const TERMS={priceCents:3500,shippingEstimate:'mid-December 2026',version:'2026-11-16',estimateValidUntil:'2026-12-21T00:00:00Z',readyForLive:false};
const STATES=new Set('AL AZ AR CA CO CT DE DC FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
export const reply=(status,body,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export function contextFor(request,env){
 const url=new URL(request.url),testMode=/^(preview|[a-f0-9]{8})\.lifterashop\.pages\.dev$/.test(url.hostname);
 if(!testMode&&!['liftera.shop','www.liftera.shop'].includes(url.hostname))return null;
 const mode=testMode?'test':'live',secret=String(env.STRIPE_SECRET_KEY||'').trim(),publicKey=String(env.STRIPE_PUBLISHABLE_KEY||'').trim();
 const keysReady=secret.startsWith('sk_'+mode+'_')&&publicKey.startsWith('pk_'+mode+'_');
 const fee=String(env.PREORDER_SHIPPING_CENTS??''),shippingCents=/^\d{1,5}$/.test(fee)?Number(fee):null;
 const liveReady=TERMS.readyForLive&&Date.now()<Date.parse(TERMS.estimateValidUntil)&&env.PREORDERS_OPEN==='true'&&shippingCents!==null&&shippingCents>0&&!!env.ORDERS_DB&&String(env.STRIPE_WEBHOOK_SECRET||'').startsWith('whsec_')&&keysReady;
 return{url,testMode,mode,secret,publicKey,keysReady,shippingCents,liveReady,cookie:'liftera_preorder_'+mode};
}
export async function hmac(value,secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
export function equalSignature(a,b){
 if(!/^[a-f0-9]{64}$/.test(a||'')||!/^[a-f0-9]{64}$/.test(b||''))return false;
 let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
async function savedSession(request,ctx){
 const raw=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(ctx.cookie+'='))?.slice(ctx.cookie.length+1);
 const[id,expires,signature,...rest]=(raw||'').split('.');
 if(rest.length||!new RegExp('^cs_'+ctx.mode+'_[A-Za-z0-9]+$').test(id||'')||!/^\d+$/.test(expires||''))return null;
 const remaining=Number(expires)-Math.floor(Date.now()/1000);
 if(remaining<=0||remaining>86405)return null;
 return equalSignature(signature,await hmac(id+'.'+expires+'.'+ctx.url.origin,ctx.secret))?id:null;
}
export async function stripeRequest(secret,path,options={}){
 const response=await fetch('https://api.stripe.com/v1/'+path,{...options,headers:{Authorization:'Bearer '+secret,'Stripe-Version':API_VERSION,...options.headers},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Stripe request failed');return response.json();
}
export function validSession(s,ctx){
 return s?.metadata?.integration===MARKER&&s.livemode===!ctx.testMode&&s.currency==='usd'&&new RegExp('^cs_'+ctx.mode+'_[A-Za-z0-9]+$').test(s.id||'')&&
 /^LF-[A-F0-9]{16}$/.test(s.metadata.order_ref||'')&&/^\d{1,7}$/.test(s.metadata.base_cents||'')&&s.amount_subtotal===Number(s.metadata.base_cents)&&s.amount_subtotal>0;
}
export function validAddress(details){
 const a=details?.address;
 return typeof details?.name==='string'&&details.name.trim().length>0&&details.name.length<=200&&a?.country==='US'&&STATES.has(a.state)&&
 typeof a.line1==='string'&&a.line1.trim().length>0&&a.line1.length<=200&&typeof a.city==='string'&&a.city.trim().length>0&&a.city.length<=100&&
 /^\d{5}(-\d{4})?$/.test(a.postal_code||'')&&(!a.line2||(typeof a.line2==='string'&&a.line2.length<=200));
}
export const sessionPath=id=>'checkout/sessions/'+id+'?expand[]=payment_intent.latest_charge&expand[]=line_items';
export async function recordPaid(s,ctx,db){
 if(!validSession(s,ctx)||s.status!=='complete'||s.payment_status!=='paid')return null;
 if(!db){if(ctx.testMode)return{recorded:false};throw Error('Order storage unavailable');}
 const details=s.collected_information?.shipping_details||s.shipping_details;
 const ship=Number(s.total_details?.amount_shipping||0),tax=Number(s.total_details?.amount_tax||0),line=s.line_items?.data;
 const eligible=validAddress(details)&&Array.isArray(line)&&line.length===1&&line[0].quantity===1&&line[0].amount_subtotal===s.amount_subtotal&&
 Number.isSafeInteger(ship)&&ship===Number(s.metadata.shipping_cents)&&Number.isSafeInteger(tax)&&tax>=0&&s.amount_total===s.amount_subtotal+ship+tax&&
 (ctx.testMode||(s.automatic_tax?.enabled===true&&s.automatic_tax?.status==='complete'));
 const pi=s.payment_intent,charge=typeof pi==='object'?pi?.latest_charge:null;
 const refunded=typeof charge==='object'?Number(charge?.amount_refunded||0):0,disputed=typeof charge==='object'&&charge?.disputed?1:0;
 await db.prepare('INSERT INTO preorder_orders (session_id,order_ref,payment_intent_id,test_mode,base_cents,shipping_cents,tax_cents,total_cents,ship_estimate,policy_version,fulfillment_status,amount_refunded,disputed,stripe_created) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14) ON CONFLICT(session_id) DO UPDATE SET amount_refunded=MAX(preorder_orders.amount_refunded,excluded.amount_refunded),disputed=excluded.disputed')
 .bind(s.id,s.metadata.order_ref,typeof pi==='string'?pi:pi?.id||'',ctx.testMode?1:0,s.amount_subtotal,ship,tax,s.amount_total,s.metadata.ship_estimate||'',s.metadata.policy_version||'',eligible?'unfulfilled':'needs_review',refunded,disputed,s.created||0).run();
 return{recorded:true,needsReview:!eligible};
}
async function resultFor(s,ctx,env){
 const paid=s.status==='complete'&&s.payment_status==='paid',record=paid?await recordPaid(s,ctx,env.ORDERS_DB):null;
 const charge=typeof s.payment_intent==='object'?s.payment_intent?.latest_charge:null;
 const amountRefunded=typeof charge==='object'?Number(charge?.amount_refunded||0):0;
 return{status:s.status,paid,testMode:ctx.testMode,orderReference:s.metadata.order_ref,shippingEstimate:s.metadata.ship_estimate,recorded:record?.recorded||false,needsReview:record?.needsReview||false,refunded:amountRefunded>=s.amount_total&&amountRefunded>0,partiallyRefunded:amountRefunded>0&&amountRefunded<s.amount_total};
}
export async function onRequest({request,env}){
 if(request.method!=='POST')return reply(405,{message:'Use the checkout button.'},{Allow:'POST'});
 const ctx=contextFor(request,env);
 if(!ctx||request.headers.get('Origin')!==ctx.url.origin)return reply(403,{message:'Please use the LIFTERA website.'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{message:'Invalid checkout request.'});
 if(Number(request.headers.get('Content-Length'))>4096)return reply(413,{message:'Request is too large.'});
 let input;
 try{const raw=await request.text();if(raw.length>4096)return reply(413,{message:'Request is too large.'});input=JSON.parse(raw);}catch{return reply(400,{message:'Invalid checkout request.'});}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['action','requestId','sessionId','shippingDetails','acceptedTerms'].includes(k)))return reply(400,{message:'Invalid checkout request.'});
 if(input.action==='config')return reply(200,{testMode:ctx.testMode,open:ctx.liveReady,canCheckout:ctx.testMode?ctx.keysReady:ctx.liveReady,priceCents:TERMS.priceCents,shippingCents:ctx.shippingCents,shippingEstimate:TERMS.shippingEstimate,policyVersion:TERMS.version});
 if(!['create','status','shipping'].includes(input.action))return reply(400,{message:'Invalid checkout action.'});
 if(!ctx.keysReady)return reply(503,{message:'Checkout is not connected yet. Please try again later.'});
 try{
  const id=await savedSession(request,ctx);
  if(input.action==='status'||input.action==='shipping'){
   if(!id||(input.sessionId&&input.sessionId!==id))return reply(403,{message:'This checkout session could not be verified.'});
   const s=await stripeRequest(ctx.secret,sessionPath(id));
   if(!validSession(s,ctx))return reply(403,{message:'This is not a LIFTERA checkout.'});
   if(input.action==='status')return reply(200,await resultFor(s,ctx,env));
   if(s.status!=='open')return reply(409,{message:'This checkout is no longer open. Please check its payment status.'});
   if(!validAddress(input.shippingDetails))return reply(422,{message:'We currently ship to the lower 48 U.S. states and Washington, D.C. Enter a complete address in that area.'});
   const details=input.shippingDetails,a=details.address;
   const body=new URLSearchParams({
    'shipping_options[0][shipping_rate_data][display_name]':ctx.testMode&&ctx.shippingCents===null?'Test shipping (rate not final)':'U.S. shipping',
    'shipping_options[0][shipping_rate_data][type]':'fixed_amount',
    'shipping_options[0][shipping_rate_data][fixed_amount][amount]':s.metadata.shipping_cents,
    'shipping_options[0][shipping_rate_data][fixed_amount][currency]':'usd'});
   await stripeRequest(ctx.secret,'checkout/sessions/'+id,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
   return reply(200,{accepted:true});
  }
  if(!ctx.testMode&&!ctx.liveReady)return reply(503,{message:'Preorders are not open yet. Join launch updates to hear when they open.'});
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.requestId||'')||input.acceptedTerms!==TERMS.version)return reply(400,{message:'Review and accept the preorder terms before continuing.'});
  if(!ctx.testMode)await env.ORDERS_DB.prepare('SELECT session_id FROM preorder_orders LIMIT 1').first();
  if(id){
   const s=await stripeRequest(ctx.secret,sessionPath(id));
   if(validSession(s,ctx)){
    if(s.status==='complete'&&s.metadata.request_id===input.requestId)return reply(200,await resultFor(s,ctx,env));
    if(s.status==='open'&&s.metadata.policy_version===TERMS.version&&Number(s.metadata.shipping_cents)===(ctx.shippingCents??0)&&s.client_secret)return reply(200,{publishableKey:ctx.publicKey,clientSecret:s.client_secret,testMode:ctx.testMode});
   }
  }
  const ref='LF-'+input.requestId.replaceAll('-','').slice(0,16).toUpperCase();
  const body=new URLSearchParams({
   ui_mode:'form',mode:'payment',
   'allowed_payment_method_types[0]':'card',
   'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(TERMS.priceCents),
   'line_items[0][price_data][tax_behavior]':'exclusive',
   'line_items[0][price_data][product_data][name]':'Drop Chain preorder'+(ctx.testMode?' (TEST ONLY)':''),
   'line_items[0][price_data][product_data][description]':'One attachment. Belt and plates not included. Estimated to ship '+TERMS.shippingEstimate+'. Prototype shown; final design may change.',
   'line_items[0][price_data][product_data][images][0]':ctx.url.origin+'/drop-chain-prototype.jpg',
   'line_items[0][quantity]':'1','shipping_address_collection[allowed_countries][0]':'US',
   'shipping_options[0][shipping_rate_data][display_name]':'Address validation required',
   'shipping_options[0][shipping_rate_data][type]':'fixed_amount',
   'shipping_options[0][shipping_rate_data][fixed_amount][amount]':String(ctx.shippingCents??0),
   'shipping_options[0][shipping_rate_data][fixed_amount][currency]':'usd',
   return_url:ctx.url.origin+'/checkout-return?session_id={CHECKOUT_SESSION_ID}',
   client_reference_id:ref,'metadata[integration]':MARKER,'metadata[order_ref]':ref,
   'metadata[base_cents]':String(TERMS.priceCents),'metadata[shipping_cents]':String(ctx.shippingCents??0),
   'metadata[ship_estimate]':TERMS.shippingEstimate,'metadata[policy_version]':TERMS.version,
   'metadata[terms_accepted]':'true','metadata[request_id]':input.requestId,
   'payment_intent_data[metadata][order_ref]':ref,'payment_intent_data[metadata][integration]':MARKER,
   'payment_intent_data[description]':'LIFTERA Drop Chain preorder · '+ref+' · ships '+TERMS.shippingEstimate

  });
  if(!ctx.testMode)body.set('automatic_tax[enabled]','true');
  const s=await stripeRequest(ctx.secret,'checkout/sessions',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':MARKER+'-'+ctx.mode+'-'+input.requestId},body});
  if(!validSession(s,ctx))throw Error('Unexpected checkout');
  const expires=Math.min(Number(s.expires_at)||Math.floor(Date.now()/1000)+86400,Math.floor(Date.now()/1000)+86400),value=s.id+'.'+expires;
  const signed=value+'.'+await hmac(value+'.'+ctx.url.origin,ctx.secret);
  const extra={'Set-Cookie':ctx.cookie+'='+signed+'; Path=/api/; HttpOnly; Secure; SameSite=Lax; Max-Age='+Math.max(1,expires-Math.floor(Date.now()/1000))};
  if(s.status==='complete')return reply(200,await resultFor(s,ctx,env),extra);
  if(!s.client_secret)throw Error('Missing checkout');
  return reply(200,{publishableKey:ctx.publicKey,clientSecret:s.client_secret,testMode:ctx.testMode},extra);
 }catch{return reply(503,{message:'Checkout is temporarily unavailable. If you already submitted payment, check its status or contact LIFTERA before trying to pay again.'});}
}
