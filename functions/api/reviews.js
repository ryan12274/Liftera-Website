import {hmac,reply} from './preorder.js';
function modeFor(request){
 const hostname=new URL(request.url).hostname;
 if(/^(preview|[a-f0-9]{8})\.lifterashop\.pages\.dev$/.test(hostname))return 1;
 return ['liftera.shop','www.liftera.shop'].includes(hostname)?0:null;
}
const clean=value=>typeof value==='string'?value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,''):'';
export async function onRequest({request,env}){
 const testMode=modeFor(request),url=new URL(request.url);
 if(testMode===null)return reply(403,{message:'Please use the LIFTERA website.'});
 if(!env.ORDERS_DB)return reply(503,{message:'Reviews are temporarily unavailable. Please try again later.'});
 if(request.method==='GET'){
  const raw=url.searchParams.get('page')||'0';
  if(!/^\d{1,4}$/.test(raw))return reply(400,{message:'Invalid review page.'});
  const page=Number(raw),limit=6;
  try{
   const summary=await env.ORDERS_DB.prepare("SELECT COUNT(*) AS count,AVG(rating) AS average FROM product_reviews WHERE status='approved' AND test_mode=?1").bind(testMode).first();
   const rows=await env.ORDERS_DB.prepare("SELECT id,display_name,rating,body,experience,published_at FROM product_reviews WHERE status='approved' AND test_mode=?1 ORDER BY published_at DESC,id DESC LIMIT ?2 OFFSET ?3").bind(testMode,limit,page*limit).all();
   return reply(200,{count:summary.count,average:summary.count?Math.round(summary.average*10)/10:null,reviews:rows.results,hasMore:(page+1)*limit<summary.count,testMode:!!testMode});
  }catch{return reply(503,{message:'Reviews could not load. Please try again.'});}
 }
 if(request.method!=='POST')return reply(405,{message:'Method not allowed.'},{Allow:'GET, POST'});
 if(request.headers.get('Origin')!==url.origin)return reply(403,{message:'Please submit from the LIFTERA website.'});
 if(!env.TURNSTILE_SECRET)return reply(503,{message:'The review form is temporarily unavailable.'});
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{message:'Invalid review submission.'});
 if(Number(request.headers.get('Content-Length'))>8192)return reply(413,{message:'Review is too long.'});
 let input;
 try{const raw=await request.text();if(raw.length>8192)return reply(413,{message:'Review is too long.'});input=JSON.parse(raw);}catch{return reply(400,{message:'Invalid review submission.'});}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['displayName','rating','body','experience','consent','token','website'].includes(k)))return reply(400,{message:'Invalid review submission.'});
 const name=clean(input.displayName),body=clean(input.body);
 if(input.website||name.length<1||name.length>50||body.length<20||body.length>1500||!Number.isInteger(input.rating)||input.rating<1||input.rating>5||!['prototype','product'].includes(input.experience)||input.consent!==true)return reply(400,{message:'Add your display name, rating, experience and a review of 20–1,500 characters, then agree to publication after approval.'});
 if(typeof input.token!=='string'||input.token.length<1||input.token.length>2048)return reply(400,{message:'Complete the security check, then try again.'});
 const ip=request.headers.get('CF-Connecting-IP');
 if(!ip)return reply(403,{message:'Please use the LIFTERA website.'});
 try{
  const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:input.token}),signal:AbortSignal.timeout(10000)});
  if(!verification.ok)return reply(503,{message:'The security check is unavailable. Please try again.'});
  const result=await verification.json();
  if(!result.success||result.hostname!==url.hostname||result.action!=='review')return reply(400,{message:'The security check expired. Please try again.'});
  const dailyKey=await hmac(new Date().toISOString().slice(0,10)+'|'+url.hostname+'|'+ip,env.TURNSTILE_SECRET),id=crypto.randomUUID();
  await env.ORDERS_DB.prepare("INSERT INTO product_reviews (id,display_name,rating,body,experience,test_mode,dedupe_key) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(dedupe_key) DO NOTHING").bind(id,name,input.rating,body,input.experience,testMode,dailyKey).run();
  return reply(202,{message:'Thanks. Your review has been submitted for approval. It will not appear publicly until reviewed.'});
 }catch{return reply(503,{message:'Your review could not be saved. Please try again.'});}
}
