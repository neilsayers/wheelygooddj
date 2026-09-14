# Wheely Good DJ

A free, single-page tool for DJs: pick the Camelot key you're mixing in and
instantly see every key that mixes cleanly with it — from the safe,
always-works neighbours through to advanced energy moves, laid out on a
wheel that behaves like the physical one on the booth wall.

**Live:** https://wheelygooddj.com

## How it works

There are only 24 keys in the Camelot system (1A–12A minor, 1B–12B major),
and compatibility between them is arithmetic, not a lookup table — a key
is a `(number, letter)` pair, and "what mixes" falls out of doing sums on
that pair:

- **Relative** — same number, other letter (relative major/minor)
- **Neighbour ±1** — same letter, adjacent number (perfect-fifth either side)
- *Advanced, behind a toggle:* **Energy Lift/Drop (±2)**, **Semitone Up/Down
  (±7)**, and the **Diagonal ±1** mood shift

No login, no backend, no database — there's nothing to store.

## Tech

Vanilla HTML/CSS/JS, no build step, no dependencies. Installable as a PWA
(manifest + service worker, offline-capable). Deployed as static files.

## Running locally

Just serve the folder — e.g. `npx serve .` or Python's
`python3 -m http.server` — and open it in a browser. No build/install step.

## License

All rights reserved — see [LICENSE](LICENSE). The hosted tool is free for
anyone to use; the source is not licensed for reuse.
