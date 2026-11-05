const reply=(status,message)=>Response.json({message},{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequest({request,env}) {
 if(request.method!=='POST') return reply(405,'Use the signup form.');
 const url=new URL(request.url);
 if(request.headers.get("Origin")!==url.origin) return reply(403,"Please submit from the LIFTERA website.");
 if(!env.WAITLIST_DB || !env.TURNSTILE_SECRET) return reply(503,"Signups are temporarily unavailable. Please try again later.");
 if(Number(request.headers.get("Content-Length"))>8192) return reply(413,"Submission is too large.");
 try {
  const raw=await request.text();
  if(raw.length>8192) return reply(413,"Submission is too large.");
  const form=new URLSearchParams(raw);
  if(form.get("website")) return reply(400,"Please try again.");
  const email=(form.get("email")||"").trim().toLowerCase();
  if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400,"Enter a valid email address.");
  if(form.get("consent")!=="yes") return reply(400,"Please agree to receive launch updates.");
  const token=form.get("cf-turnstile-response");
  if(!token || token.length>2048) return reply(400,"Complete the security check, then try again.");
  const verification=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token}),signal:AbortSignal.timeout(10000)});
  if(!verification.ok) return reply(503,"Security check unavailable. Please try again.");
  const result=await verification.json();
  if(!result.success || result.hostname!==url.hostname || result.action!=="waitlist") return reply(400,"Security check expired. Please try again.");
  await env.WAITLIST_DB.prepare("INSERT INTO waitlist (email,consent_version,source) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING").bind(email,"2026-11-05",url.hostname).run();
  return reply(200,"You're on the list. We'll share Drop Chain updates when they're ready.");
 } catch { return reply(503,"Your signup could not be saved. Please try again."); }
}
