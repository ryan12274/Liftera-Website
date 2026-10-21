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
