(() => {
  const image = document.getElementById('drop-photo');
  const thumbnails = document.querySelector('.drop-thumbnails');
  if (!image || !thumbnails) return;
  thumbnails.hidden = false;
  thumbnails.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-photo]');
    if (!button || !thumbnails.contains(button)) return;
    image.src = button.dataset.photo;
    image.alt = button.dataset.alt;
    thumbnails.querySelectorAll('button').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
  });
})();
