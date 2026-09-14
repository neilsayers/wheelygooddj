'use strict';

/*
 * Camelot wheel: 24 keys as (number 1-12, letter A|B).
 * A = minor, B = major. Compatibility is arithmetic on the pair,
 * not a hardcoded adjacency table.
 */

const NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const LETTERS = ['A', 'B'];

// DJ-software convention: major keys shown as a bare note name, minor
// keys with a trailing "m" (e.g. "C" / "Am"), rather than spelled-out
// "C maj" / "A min".
const CAMELOT_TO_MUSICAL = {
  '1A': 'Abm', '1B': 'B',
  '2A': 'Ebm', '2B': 'F#',
  '3A': 'Bbm', '3B': 'Db',
  '4A': 'Fm', '4B': 'Ab',
  '5A': 'Cm', '5B': 'Eb',
  '6A': 'Gm', '6B': 'Bb',
  '7A': 'Dm', '7B': 'F',
  '8A': 'Am', '8B': 'C',
  '9A': 'Em', '9B': 'G',
  '10A': 'Bm', '10B': 'D',
  '11A': 'F#m', '11B': 'A',
  '12A': 'Dbm', '12B': 'E',
};

function mod12(n) {
  return ((n - 1) % 12 + 12) % 12 + 1;
}

function keyId(num, letter) {
  return `${num}${letter}`;
}

function otherLetter(letter) {
  return letter === 'A' ? 'B' : 'A';
}

/**
 * Given a selected (number, letter), return all related keys grouped by
 * relationship, computed purely from arithmetic on the Camelot pair.
 */
function getCompatibleKeys(num, letter) {
  const results = [];

  const push = (n, l, relation, tier, description) => {
    const id = keyId(mod12(n), l);
    if (id === keyId(num, letter)) return;
    results.push({ id, relation, tier, description });
  };

  push(num, otherLetter(letter), 'Relative', 1, 'Same notes, opposite mode — the classic switch-up.');
  push(num + 1, letter, 'Neighbour +1', 1, 'A perfect fifth up — smooth, energy-neutral.');
  push(num - 1, letter, 'Neighbour -1', 1, 'A perfect fifth down — smooth, energy-neutral.');

  push(num + 2, letter, 'Energy Lift (+2)', 2, 'Two steps up the wheel — a noticeable energy boost.');
  push(num - 2, letter, 'Energy Drop (-2)', 2, 'Two steps down the wheel — a noticeable energy pull-back.');
  push(num + 7, letter, 'Semitone Up (+7)', 2, 'Up one semitone — classic peak-time energy boost.');
  push(num - 7, letter, 'Semitone Down (-7)', 2, 'Down one semitone — classic energy release.');
  push(num + 1, otherLetter(letter), 'Diagonal +1', 2, 'Mood shift with a fifth-up lift.');
  push(num - 1, otherLetter(letter), 'Diagonal -1', 2, 'Mood shift with a fifth-down pull.');

  return results;
}

/* ---------------------------------------------------------------------- */
/* Wheel state                                                             */
/* ---------------------------------------------------------------------- */

const state = {
  selectedNumber: 8,
  selectedLetter: 'A',
  showAdvanced: false,
  rotation: 0, // degrees, continuous; (selectedNumber-1)*30 when settled
  settled: true,
};

// Screen geometry for the crescent, recomputed on resize.
const geo = { cx: 0, cy: 0, rA: 0, rB: 0 };

const wheelEl = document.getElementById('wheel');
const wheelPaneEl = document.getElementById('wheel-pane');
const resultsPaneEl = document.getElementById('results-pane');
const resultsEl = document.getElementById('results');
const advancedToggle = document.getElementById('advanced-toggle');
const notesToggle = document.getElementById('notes-toggle');
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');

const wedgeEls = {};

function buildWheel() {
  NUMBERS.forEach((num) => {
    LETTERS.forEach((letter) => {
      const id = keyId(num, letter);
      const btn = document.createElement('button');
      btn.className = `wedge wedge-${letter}`;
      btn.dataset.key = id;
      btn.innerHTML = `
        <span class="wedge-camelot">${id}</span>
        <span class="wedge-note">${CAMELOT_TO_MUSICAL[id]}</span>
      `;
      btn.setAttribute('aria-label', `${id} — ${CAMELOT_TO_MUSICAL[id]}`);
      btn.addEventListener('click', () => {
        if (didDrag) return;
        selectKey(num, letter);
      });
      wheelEl.appendChild(btn);
      wedgeEls[keyId(num, letter)] = btn;
    });
  });
}

function wedgeDiameterPx() {
  return Math.min(110, Math.max(70, window.innerWidth * 0.18));
}

function computeGeometry() {
  const rect = wheelPaneEl.getBoundingClientRect();
  const spacing = Math.max(130, Math.min(rect.height * 0.22, 190));
  const rAvg = spacing / Math.sin(Math.PI / 6); // px per 30° step, at the midline between rings
  const wedgeD = wedgeDiameterPx();
  const halfGap = wedgeD * 0.58; // fixed separation between rings, independent of wheel scale
  geo.rB = rAvg + halfGap;
  geo.rA = rAvg - halfGap;

  const glowClearance = 40; // extra room so hover/selection glow isn't clipped by the pane edge
  const margin = wedgeD / 2 + 10 + glowClearance;
  const anchorX = rect.width - margin - halfGap;
  geo.cx = anchorX - rAvg;
  geo.cy = rect.height / 2;

  const arrowOffset = spacing * 0.82;
  btnUp.style.top = `${geo.cy - arrowOffset}px`;
  btnDown.style.top = `${geo.cy + arrowOffset}px`;
}

function shortestDelta(angle, from) {
  let d = (angle - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function renderWheelPositions() {
  NUMBERS.forEach((num) => {
    const baseAngle = (num - 1) * 30;
    const delta = shortestDelta(baseAngle, state.rotation);
    const rad = (delta * Math.PI) / 180;
    const steps = Math.abs(delta) / 30;
    const opacity = Math.max(1 - steps * 0.32, 0);
    const scale = Math.max(1 - steps * 0.09, 0.55);
    const z = String(200 - Math.round(steps * 10));

    LETTERS.forEach((letter) => {
      const r = letter === 'A' ? geo.rA : geo.rB;
      const x = geo.cx + r * Math.cos(rad);
      const y = geo.cy + r * Math.sin(rad);
      const el = wedgeEls[keyId(num, letter)];
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.opacity = String(opacity);
      el.style.setProperty('--s', scale);
      el.style.pointerEvents = opacity < 0.08 ? 'none' : 'auto';
      el.style.zIndex = z;
    });
  });
}

function updateHighlights(previewNumber) {
  const num = previewNumber != null ? previewNumber : state.selectedNumber;
  const letter = state.selectedLetter;

  document.querySelectorAll('.wedge').forEach((el) => {
    el.classList.remove('is-selected', 'is-tier1', 'is-tier2');
  });
  const selEl = wedgeEls[keyId(num, letter)];
  if (selEl) selEl.classList.add('is-selected');

  const compatible = getCompatibleKeys(num, letter);
  compatible.forEach((r) => {
    if (!state.showAdvanced && r.tier === 2) return;
    const el = wedgeEls[r.id];
    if (el) el.classList.add(r.tier === 1 ? 'is-tier1' : 'is-tier2');
  });
}

function renderResults() {
  const compatible = getCompatibleKeys(state.selectedNumber, state.selectedLetter).filter(
    (r) => state.showAdvanced || r.tier === 1
  );

  resultsEl.innerHTML = '';
  const tiers = [
    { tier: 1, title: 'Safe transitions' },
    { tier: 2, title: 'Advanced moves' },
  ];

  tiers.forEach(({ tier, title }) => {
    const group = compatible.filter((r) => r.tier === tier);
    if (!group.length) return;

    const section = document.createElement('div');
    section.className = 'result-group';
    const heading = document.createElement('h2');
    heading.className = 'result-group-title';
    heading.textContent = title;
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'result-list';

    group.forEach((r) => {
      const card = document.createElement('button');
      card.className = `result-card tier-${tier}`;
      card.innerHTML = `
        <span class="result-key">${r.id}</span>
        <span class="result-musical">${CAMELOT_TO_MUSICAL[r.id]}</span>
        <span class="result-relation">${r.relation}</span>
        <span class="result-desc">${r.description}</span>
      `;
      card.addEventListener('click', () => {
        const m = r.id.match(/^(\d+)([AB])$/);
        selectKey(parseInt(m[1], 10), m[2]);
      });
      list.appendChild(card);
    });

    section.appendChild(list);
    resultsEl.appendChild(section);
  });
}

function setSettled(isSettled) {
  state.settled = isSettled;
  resultsPaneEl.classList.toggle('is-visible', isSettled);
  if (isSettled) renderResults();
}

/* ---------------------------------------------------------------------- */
/* Spring-based rotation animation (gives the rubber-band settle feel)     */
/* ---------------------------------------------------------------------- */

let rafId = null;

function animateRotationTo(target, initialVelocity = 0) {
  if (rafId) cancelAnimationFrame(rafId);
  setSettled(false);

  let pos = state.rotation;
  let vel = initialVelocity;
  const stiffness = 180;
  const damping = 16;
  let lastTime = performance.now();

  function step(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.032);
    lastTime = now;
    const force = -stiffness * (pos - target) - damping * vel;
    vel += force * dt;
    pos += vel * dt;
    state.rotation = pos;
    renderWheelPositions();

    if (Math.abs(pos - target) > 0.15 || Math.abs(vel) > 3) {
      rafId = requestAnimationFrame(step);
    } else {
      state.rotation = target;
      renderWheelPositions();
      rafId = null;
      setSettled(true);
    }
  }

  rafId = requestAnimationFrame(step);
}

function selectKey(num, letter, velocity = 0) {
  num = mod12(num);
  state.selectedNumber = num;
  state.selectedLetter = letter;
  localStorage.setItem('camelot:lastKey', keyId(num, letter));
  updateHighlights();

  const target = (num - 1) * 30;
  const delta = shortestDelta(target, state.rotation);
  animateRotationTo(state.rotation + delta, velocity);
}

/* ---------------------------------------------------------------------- */
/* Drag / swipe handling                                                   */
/* ---------------------------------------------------------------------- */

let dragging = false;
let didDrag = false;
let dragPointerId = null;
let dragStartY = 0;
let dragStartRotation = 0;
let dragSamples = [];

function degPerPixel() {
  return 180 / (geo.rB * Math.PI);
}

wheelPaneEl.addEventListener('pointerdown', (e) => {
  dragging = true;
  didDrag = false;
  dragPointerId = e.pointerId;
  dragStartY = e.clientY;
  dragStartRotation = state.rotation;
  dragSamples = [{ t: performance.now(), rotation: state.rotation }];
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  // Pointer capture is deferred until movement is confirmed (see pointermove) —
  // capturing on every pointerdown suppresses the browser's native click
  // dispatch on the tapped wedge button in Chromium.
});

wheelPaneEl.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dy = dragStartY - e.clientY;
  if (Math.abs(dy) > 4 && !didDrag) {
    didDrag = true;
    wheelPaneEl.setPointerCapture(dragPointerId);
    setSettled(false);
  }
  if (!didDrag) return;

  state.rotation = dragStartRotation + dy * degPerPixel();
  renderWheelPositions();
  updateHighlights(mod12(Math.round(state.rotation / 30) + 1));

  dragSamples.push({ t: performance.now(), rotation: state.rotation });
  if (dragSamples.length > 6) dragSamples.shift();
});

function endDrag() {
  if (!dragging) return;
  dragging = false;

  if (!didDrag) return;

  const first = dragSamples[0];
  const last = dragSamples[dragSamples.length - 1];
  const dt = (last.t - first.t) / 1000;
  const velocity = dt > 0.001 ? (last.rotation - first.rotation) / dt : 0;

  const projected = state.rotation + velocity * 0.05;
  const targetRotation = Math.round(projected / 30) * 30;
  const num = mod12(Math.round(targetRotation / 30) + 1);

  state.selectedNumber = num;
  localStorage.setItem('camelot:lastKey', keyId(num, state.selectedLetter));
  updateHighlights();

  animateRotationTo(targetRotation, velocity);
}

wheelPaneEl.addEventListener('pointerup', endDrag);
wheelPaneEl.addEventListener('pointercancel', endDrag);

btnUp.addEventListener('click', () => selectKey(state.selectedNumber - 1, state.selectedLetter));
btnDown.addEventListener('click', () => selectKey(state.selectedNumber + 1, state.selectedLetter));

advancedToggle.addEventListener('change', (e) => {
  state.showAdvanced = e.target.checked;
  localStorage.setItem('camelot:showAdvanced', state.showAdvanced ? '1' : '0');
  updateHighlights();
  if (state.settled) renderResults();
});

notesToggle.addEventListener('change', (e) => {
  document.body.classList.toggle('emphasize-notes', e.target.checked);
  localStorage.setItem('camelot:emphasizeNotes', e.target.checked ? '1' : '0');
});

/* ---------------------------------------------------------------------- */
/* Init                                                                    */
/* ---------------------------------------------------------------------- */

buildWheel();

state.showAdvanced = localStorage.getItem('camelot:showAdvanced') === '1';
advancedToggle.checked = state.showAdvanced;

const emphasizeNotes = localStorage.getItem('camelot:emphasizeNotes') === '1';
notesToggle.checked = emphasizeNotes;
document.body.classList.toggle('emphasize-notes', emphasizeNotes);

const lastKey = localStorage.getItem('camelot:lastKey');
if (lastKey) {
  const m = lastKey.match(/^(\d+)([AB])$/);
  if (m && CAMELOT_TO_MUSICAL[lastKey]) {
    state.selectedNumber = parseInt(m[1], 10);
    state.selectedLetter = m[2];
  }
}
state.rotation = (state.selectedNumber - 1) * 30;

computeGeometry();
renderWheelPositions();
updateHighlights();
setSettled(true);

window.addEventListener('resize', () => {
  computeGeometry();
  renderWheelPositions();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
