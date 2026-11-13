const API_VERSION = '2026-10-28.endive';
const COOKIE = 'liftera_checkout_test';
const MARKER = 'liftera-preview-v2';
const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
const reply = (status, body, extra = {}) => Response.json(body, {status, headers: {...headers, ...extra}});
const previewHost = hostname => /^(preview|[a-f0-9]{8})\.lifterashop\.pages\.dev$/.test(hostname);

async function signature(value, secret) {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
 const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
}
async function readSessionCookie(request, secret, origin) {
 const value = (request.headers.get('Cookie') || '').split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if (!value) return null;
 const parts = value.split('.');
 if (parts.length !== 3 || !/^cs_test_[A-Za-z0-9]+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return null;
 const expires = Number(parts[1]);
 if (expires <= Math.floor(Date.now()/1000) || expires > Math.floor(Date.now()/1000)+3605) return null;
 const expected = await signature(parts[0]+'.'+parts[1]+'.'+origin, secret);
 let difference = 0;
 for (let i=0;i<expected.length;i++) difference |= expected.charCodeAt(i)^parts[2].charCodeAt(i);
 return difference === 0 ? parts[0] : null;
}
async function stripeRequest(secret, path, options = {}) {
 const response = await fetch('https://api.stripe.com/v1/'+path, {
  ...options,
  headers: {Authorization:'Bearer '+secret, 'Stripe-Version':API_VERSION, ...options.headers},
  signal: AbortSignal.timeout(15000)
 });
 if (!response.ok) throw new Error('Stripe request failed');
 return response.json();
}
function validSession(session) {
 return session.livemode === false && session.metadata?.integration === MARKER &&
 session.currency === 'usd' && session.amount_total === 3500 && /^cs_test_[A-Za-z0-9]+$/.test(session.id);
}
export async function onRequest({request, env}) {
 if (request.method !== 'POST') return reply(405,{message:'Use the checkout button.'},{Allow:'POST'});
 const url = new URL(request.url);
 if (!previewHost(url.hostname) || request.headers.get('Origin') !== url.origin) return reply(403,{message:'Test checkout is available on LIFTERA preview only.'});
 const secret = String(env.STRIPE_SECRET_KEY || '').trim();
 const publicKey = String(env.STRIPE_PUBLISHABLE_KEY || '').trim();
 if (!secret.startsWith('sk_test_') || !publicKey.startsWith('pk_test_')) return reply(503,{message:'Stripe test checkout is not connected yet. You can still join launch updates.'});
 if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply(415,{message:'Invalid checkout request.'});
 if (Number(request.headers.get('Content-Length')) > 2048) return reply(413,{message:'Request is too large.'});
 let input;
 try {
  const raw = await request.text();
  if (raw.length > 2048) return reply(413,{message:'Request is too large.'});
  input = JSON.parse(raw);
 } catch { return reply(400,{message:'Invalid checkout request.'}); }
 if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(key=>!['action','requestId','sessionId'].includes(key))) return reply(400,{message:'Invalid checkout request.'});
 if (!['create','status'].includes(input.action)) return reply(400,{message:'Invalid checkout action.'});
 try {
  const savedId = await readSessionCookie(request, secret, url.origin);
  if (input.action === 'status') {
   if (!savedId || (input.sessionId && input.sessionId !== savedId)) return reply(403,{message:'This test checkout session could not be verified.'});
   const session = await stripeRequest(secret,'checkout/sessions/'+savedId);
   if (!validSession(session)) return reply(403,{message:'This is not a LIFTERA preview checkout.'});
   return reply(200,{status:session.status,paid:session.status==='complete' && session.payment_status==='paid',testMode:true});
  }
  if (!/^[a-f0-9-]{36}$/.test(input.requestId || '')) return reply(400,{message:'Invalid checkout request.'});
  if (savedId) {
   const session = await stripeRequest(secret,'checkout/sessions/'+savedId);
   if (validSession(session) && session.status==='open' && session.client_secret) return reply(200,{publishableKey:publicKey,clientSecret:session.client_secret,testMode:true});
  }
  const body = new URLSearchParams({
   'ui_mode':'embedded_page',
   'mode':'payment',
   'branding_settings[background_color]':'#101010',
   'branding_settings[button_color]':'#48D1CC',
   'allowed_payment_method_types[0]':'card',
   'line_items[0][price_data][currency]':'usd',
   'line_items[0][price_data][unit_amount]':'3500',
   'line_items[0][price_data][product_data][name]':'Drop Chain preorder (TEST ONLY)',
   'line_items[0][price_data][product_data][description]':'Preview demonstration only. No real order or product reservation. Final price and shipping details are not confirmed.',
   'line_items[0][quantity]':'1',
   'shipping_address_collection[allowed_countries][0]':'US',
   'redirect_on_completion':'if_required',
   'return_url':url.origin+'/checkout-return?session_id={CHECKOUT_SESSION_ID}',
   'expires_at':String(Math.floor(Date.now()/1000)+3600),
   'metadata[integration]':MARKER,
   'custom_text[submit][message]':'Test mode only. No real payment or product reservation. Shipping and taxes are not finalized.'
  });
  const session = await stripeRequest(secret,'checkout/sessions',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'liftera-preview-'+input.requestId},body
  });
  if (!validSession(session) || !session.client_secret) throw new Error('Unexpected checkout');
  const expires = Math.floor(Date.now()/1000)+3600;
  const value = session.id+'.'+expires;
  const signed = value+'.'+await signature(value+'.'+url.origin, secret);
  return reply(200,{publishableKey:publicKey,clientSecret:session.client_secret,testMode:true},{
   'Set-Cookie':COOKIE+'='+signed+'; Path=/api/checkout; HttpOnly; Secure; SameSite=Lax; Max-Age=3600'
  });
 } catch {
  return reply(503,{message:'Stripe test checkout is temporarily unavailable. Please try again.'});
 }
}
