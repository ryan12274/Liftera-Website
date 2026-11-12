const form = document.getElementById('waitlist-form');
if (form) {
 const status = document.getElementById('waitlist-status');
 let securityLoading;
 const loadSecurity = () => {
  if (window.turnstile) return Promise.resolve();
  if (securityLoading) return securityLoading;
  securityLoading = new Promise((resolve, reject) => {
   const script = document.createElement('script');
   script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
   script.async = true;
   script.onload = resolve;
   script.onerror = () => {
    script.remove();
    securityLoading = null;
    status.textContent = 'The security check could not load. Please try again.';
    reject(new Error('Security check unavailable'));
   };
   document.head.appendChild(script);
  });
  return securityLoading;
 };
 const prepareSecurity = () => { loadSecurity().catch(() => {}); };
 form.addEventListener('focusin', prepareSecurity);
 form.addEventListener('pointerenter', prepareSecurity, {once: true});
 if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
   if (entries.some(entry => entry.isIntersecting)) {
    prepareSecurity();
    observer.disconnect();
   }
  }, {rootMargin: '600px'});
  observer.observe(form);
 } else {
  prepareSecurity();
 }
 form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
   await loadSecurity();
   if (!new FormData(form).get('cf-turnstile-response')) {
    status.textContent = 'Please wait for the security check to finish, then try again.';
    return;
   }
   status.textContent = 'Saving your signup…';
   const response = await fetch('/api/waitlist', {
    method: 'POST',
    body: new URLSearchParams(new FormData(form)),
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
   });
   const data = await response.json();
   status.textContent = data.message;
   status.dataset.success = String(response.ok);
   if (response.ok) form.reset();
   window.turnstile.reset();
  } catch {
   status.textContent = 'We could not connect. Please try again.';
   status.dataset.success = 'false';
   if (window.turnstile) window.turnstile.reset();
  } finally {
   button.disabled = false;
  }
 });
}
