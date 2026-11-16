import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {onRequest,TERMS,MARKER,hmac,recordPaid,contextFor} from '../functions/api/preorder.js';
import {onRequest as webhook,verifyWebhook} from '../functions/api/stripe-webhook.js';
const base='https://preview.lifterashop.pages.dev';
const requestId='7c7a9029-72ca-4c04-9161-9ec934a2b51d';
const env={STRIPE_SECRET_KEY:'sk_test_fixture_only',STRIPE_PUBLISHABLE_KEY:'pk_test_fixture_only'};
const address={name:'Test Buyer',address:{country:'US',state:'MN',line1:'123 Test Street',line2:'',city:'Test City',postal_code:'55376'}};
const session=()=>({id:'cs_test_fixture123',livemode:false,currency:'usd',amount_subtotal:3500,amount_total:3500,status:'open',payment_status:'unpaid',client_secret:'fixture_secret',expires_at:Math.floor(Date.now()/1000)+86400,created:1800000000,
 metadata:{integration:MARKER,order_ref:'LF-7C7A902972CA4C04',base_cents:'3500',shipping_cents:'0',ship_estimate:TERMS.shippingEstimate,policy_version:TERMS.version,request_id:requestId,terms_accepted:'true'},
 total_details:{amount_shipping:0,amount_tax:0},collected_information:{shipping_details:address},line_items:{data:[{quantity:1,amount_subtotal:3500}]},
 payment_intent:{id:'pi_fixture',latest_charge:{amount_refunded:0,disputed:false}}});
const req=(body,options={})=>new Request((options.origin||base)+'/api/preorder',{method:'POST',headers:{Origin:options.sender||options.origin||base,'Content-Type':'application/json',...options.headers},body:JSON.stringify(body)});
const create={action:'create',requestId,acceptedTerms:TERMS.version};
async function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(await readFile(new URL('../migrations/0002_preorders.sql',import.meta.url),'utf8'));
 return{sql,prepare(query){return{bind(...values){const stmt=sql.prepare(query.replace(/\?\d+/g,'?'));return{async run(){stmt.run(...values);return{success:true};},async first(){return stmt.get(...values)||null;}}},async first(){return sql.prepare(query).get()||null;}}}};
}
test('live creation stays closed until every launch gate passes and preview rejects live keys',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not contact Stripe');};
 try{
  assert.equal((await onRequest({request:req(create,{sender:'https://other.example'}),env})).status,403);
  assert.equal((await onRequest({request:req(create),env:{STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_PUBLISHABLE_KEY:'pk_live_fixture'}})).status,503);
  const liveEnv={STRIPE_SECRET_KEY:'sk_live_fixture',STRIPE_PUBLISHABLE_KEY:'pk_live_fixture',PREORDERS_OPEN:'true',PREORDER_SHIPPING_CENTS:'700',STRIPE_WEBHOOK_SECRET:'whsec_fixture',ORDERS_DB:{}};
  assert.equal((await onRequest({request:req(create,{origin:'https://liftera.shop'}),env:liveEnv})).status,503);
  TERMS.readyForLive=true;
  const ctx=contextFor(req(create,{origin:'https://liftera.shop'}),liveEnv);assert.equal(ctx.liveReady,true);
  for(const missing of ['PREORDER_SHIPPING_CENTS','STRIPE_WEBHOOK_SECRET','ORDERS_DB','PREORDERS_OPEN']){
   const copy={...liveEnv};delete copy[missing];assert.equal(contextFor(req(create,{origin:'https://liftera.shop'}),copy).liveReady,false,missing);
  }
 }finally{TERMS.readyForLive=false;globalThis.fetch=previous;}
});
test('price, terms, shipping restrictions and idempotency are owned by server',async()=>{
 const previous=globalThis.fetch;let calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(session());};
 try{
  assert.equal((await onRequest({request:req({...create,price:1}),env})).status,400);
  assert.equal((await onRequest({request:req({...create,acceptedTerms:'old'}),env})).status,400);
  const first=await onRequest({request:req(create),env}),cookie=first.headers.get('Set-Cookie').split(';')[0];assert.equal(first.status,200);
  const params=calls[0].options.body;
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),'3500');
  assert.equal(params.get('permissions[update_shipping_details]'),'server_only');
  assert.equal(params.has('expires_at'),false,'retry parameters must remain stable');
  assert.equal(params.get('metadata[terms_accepted]'),'true');
  assert.equal(params.get('metadata[ship_estimate]'),'mid-December 2026');
  assert.match(first.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
  const shipping={action:'shipping',sessionId:session().id,shippingDetails:address};
  const count=calls.length;
  assert.equal((await onRequest({request:req(shipping),env})).status,403);assert.equal(calls.length,count);
  for(const state of ['AK','HI','PR','AA','AE','AP','VI']){
   assert.equal((await onRequest({request:req({...shipping,shippingDetails:{...address,address:{...address.address,state}}},{headers:{Cookie:cookie}}),env})).status,422,state);
  }
  const good=await onRequest({request:req(shipping,{headers:{Cookie:cookie}}),env});assert.equal(good.status,200);
  assert.equal(calls.at(-1).options.body.get('collected_information[shipping_details][address][state]'),'MN');
  assert.equal(calls.at(-1).options.body.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'0');
  assert.equal((await onRequest({request:req({...shipping,sessionId:'cs_test_other'},{headers:{Cookie:cookie}}),env})).status,403);
 }finally{globalThis.fetch=previous;}
});
test('only paid sessions record orders; retries do not duplicate, reset fulfillment, or erase refunds',async()=>{
 const db=await database(),ctx=contextFor(req(create),env),s=session();
 try{
  assert.equal(await recordPaid(s,ctx,db),null);
  s.status='complete';assert.equal(await recordPaid(s,ctx,db),null);
  s.payment_status='paid';assert.deepEqual(await recordPaid(s,ctx,db),{recorded:true,needsReview:false});
  db.sql.prepare("UPDATE preorder_orders SET fulfillment_status='shipped',amount_refunded=1000").run();
  await recordPaid(s,ctx,db);
  const row=db.sql.prepare('SELECT * FROM preorder_orders').get();
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM preorder_orders').get().n,1);assert.equal(row.fulfillment_status,'shipped');assert.equal(row.amount_refunded,1000);
  assert.equal('email' in row,false);
  const bad={...s,id:'cs_test_badaddress',metadata:{...s.metadata,order_ref:'LF-AAAAAAAAAAAAAAAA'},collected_information:{shipping_details:{...address,address:{...address.address,state:'HI'}}}};
  assert.equal((await recordPaid(bad,ctx,db)).needsReview,true);
  assert.equal(db.sql.prepare("SELECT fulfillment_status FROM preorder_orders WHERE session_id='cs_test_badaddress'").get().fulfillment_status,'needs_review');
 }finally{db.sql.close();}
});
test('webhook signature checks raw payload, time, multiple signatures, and mode',async()=>{
 const raw='{"id":"evt_fixture"}',secret='whsec_fixture',now=Math.floor(Date.now()/1000),sig=await hmac(now+'.'+raw,secret);
 assert.equal(await verifyWebhook(raw,'t='+now+',v1='+'0'.repeat(64)+',v1='+sig,secret,now),true);
 assert.equal(await verifyWebhook(raw+' ','t='+now+',v1='+sig,secret,now),false);
 assert.equal(await verifyWebhook(raw,'t='+now+',v1='+sig,secret,now+301),false);
 assert.equal(await verifyWebhook(raw,'t='+now+',t='+now+',v1='+sig,secret,now),false);
});
test('signed webhook re-fetches Stripe, survives duplicate delivery, and retries storage failure',async()=>{
 const db=await database(),previous=globalThis.fetch,s={...session(),status:'complete',payment_status:'paid'};
 const hookEnv={...env,ORDERS_DB:db,STRIPE_WEBHOOK_SECRET:'whsec_fixture'};
 const event={id:'evt_fixture123',livemode:false,type:'checkout.session.completed',data:{object:{id:s.id,payment_status:'unpaid'}}};
 const send=async(e=event,signature=true)=>{
  const raw=JSON.stringify(e),now=Math.floor(Date.now()/1000),sig=await hmac(now+'.'+raw,hookEnv.STRIPE_WEBHOOK_SECRET);
  return webhook({request:new Request(base+'/api/stripe-webhook',{method:'POST',headers:{'Stripe-Signature':signature?'t='+now+',v1='+sig:'invalid'},body:raw}),env:hookEnv});
 };
 globalThis.fetch=async()=>Response.json(s);
 try{
  assert.equal((await send(event,false)).status,400);
  assert.equal((await send({...event,livemode:true})).status,400);
  assert.equal((await send()).status,200);assert.equal((await send()).status,200);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM preorder_orders').get().n,1);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM preorder_events').get().n,1);
  globalThis.fetch=async()=>Response.json({...s,status:'open',payment_status:'unpaid'});
  assert.equal((await send({...event,id:'evt_unpaid'})).status,200);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM preorder_orders').get().n,1);
  globalThis.fetch=async()=>Response.json(s);hookEnv.ORDERS_DB={prepare(){throw Error('database unavailable');}};
  assert.equal((await send({...event,id:'evt_retry'})).status,503);
 }finally{globalThis.fetch=previous;db.sql.close();}
});
