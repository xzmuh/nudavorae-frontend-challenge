# Nudavorae — frontend challenge

Two screens — the catalogue and a pack — in Angular 20, against the starter's
stub on port 4010.

## Run

```bash
npm install
npm start
```

The app is on <http://localhost:4200> and the stub on <http://localhost:4010>.
Node 22 LTS or newer (`.nvmrc`).

```bash
npm test              # the RF2 and RF7 specs, plus the RF4 keyboard one
                      # and the RF6 one that pins *when* the scroll offset is read
npm run build
npm run lint:tokens   # fails on a colour, or a primitive, outside the token files
```

## How to break it

The stub's three levers are read from the **page** URL and travel to every
request the app makes while they are there. So they go in the address bar of the
app, not of the stub, and nothing in the app persists them or pushes a history
entry for them.

**Slow — a delayed search (RF2).**

```
http://localhost:4200/?delay=3000
```

Type `lat`, wait a beat, then finish the word to `latex`. `lat` matches eight
packs and `latex` matches one, so the two answers look nothing alike: the answer
for `lat` arrives last and never reaches the screen.

**Empty — a page with no items.**

```
http://localhost:4200/?empty=1
http://localhost:4200/?empty=1&q=latex
```

Two different screens, deliberately: an empty catalogue, and a search that found
nothing.

```
http://localhost:4200/packs/pack_0001?empty=1
```

The same lever on a pack empties the review list but leaves the permission
alone — "no reviews yet, and you may write the first".

**Failed — an error with a message.**

```
http://localhost:4200/?fail=500
```

For the failing **POST** of RF5, open a pack that you are allowed to review and
add the lever once it has loaded:

```
http://localhost:4200/packs/pack_0001
                                        ← then edit the address bar to:
http://localhost:4200/packs/pack_0001?fail=500
```

Nothing refetches when you do that — the levers are not application state — so
the pack stays on screen and only the review you publish carries the failure.
The average moves the moment you press publish, then rolls back with the stub's
own message, and your text is still in the field.

Other statuses work the same way: `?fail=503`, `?fail=422`, `?fail=429`. Levers
combine: `?delay=1500&fail=500`.

## Packs that reach each state

| Pack | What the stub answers |
| --- | --- |
| `pack_0001` | you can write a review |
| `pack_0000` | you can write the first — `rating` is `null`, not `0.0` |
| `pack_0003` | `already_reviewed` |
| `pack_0007` | `not_purchased` |
| `pack_0028` | `pack_removed` |

Publish a review on `pack_0001` and the stub attributes it to `you`: the form
then opens prefilled, as the review you may change. Writes live in memory, so a
restart of the stub puts every pack back.

## What this is built out of

Page 5 rules out a component library, a utility CSS framework and a store
library. So, in full — every runtime dependency in `app/package.json`, with
nothing elided:

| | |
| --- | --- |
| `@angular/core`, `common`, `router`, `forms`, `compiler`, `platform-browser` | the framework |
| `@angular/cdk` | `LiveAnnouncer`, and nothing else. Page 5: "the CDK is not one of those: it is behaviour without an opinion." |
| `rxjs`, `tslib` | one stream, and the compiler's helpers |

The `devDependencies` are the Angular CLI and build, and Karma with Jasmine.
None of them reaches the browser.

So there is no Material, PrimeNG, Taiga, Tailwind, Bootstrap, NgRx, NGXS or Elf,
and no icon package either: every glyph on screen is an inline `<svg>` path in
the component that draws it.

Which means the controls are hand-built, and there are four of them:

- **the rating input** — five real radios in a `fieldset`, so the group is one
  tab stop with arrow keys, Home/End and wrapping from the browser;
- **the pack card**, **the three-state panel** and **the theme switch** — the
  last one three radios, because there are two themes and `system` is the
  absence of a choice rather than a third;
- **the sort control is a native `<select>`**, deliberately. It is styled to
  match the search field, but the list is the operating system's: no hand-built
  listbox is going to beat the platform on focus, keyboard and announcement, and
  page 5 asks for the four things you need rather than a fifth you do not.

State is signals in two root-provided services and one route-provided one, which
is what page 5 says it expects to see instead of a store library.

## What moved, and the one thing that changed

The starter is intact and at the root, with the application in `app/` where
`scripts/dev.mjs` expects it. `stub/`, `tokens/palette.css` and `assets/fonts/`
are the starter's files, unedited.

One change, because the starter asks that changes be named: `scripts/dev.mjs`
spawned both children with `shell: true` on Windows, which concatenates rather
than escapes. The stub is spawned as `process.execPath`, and on a default
Windows install that is `C:\Program Files\nodejs\node.exe` — the shell split it
at the space and `npm start` never started the stub. The shell is now asked for
only by the child that needs it, `npm`. The stub itself is untouched.

```
app/      the Angular application
stub/     the starter's stub, unedited          (port 4010)
tokens/   the starter's primitives, unedited
assets/   the starter's self-hosted fonts
scripts/  dev.mjs (starter, one fix) and the token check
```

`proxy.conf.example.json` is left where the starter put it and is not used: the
app talks to `http://localhost:4010` directly, which the stub's CORS headers
allow.
