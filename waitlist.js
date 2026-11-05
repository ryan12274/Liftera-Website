const form=document.getElementById('waitlist-form');
if(form) form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!form.reportValidity()) return;
 const button=form.querySelector('button[type="submit"]');
 const status=document.getElementById('waitlist-status');
 button.disabled=true; status.textContent='Saving your signup…';
 try {
  const response=await fetch('/api/waitlist',{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  const data=await response.json();
  status.textContent=data.message;
  if(response.ok) {form.reset();status.dataset.success='true';} else status.dataset.success='false';
 } catch {status.textContent='We could not connect. Please try again.';status.dataset.success='false';}
 finally {button.disabled=false;if(window.turnstile)window.turnstile.reset();}
});
