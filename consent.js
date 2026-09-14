'use strict';

const CONSENT_KEY = 'wheelygooddj:consent';

const banner = document.getElementById('consent-banner');
const acceptBtn = document.getElementById('consent-accept');
const rejectBtn = document.getElementById('consent-reject');

function grantAnalytics() {
  gtag('consent', 'update', { analytics_storage: 'granted' });
}

const stored = localStorage.getItem(CONSENT_KEY);
if (stored === 'granted') {
  grantAnalytics();
} else if (stored !== 'denied') {
  banner.hidden = false;
}

acceptBtn.addEventListener('click', () => {
  localStorage.setItem(CONSENT_KEY, 'granted');
  grantAnalytics();
  banner.hidden = true;
});

rejectBtn.addEventListener('click', () => {
  localStorage.setItem(CONSENT_KEY, 'denied');
  banner.hidden = true;
});
