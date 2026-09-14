# Wheely Good DJ — blog notes

Single-post draft this time, no acts. Rough, tighten wherever it's flabby.

---

A DJ asked for an app that does what the Camelot wheel already does on the wall of every booth: tell you which key you're in, and which other keys will mix cleanly with it. Nothing fancy — no login, no backend, no database, because there's genuinely nothing to store. There are only 24 keys in the whole system (1A–12A minor, 1B–12B major), and which ones get along isn't opinion, it's arithmetic.

So that's what we built it as. Instead of a hand-typed table of "if you're on 8A, here are your 6 friends," a key is just a `(number, letter)` pair, and "what mixes" falls straight out of doing sums on that pair — no 24-entry map to type out, and nothing to get subtly wrong at 11pm before a gig:

```js
function getCompatibleKeys(num, letter) {
  const results = [];
  const push = (n, l, relation, tier) => {
    results.push({ id: keyId(mod12(n), l), relation, tier });
  };

  // safe: relative major/minor, and the perfect-fifth neighbours either side
  push(num, otherLetter(letter), 'Relative', 1);
  push(num + 1, letter, 'Neighbour +1', 1);
  push(num - 1, letter, 'Neighbour -1', 1);

  // advanced, behind a toggle: energy moves and the diagonal mood shift
  push(num + 2, letter, 'Energy Lift (+2)', 2);
  push(num - 2, letter, 'Energy Drop (-2)', 2);
  push(num + 7, letter, 'Semitone Up (+7)', 2);   // classic peak-time trick
  push(num - 7, letter, 'Semitone Down (-7)', 2);
  push(num + 1, otherLetter(letter), 'Diagonal +1', 2);
  push(num - 1, otherLetter(letter), 'Diagonal -1', 2);

  return results;
}
```

Same number, flip the letter, that's relative major/minor. Add or subtract 1 on the same letter, that's a perfect-fifth neighbour — the safe, always-works stuff. Everything past that (±2 for an energy lift, ±7 for a semitone shift, the diagonal move) sits behind an "advanced moves" toggle so the obvious choices don't get buried under the clever ones. The whole compatibility engine is about thirty lines.

The interesting bit wasn't the logic, though, it was making a wheel feel like a wheel on a phone screen. First pass was just a flat list — tap a key, get a result. Fine, but it didn't feel like *the* wheel every DJ already has muscle memory for. So the real version renders the full 24-key wheel at its actual angles and then parks the centre of that circle off-screen to the left, so only a curved sliver of it — your current key plus a couple of neighbours either side, fading and shrinking the further round the curve — actually shows on screen. Swipe it (or use the up/down arrows) and it spins with real momentum, then settles with an actual spring simulation rather than a canned CSS easing curve, which is what gives it that slight overshoot-and-bounce-back on release instead of a dead stop:

```js
function animateRotationTo(target, initialVelocity = 0) {
  let pos = state.rotation, vel = initialVelocity;
  const stiffness = 180, damping = 16;
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
      requestAnimationFrame(step);
    } else {
      state.rotation = target;
      renderWheelPositions();
    }
  }
  requestAnimationFrame(step);
}
```

It's a proper mass-spring-damper running every frame rather than an easing function — pull towards the target, subtract a bit of velocity for damping, integrate, repeat until it's basically stopped. That's the whole "rubber band" feel in about ten lines.

Worth a paragraph on its own: that same drag handling almost shipped a bug where tapping a key just silently didn't work — no errors, nothing in the console, it simply ate the click. Turned out to be `setPointerCapture` being called the instant you touched the wheel "just in case" it became a swipe, which quietly breaks Chromium's native click dispatch on whatever button was underneath your finger. Screenshots looked completely fine throughout, because the bug only shows up when something actually gets clicked, not when a page merely renders. Fixed by only grabbing pointer capture once real movement is detected, which is the more general lesson: a screenshot proves a page painted, it doesn't prove a button works.

Once the wheel actually felt good, the rest was making it look like it belonged in a DJ's hand rather than a spreadsheet. Turns out real DJ software doesn't write "A minor" or "C major" — major keys just get the bare note name (`C`), minor keys get a trailing `m` (`Am`) — so the label table got rewritten to match what a DJ's eyes are actually used to, with a toggle to flip which label (Camelot code or note name) is the big one, since different people think in different systems. Then a full pass on personality: bought `wheelygooddj.com`, gave it a name and a typeface with a bit of character, swapped flat black for navy with a few very subtle randomly-placed colour blobs behind everything, and gave the keys themselves a spring-y hover bounce and glow so tapping one doesn't feel like pressing a spreadsheet cell.

That pass also produced a good little lesson in not blaming the wrong suspect: after it, the wheel looked like it had drifted off a clean 50/50 split down the middle of the screen, and the new background gradients got blamed. They were innocent — a CSS `background-image` cannot, under any circumstances, move or resize another element. It's paint, not geometry. The actual cause was a width change made a few steps earlier to stop the bigger keys clipping off the edge on a phone; the fix was putting the split back to a true 50/50 and shrinking the keys slightly instead, so the original fit problem went away for the right reason rather than papering over it with a wider column. A second, smaller bug in the same round — a hover glow that looked "slightly cut" on the right edge — got settled the same honest way: rather than squinting at a screenshot, sampling the actual rendered pixel colours in a line across the edge to see exactly where the glow faded to nothing versus where the clipping boundary sat. It turned out to be fading to background colour *exactly* at the clip line — technically not broken, but with zero margin for error on a different screen. Gave it real clearance and a tighter blur radius, then re-measured the same way to prove it, rather than eyeballing it again and hoping.

Next up is the actually hard part: working out your key from the microphone instead of typing it in. The pipeline itself is well-trodden — listen, run an FFT, fold the spectrum into a 12-bin chromagram, correlate it against the profile of all 24 keys, pick the winner — and a library like `essentia.js` gets you there fast with a key-detector that's actually tuned for electronic music rather than orchestral recordings. The honest catch is the microphone itself: a phone in a booth hears the room, not the mix, it hears two tracks blended together mid-transition, and a browser's default echo-cancellation, noise-suppression and auto-gain settings all mangle the exact frequency content the algorithm needs — every one of them has to be explicitly switched off in the mic constraints. Realistic accuracy off a room mic is somewhere around 60–75%, and the saving grace is that most of the mistakes are relative major/minor mix-ups, which land on the *same number* on the Camelot wheel anyway — so most of the errors are harmless for what a DJ's actually trying to do with the answer. A line-in from the mixer, or just analysing a dropped-in track file, would both do noticeably better. That's the next post.
