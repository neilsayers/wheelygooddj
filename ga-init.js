'use strict';

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

// Default to denied until consent.js grants analytics_storage via the
// cookie banner — required for UK/EU visitors under PECR/GDPR.
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
});

gtag('js', new Date());
gtag('config', 'G-RL06SEJEG8');
