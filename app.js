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

const BPM_MIN = 110;
const BPM_MAX = 140;

/**
 * A DJ playing a track off its natural tempo (no keylock) shifts its pitch
 * by the same ratio as the tempo change, so the "effective" key isn't the
 * one printed on the track. Semitones moved = 12 * log2(actual/original).
 * On the Camelot wheel a semitone is a +7 step (see the "Semitone Up/Down"
 * relations above), so that many semitones just walks the wheel by 7s.
 * Returns null when there's no whole-semitone shift to show.
 */
function computeActualKey(num, letter, originalBpm, actualBpm) {
  if (!originalBpm || !actualBpm || originalBpm === actualBpm) return null;
  const semitones = 12 * Math.log2(actualBpm / originalBpm);
  const rounded = Math.round(semitones);
  if (rounded === 0) return null;
  const actualNum = mod12(num + rounded * 7);
  return { id: keyId(actualNum, letter), num: actualNum, letter, rounded };
}

function keyId(num, letter) {
  return `${num}${letter}`;
}

/**
 * The key that should actually drive the wheel and results: the BPM-shifted
 * key when a shift is active, otherwise whatever's selected. Everything
 * downstream (rotation target, compatible-key list, "selected" styling)
 * reads from this rather than state.selectedNumber/selectedLetter directly.
 */
function getEffectiveKey() {
  const actual = computeActualKey(
    state.selectedNumber,
    state.selectedLetter,
    state.bpmOriginal,
    state.bpmActual
  );
  if (actual) return { num: actual.num, letter: actual.letter, shifted: true };
  return { num: state.selectedNumber, letter: state.selectedLetter, shifted: false };
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
  bpmOriginal: 122,
  bpmActual: 122,
  // The original (track-printed) key's wedge id, set only while a BPM
  // shift is active — the effective key takes over as "selected" and
  // this one is shown as a faded reference instead.
  originalFadedKeyId: null,
};

// Screen geometry for the crescent, recomputed on resize.
const geo = { cx: 0, cy: 0, rA: 0, rB: 0 };

const wheelEl = document.getElementById('wheel');
const wheelPaneEl = document.getElementById('wheel-pane');
const resultsPaneEl = document.getElementById('results-pane');
const resultsEl = document.getElementById('results');
const resultsCloseBtn = document.getElementById('results-close');
const settingsToggleBtn = document.getElementById('settings-toggle');
const settingsDrawerEl = document.getElementById('settings-drawer');
const settingsCloseBtn = document.getElementById('settings-close');
const advancedToggle = document.getElementById('advanced-toggle');
const notesToggle = document.getElementById('notes-toggle');
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const bpmOriginalInput = document.getElementById('bpm-original');
const bpmActualInput = document.getElementById('bpm-actual');
const bpmReadoutEl = document.getElementById('bpm-readout');
const wheelTracksEl = document.querySelector('.wheel-tracks');
const trackAEl = document.querySelector('.track-a');
const trackBEl = document.querySelector('.track-b');

const TRACK_WIDTH = 30;

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
  return Math.min(118, Math.max(76, window.innerWidth * 0.19));
}

function computeGeometry() {
  const rect = wheelPaneEl.getBoundingClientRect();
  const spacing = Math.max(115, Math.min(rect.height * 0.19, 175));
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

  positionTracks();
}

// Ring elements sit behind the wedges, centred on the same point and
// sized to the same radii, so they read as the "orbits" the dots run
// along rather than a separate decoration.
function positionTracks() {
  [[trackAEl, geo.rA], [trackBEl, geo.rB]].forEach(([el, r]) => {
    const d = r * 2 + TRACK_WIDTH;
    el.style.width = `${d}px`;
    el.style.height = `${d}px`;
    el.style.left = `${geo.cx}px`;
    el.style.top = `${geo.cy}px`;
  });

  // Fade the rings out towards the left, where the dots themselves have
  // already faded to nothing, so the arc doesn't look like it "ends"
  // arbitrarily. Centred on the rightmost point of the outer ring —
  // near the selected wedge — so that side stays solid.
  const fadeX = geo.cx + geo.rB;
  const fadeY = geo.cy;
  const rx = geo.rB * 1.3;
  const ry = geo.cy;
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${fadeX}px ${fadeY}px, black 8%, transparent 78%)`;
  wheelTracksEl.style.maskImage = mask;
  wheelTracksEl.style.webkitMaskImage = mask;
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

  // The wheel now rotates to the effective (BPM-shifted) key, so the
  // original track key can land many steps away — past the point where
  // the fade above would hide it entirely. Pin it to a fixed, legible
  // "faded" look regardless of how far it lands, rather than letting it
  // vanish for the (common) case of a several-BPM tempo bump.
  if (state.originalFadedKeyId) {
    const el = wedgeEls[state.originalFadedKeyId];
    if (el) {
      el.style.opacity = '0.55';
      el.style.setProperty('--s', 0.85);
      el.style.pointerEvents = 'auto';
      el.style.zIndex = '150';
    }
  }
}

function updateHighlights(previewNumber) {
  // previewNumber (live drag preview) stands in for the candidate original
  // key; the actual shift math and effective-key resolution still apply
  // on top of it, so the preview shows exactly what letting go would give.
  const num = previewNumber != null ? previewNumber : state.selectedNumber;
  const letter = state.selectedLetter;

  document.querySelectorAll('.wedge').forEach((el) => {
    el.classList.remove('is-selected', 'is-tier1', 'is-tier2', 'is-actual', 'is-original-faded');
  });

  const actual = computeActualKey(num, letter, state.bpmOriginal, state.bpmActual);
  const effNum = actual ? actual.num : num;
  const effLetter = actual ? actual.letter : letter;

  const selEl = wedgeEls[keyId(effNum, effLetter)];
  if (selEl) {
    selEl.classList.add('is-selected');
    if (actual) selEl.classList.add('is-actual');
  }

  if (actual) {
    const originalEl = wedgeEls[keyId(num, letter)];
    if (originalEl) originalEl.classList.add('is-original-faded');
  }
  state.originalFadedKeyId = actual ? keyId(num, letter) : null;

  const compatible = getCompatibleKeys(effNum, effLetter);
  compatible.forEach((r) => {
    if (!state.showAdvanced && r.tier === 2) return;
    const el = wedgeEls[r.id];
    if (el) el.classList.add(r.tier === 1 ? 'is-tier1' : 'is-tier2');
  });

  renderWheelPositions();
  updateBpmReadout(actual, num, letter);
}

function updateBpmReadout(actual, origNum, origLetter) {
  if (!bpmReadoutEl) return;
  if (!actual) {
    bpmReadoutEl.innerHTML = '';
    return;
  }
  const sign = actual.rounded > 0 ? '+' : '';
  const semitoneWord = Math.abs(actual.rounded) === 1 ? 'semitone' : 'semitones';
  const origId = keyId(origNum, origLetter);
  // The wheel now shows the effective key front and centre, so the badge's
  // job is to keep the original (track-printed) key legible as text too —
  // useful for screen readers, and as a fallback if it lands somewhere
  // cluttered on the wheel.
  bpmReadoutEl.innerHTML =
    `<span class="bpm-actual-badge">${actual.id}</span>` +
    `<span class="bpm-actual-text">Showing mixes for <strong>${CAMELOT_TO_MUSICAL[actual.id]}</strong> ` +
    `(${sign}${actual.rounded} ${semitoneWord}) — printed key was ${origId} (${CAMELOT_TO_MUSICAL[origId]}).</span>`;
}

function renderResults() {
  const effective = getEffectiveKey();
  const compatible = getCompatibleKeys(effective.num, effective.letter).filter(
    (r) => state.showAdvanced || r.tier === 1
  );

  resultsEl.innerHTML = '';
  const tiers = [
    { tier: 1, title: 'Safe transitions' },
    { tier: 2, title: 'Advanced moves' },
  ];

  tiers.forEach(({ tier, title }) => {
    const group = compatible.filter((r) => r.tier === tier);

    if (group.length) {
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
          selectKey(parseInt(m[1], 10), m[2], 0, { rotate: false });
        });
        list.appendChild(card);
      });

      section.appendChild(list);
      resultsEl.appendChild(section);
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Mobile transitions sheet + settings drawer                             */
/* ---------------------------------------------------------------------- */

// Matches the .stage layout breakpoint in style.css where #results becomes
// a bottom sheet instead of the desktop side-by-side pane.
const MOBILE_MQ = window.matchMedia('(max-width: 700px)');

// On mobile, a fresh key selection doesn't pop the transitions sheet up
// immediately — that read as the sheet pouncing the instant a wedge was
// tapped. Instead we wait, so the wheel stays uncluttered long enough for
// another tap to register; each new selection pushes the wait back out
// rather than opening on a stale target.
const RESULTS_OPEN_DELAY_MS = 1200;
let resultsOpenTimer = null;

function openSettingsDrawer() {
  settingsDrawerEl.classList.add('is-open');
  settingsToggleBtn.setAttribute('aria-expanded', 'true');
  if (resultsOpenTimer) {
    clearTimeout(resultsOpenTimer);
    resultsOpenTimer = null;
  }
  resultsEl.classList.remove('is-open');
}

function closeSettingsDrawer() {
  settingsDrawerEl.classList.remove('is-open');
  settingsToggleBtn.setAttribute('aria-expanded', 'false');
}

function scheduleResultsOpen() {
  if (!MOBILE_MQ.matches) {
    resultsEl.classList.add('is-open');
    return;
  }
  closeSettingsDrawer();
  if (resultsOpenTimer) clearTimeout(resultsOpenTimer);
  resultsOpenTimer = setTimeout(() => {
    resultsOpenTimer = null;
    resultsEl.classList.add('is-open');
  }, RESULTS_OPEN_DELAY_MS);
}

settingsToggleBtn.addEventListener('click', () => {
  if (settingsDrawerEl.classList.contains('is-open')) closeSettingsDrawer();
  else openSettingsDrawer();
});

settingsCloseBtn.addEventListener('click', closeSettingsDrawer);

function setSettled(isSettled) {
  state.settled = isSettled;
  resultsPaneEl.classList.toggle('is-visible', isSettled);
  if (isSettled) renderResults();
}

/* ---------------------------------------------------------------------- */
/* Spring-based rotation animation (gives the rubber-band settle feel)     */
/* ---------------------------------------------------------------------- */

let rafId = null;

// `silent` skips the results-pane hide/show around the animation. Click and
// drag use the normal (non-silent) path, since the destination key is only
// known once the gesture ends. A BPM edit already knows its destination the
// instant you type, so hiding the results while the wheel catches up just
// reads as a flicker — silent mode updates the results immediately and only
// animates the wheel's position underneath.
function animateRotationTo(target, initialVelocity = 0, { silent = false } = {}) {
  if (rafId) cancelAnimationFrame(rafId);
  if (!silent) setSettled(false);

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
      if (!silent) setSettled(true);
    }
  }

  rafId = requestAnimationFrame(step);
}

// Rotation always targets the effective key, not necessarily the one that
// was just clicked/dragged/typed — if a BPM shift is active, the wheel
// settles on the shifted key instead.
function rotateToEffective(velocity = 0, opts) {
  const effective = getEffectiveKey();
  const target = (effective.num - 1) * 30;
  const delta = shortestDelta(target, state.rotation);
  animateRotationTo(state.rotation + delta, velocity, opts);
}

// `rotate: false` is used by the transitions-list cards (see renderResults)
// — clicking a compatible key there swaps the results to show what's
// compatible with it, but the wheel itself should only ever turn from a
// direct drag/tap/arrow on the wheel, not as a side effect of browsing
// the list.
function selectKey(num, letter, velocity = 0, { rotate = true } = {}) {
  num = mod12(num);
  state.selectedNumber = num;
  state.selectedLetter = letter;
  localStorage.setItem('camelot:lastKey', keyId(num, letter));
  updateHighlights();

  if (rotate) {
    rotateToEffective(velocity);
  } else {
    renderResults();
  }
  scheduleResultsOpen();
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

  rotateToEffective(velocity);
  scheduleResultsOpen();
}

wheelPaneEl.addEventListener('pointerup', endDrag);
wheelPaneEl.addEventListener('pointercancel', endDrag);

// Mobile-only close for the results modal (see #results in the
// max-width: 700px block in style.css) — a no-op on desktop, where
// #results is never position: fixed and .is-open has no visual effect.
resultsCloseBtn.addEventListener('click', () => resultsEl.classList.remove('is-open'));

btnUp.addEventListener('click', () => selectKey(state.selectedNumber - 1, state.selectedLetter));
btnDown.addEventListener('click', () => selectKey(state.selectedNumber + 1, state.selectedLetter));

advancedToggle.addEventListener('change', (e) => {
  state.showAdvanced = e.target.checked;
  localStorage.setItem('camelot:showAdvanced', state.showAdvanced ? '1' : '0');
  updateHighlights();
  if (state.settled) renderResults();
});

function clampBpm(v) {
  if (!Number.isFinite(v)) return null;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v)));
}

function handleBpmInput() {
  const o = parseFloat(bpmOriginalInput.value);
  const a = parseFloat(bpmActualInput.value);
  state.bpmOriginal = Number.isFinite(o) ? o : null;
  state.bpmActual = Number.isFinite(a) ? a : null;
  localStorage.setItem('camelot:bpmOriginal', state.bpmOriginal != null ? String(state.bpmOriginal) : '');
  localStorage.setItem('camelot:bpmActual', state.bpmActual != null ? String(state.bpmActual) : '');
  updateHighlights();
  state.settled = true;
  resultsPaneEl.classList.add('is-visible');
  if (resultsOpenTimer) {
    clearTimeout(resultsOpenTimer);
    resultsOpenTimer = null;
  }
  closeSettingsDrawer();
  resultsEl.classList.add('is-open');
  renderResults();
  rotateToEffective(0, { silent: true });
}

bpmOriginalInput.addEventListener('change', handleBpmInput);
bpmActualInput.addEventListener('change', handleBpmInput);

notesToggle.addEventListener('change', (e) => {
  document.body.classList.toggle('emphasize-notes', e.target.checked);
  localStorage.setItem('camelot:emphasizeNotes', e.target.checked ? '1' : '0');
});

/* ---------------------------------------------------------------------- */
/* Init                                                                    */
/* ---------------------------------------------------------------------- */

buildWheel();

function populateBpmSelect(select) {
  for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm++) {
    const option = document.createElement('option');
    option.value = String(bpm);
    option.textContent = String(bpm);
    select.appendChild(option);
  }
}
populateBpmSelect(bpmOriginalInput);
populateBpmSelect(bpmActualInput);

const storedShowAdvanced = localStorage.getItem('camelot:showAdvanced');
state.showAdvanced = storedShowAdvanced === null ? true : storedShowAdvanced === '1';
advancedToggle.checked = state.showAdvanced;

const emphasizeNotes = localStorage.getItem('camelot:emphasizeNotes') === '1';
notesToggle.checked = emphasizeNotes;
document.body.classList.toggle('emphasize-notes', emphasizeNotes);

const savedBpmOriginal = clampBpm(parseFloat(localStorage.getItem('camelot:bpmOriginal')));
const savedBpmActual = clampBpm(parseFloat(localStorage.getItem('camelot:bpmActual')));
state.bpmOriginal = savedBpmOriginal != null ? savedBpmOriginal : state.bpmOriginal;
state.bpmActual = savedBpmActual != null ? savedBpmActual : state.bpmActual;
bpmOriginalInput.value = String(state.bpmOriginal);
bpmActualInput.value = String(state.bpmActual);

const lastKey = localStorage.getItem('camelot:lastKey');
if (lastKey) {
  const m = lastKey.match(/^(\d+)([AB])$/);
  if (m && CAMELOT_TO_MUSICAL[lastKey]) {
    state.selectedNumber = parseInt(m[1], 10);
    state.selectedLetter = m[2];
  }
}
state.rotation = (getEffectiveKey().num - 1) * 30;

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
