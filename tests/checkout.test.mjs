import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../functions/api/checkout.js',import.meta.url),'utf8');
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const env={STRIPE_SECRET_KEY:'sk_test_local_fixture_only',STRIPE_PUBLISHABLE_KEY:'pk_test_local_fixture_only'};
const base='https://preview.lifterashop.pages.dev';
const requestId='7c7a9029-72ca-4c04-9161-9ec934a2b51d';
const session={id:'cs_test_fixture123',livemode:false,metadata:{integration:'liftera-preview-v2'},currency:'usd',amount_total:3500,status:'open',payment_status:'unpaid',client_secret:'test_client_secret_fixture'};
const req=(body={action:'create',requestId},options={})=>new Request((options.origin||base)+'/api/checkout',{method:options.method||'POST',headers:{Origin:options.sender||options.origin||base,'Content-Type':'application/json',...options.headers},...(options.method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
test('production, cross-origin requests, live keys, and missing keys cannot create sessions',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
 try{
  assert.equal((await onRequest({request:req({}, {method:'GET'}),env})).status,405);
  assert.equal((await onRequest({request:req(undefined,{origin:'https://liftera.shop'}),env})).status,403);
  assert.equal((await onRequest({request:req(undefined,{sender:'https://attacker.example'}),env})).status,403);
  assert.equal((await onRequest({request:req(),env:{...env,STRIPE_SECRET_KEY:'sk_live_fixture'}})).status,503);
  assert.equal((await onRequest({request:req(),env:{}})).status,503);
  assert.equal(calls,0);
 }finally{globalThis.fetch=previous;}
});
test('client price tampering and oversized input are rejected before Stripe',async()=>{
 assert.equal((await onRequest({request:req({action:'create',requestId,price:1}),env})).status,400);
 assert.equal((await onRequest({request:req('x'.repeat(3000)),env})).status,413);
 assert.equal((await onRequest({request:req({action:'create',requestId:'invalid'}),env})).status,400);
});
test('server owns the price, US destination, test mode, and session ownership',async()=>{
 const previous=globalThis.fetch;let calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(session);};
 try{
  const response=await onRequest({request:req(),env});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.testMode,true);
  assert.equal(JSON.stringify(body).includes(env.STRIPE_SECRET_KEY),false);
  const params=calls[0].options.body;
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),'3500');
  assert.equal(params.get('line_items[0][quantity]'),'1');
  assert.equal(params.get('shipping_address_collection[allowed_countries][0]'),'US');
  assert.equal(params.get('ui_mode'),'embedded_page');
  assert.equal(params.get('allowed_payment_method_types[0]'),'card');
  assert.equal(params.has('payment_method_types[0]'),false);
  assert.equal(calls[0].options.headers['Stripe-Version'],'2026-10-28.endive');
  assert.match(params.get('return_url'),/^https:\/\/preview\.lifterashop\.pages\.dev\/checkout-return/);
  const cookie=response.headers.get('Set-Cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
  const cookieHeader=cookie.split(';')[0];
  calls=[];
  assert.equal((await onRequest({request:req({action:'status'}),env})).status,403);
  assert.equal((await onRequest({request:req({action:'status',sessionId:'cs_test_someoneElse'},{headers:{Cookie:cookieHeader}}),env})).status,403);
  let status=await onRequest({request:req({action:'status'},{headers:{Cookie:cookieHeader}}),env});
  assert.equal((await status.json()).paid,false);
  globalThis.fetch=async()=>Response.json({...session,status:'complete',payment_status:'paid'});
  status=await onRequest({request:req({action:'status'},{headers:{Cookie:cookieHeader}}),env});
  assert.equal((await status.json()).paid,true);
  globalThis.fetch=async()=>Response.json({...session,status:'complete',payment_status:'unpaid'});
  status=await onRequest({request:req({action:'status'},{headers:{Cookie:cookieHeader}}),env});
  assert.equal((await status.json()).paid,false);
  globalThis.fetch=async()=>Response.json({...session,livemode:true});
  assert.equal((await onRequest({request:req({action:'status'},{headers:{Cookie:cookieHeader}}),env})).status,403);
  globalThis.fetch=async()=>Response.json({error:{message:'private provider information'}},{status:401});
  status=await onRequest({request:req(),env});
  assert.equal(status.status,503);
  assert.equal((await status.text()).includes('private provider information'),false);
 }finally{globalThis.fetch=previous;}
});
