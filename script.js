document.querySelectorAll('a[href^="#"]').forEach(link=>{link.addEventListener('click',event=>{const target=document.querySelector(link.getAttribute('href'));if(!target)return;event.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});});});

/* Scroll reveal + small interaction layer */
const revealTargets=document.querySelectorAll(
  '.statement,.section-heading,.product-card,.feature-grid,.steps,.about-panel,.safety-grid,.faq,.cta,.spec-table,.use-section,.product-intro'
);
revealTargets.forEach((el)=>el.classList.add('reveal'));

const staggerTargets=document.querySelectorAll('.feature-grid,.steps,.safety-grid,.spec-grid');
staggerTargets.forEach((el)=>el.classList.add('reveal-stagger'));

if('IntersectionObserver' in window){
  const revealObserver=new IntersectionObserver((entries,observer)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.12,rootMargin:'0px 0px -50px 0px'});
  document.querySelectorAll('.reveal,.reveal-stagger').forEach(el=>revealObserver.observe(el));
}else{
  document.querySelectorAll('.reveal,.reveal-stagger').forEach(el=>el.classList.add('is-visible'));
}

/* Private product-page launch gate */
(() => {
  const gate = document.getElementById('launchGate');
  const form = document.getElementById('launchUnlockForm');
  const input = document.getElementById('launchPassword');
  const error = document.getElementById('launchError');
  if (!gate || !form) return;

  const passwordHash = 'a300e5762cfb19c51d90e2e97989097b02d55e340ee30e468629e237abc64a6a';

  const hash = async (value) => {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  };

  const unlock = () => {
    document.body.classList.remove('launch-locked');
    gate.setAttribute('aria-hidden','true');
    gate.style.display = 'none';
    sessionStorage.setItem('liftera-launch-unlocked','1');
    input.value = '';
  };

  if (sessionStorage.getItem('liftera-launch-unlocked') === '1') unlock();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    if (await hash(input.value) === passwordHash) {
      unlock();
    } else {
      error.textContent = 'Incorrect password.';
      input.select();
    }
  });
})();
