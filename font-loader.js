'use strict';

// Loading the Google Fonts stylesheet as a normal <link> in <head> blocks
// initial render. A dynamically-inserted <link> isn't render-blocking, so
// add it here instead (the <link rel="preload"> in <head> has already
// kicked off the fetch, so this just attaches it once it resolves).
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap';
document.head.appendChild(link);
