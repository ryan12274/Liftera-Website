import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {onRequest} from '../functions/api/reviews.js';
const origin='https://preview.lifterashop.pages.dev';
const data={displayName:'QA fixture',rating:4,body:'This is a unit-test fixture, not an actual product review.',experience:'prototype',consent:true,token:'test_fixture_token',website:''};
async function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(await readFile(new URL('../migrations/0003_product_reviews.sql',import.meta.url),'utf8'));
 return{sql,prepare(query){return{bind(...v){const stmt=sql.prepare(query.replace(/\?\d+/g,'?'));return{async run(){stmt.run(...v);return{success:true};},async first(){return stmt.get(...v)||null;},async all(){return{results:stmt.all(...v)};}}}}}};
}
const post=(body=data,sender=origin)=>new Request(origin+'/api/reviews',{method:'POST',headers:{Origin:sender,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(body)});
const get=()=>new Request(origin+'/api/reviews');
test('reviews require consent, valid rating, same origin, and correctly scoped Turnstile',async()=>{
 const db=await database(),env={ORDERS_DB:db,TURNSTILE_SECRET:'fixture_secret'},previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({success:true,hostname:'preview.lifterashop.pages.dev',action:'review'});};
 try{
  assert.equal((await onRequest({request:post(data,'https://other.example'),env})).status,403);
  assert.equal((await onRequest({request:post({...data,consent:false}),env})).status,400);
  assert.equal((await onRequest({request:post({...data,rating:6}),env})).status,400);
  assert.equal((await onRequest({request:post({...data,rating:'5'}),env})).status,400);
  assert.equal((await onRequest({request:post({...data,body:'too short'}),env})).status,400);
  assert.equal(calls,0);
  globalThis.fetch=async()=>Response.json({success:true,hostname:'preview.lifterashop.pages.dev',action:'waitlist'});
  assert.equal((await onRequest({request:post(),env})).status,400);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM product_reviews').get().n,0);
 }finally{globalThis.fetch=previous;db.sql.close();}
});
test('submissions stay private until approved and averages only count published reviews',async()=>{
 const db=await database(),env={ORDERS_DB:db,TURNSTILE_SECRET:'fixture_secret'},previous=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({success:true,hostname:'preview.lifterashop.pages.dev',action:'review'});
 try{
  assert.equal((await onRequest({request:post(),env})).status,202);
  assert.equal((await onRequest({request:post({...data,rating:5}),env})).status,202);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM product_reviews').get().n,1,'daily duplicate must not add a vote');
  assert.equal((await onRequest({request:post({...data,displayName:'Second QA fixture',body:'Another unit-test fixture from the same school network.'}),env})).status,202);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM product_reviews').get().n,2,'different reviewers on one network must be accepted');
  const pending=await (await onRequest({request:get(),env})).json();
  assert.deepEqual(pending.reviews,[]);assert.equal(pending.count,0);assert.equal(pending.average,null);
  db.sql.prepare("UPDATE product_reviews SET status='approved',published_at='2026-11-16T12:00:00Z' WHERE display_name='QA fixture'").run();
  const published=await (await onRequest({request:get(),env})).json();
  assert.equal(published.count,1);assert.equal(published.average,4);
  assert.equal(published.reviews[0].display_name,'QA fixture');
  for(const field of ['dedupe_key','email','ip','test_mode','status'])assert.equal(field in published.reviews[0],false);
  const production=await(await onRequest({request:new Request('https://liftera.shop/api/reviews'),env})).json();
  assert.equal(production.count,0,'test reviews must not leak into production');
  db.sql.prepare("UPDATE product_reviews SET status='hidden'").run();
  assert.equal((await(await onRequest({request:get(),env})).json()).count,0);
 }finally{globalThis.fetch=previous;db.sql.close();}
});
