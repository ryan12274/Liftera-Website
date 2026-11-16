import {contextFor,hmac,equalSignature,stripeRequest,sessionPath,validSession,recordPaid,reply} from './preorder.js';
export async function verifyWebhook(raw,header,secret,now=Math.floor(Date.now()/1000)){
 const fields=(header||'').split(',').map(v=>v.trim().split('=')),timestamps=fields.filter(([key])=>key==='t').map(([,v])=>v);
 if(timestamps.length!==1||!/^\d+$/.test(timestamps[0])||Math.abs(now-Number(timestamps[0]))>300)return false;
 const expected=await hmac(timestamps[0]+'.'+raw,secret);
 return fields.some(([key,value])=>key==='v1'&&equalSignature(value,expected));
}
export async function onRequest({request,env}){
 if(request.method!=='POST')return reply(405,{message:'Method not allowed.'},{Allow:'POST'});
 const ctx=contextFor(request,env),secret=String(env.STRIPE_WEBHOOK_SECRET||'').trim();
 if(!ctx||!ctx.keysReady||!secret.startsWith('whsec_')||!env.ORDERS_DB)return reply(503,{message:'Webhook is not configured.'});
 if(Number(request.headers.get('Content-Length'))>262144)return reply(413,{message:'Payload too large.'});
 let event;
 try{
  const raw=await request.text();if(raw.length>262144)return reply(413,{message:'Payload too large.'});
  if(!await verifyWebhook(raw,request.headers.get('Stripe-Signature'),secret))return reply(400,{message:'Invalid signature.'});
  event=JSON.parse(raw);
 }catch{return reply(400,{message:'Invalid webhook.'});}
 if(!/^evt_[A-Za-z0-9]+$/.test(event.id||'')||event.livemode!==!ctx.testMode)return reply(400,{message:'Invalid event mode.'});
 try{
  let sessionId=null;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   const id=event.data?.object?.id;
   if(!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id||''))return reply(400,{message:'Invalid session.'});
   const s=await stripeRequest(ctx.secret,sessionPath(id));
   if(!validSession(s,ctx))return reply(200,{received:true,ignored:true});
   await recordPaid(s,ctx,env.ORDERS_DB);sessionId=id;
  }else if(['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(event.type)){
   const object=event.data?.object,id=event.type==='charge.refunded'?object?.id:object?.charge;
   if(!/^ch_[A-Za-z0-9]+$/.test(id||''))return reply(400,{message:'Invalid charge.'});
   const charge=await stripeRequest(ctx.secret,'charges/'+id);
   if(charge.livemode!==!ctx.testMode||typeof charge.payment_intent!=='string')return reply(400,{message:'Invalid charge mode.'});
   await env.ORDERS_DB.prepare('UPDATE preorder_orders SET amount_refunded=MAX(amount_refunded,?1),disputed=?2 WHERE payment_intent_id=?3 AND test_mode=?4').bind(Number(charge.amount_refunded||0),charge.disputed?1:0,charge.payment_intent,ctx.testMode?1:0).run();
  }else return reply(200,{received:true,ignored:true});
  await env.ORDERS_DB.prepare('INSERT INTO preorder_events (event_id,event_type,session_id,test_mode) VALUES (?1,?2,?3,?4) ON CONFLICT(event_id) DO NOTHING').bind(event.id,event.type,sessionId,ctx.testMode?1:0).run();
  return reply(200,{received:true});
 }catch{return reply(503,{message:'Event could not be saved. Please retry.'});}
}
