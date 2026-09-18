'use strict';

// The gtag.js bundle is ~170 KiB and analytics_storage defaults to denied
// until consent is granted anyway, so there's no rush to fetch it — load
// it after the page has finished loading instead of competing with the
// initial render. dataLayer (see ga-init.js) queues calls until it arrives.
window.addEventListener('load', () => {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-RL06SEJEG8';
  document.head.appendChild(s);
});
