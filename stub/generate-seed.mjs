import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = 0x6e756461; // "nuda"

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(SEED);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const ADJECTIVES = [
  'Latent', 'Golden', 'Quiet', 'Velvet', 'Northern', 'Amber', 'Midnight',
  'Paper', 'Salt', 'Glass', 'Copper', 'Wandering', 'Lantern', 'Marble',
  'Hollow', 'Slow', 'Bright', 'Winter', 'Static', 'Sable',
];

const NOUNS = [
  'Hours', 'Rooms', 'Letters', 'Mornings', 'Studies', 'Portraits', 'Notes',
  'Windows', 'Afternoons', 'Sketches', 'Frames', 'Sessions', 'Chapters',
  'Postcards', 'Rehearsals', 'Interiors', 'Fragments', 'Diaries',
];

const HANDLES = [
  'lumen_ash', 'juno_reyes', 'still_orbit', 'marta_vane', 'oak_and_iron',
  'pale_harbour', 'nine_lanterns', 'corvid_ln', 'saltmarsh', 'edie_frost',
  'quiet_atlas', 'north_of_here',
];

const REVIEW_BODIES = [
  'Exactly what the description promised, and the files were bigger than I expected.',
  'Good set. A couple of the frames repeat, but the rest carry it.',
  'The lighting in the second half is the reason to buy this one.',
  'Solid, though I would have liked a few more in the same series.',
  'Better than the preview suggests. The preview does it no favours.',
  'Downloaded fine, watermarking is unobtrusive, no complaints.',
  'Not quite my thing in the end, but the craft is obviously there.',
  'Third one I have bought from this creator and the most consistent.',
  'Worth it for the last eight alone.',
  'Arrived quickly and the quality holds up at full size.',
];

const REVIEWERS = [
  'quiet_reader', 'ash_and_ink', 'm_delacroix', 'seventeen_birds', 'oncewas',
  'tallgrass', 'blue_hour', 'penumbra_j', 'rook_and_key', 'small_hours',
];

const PLANTED = [
  { title: 'Latent Hours', handle: 'lumen_ash' },
  { title: 'Latitude, Late', handle: 'still_orbit' },
  { title: 'Latex and Lantern Light', handle: 'juno_reyes' },
];

const id = (n) => `pack_${String(n).padStart(4, '0')}`;
const mediaId = (n) => `med_${String(n).padStart(4, '0')}`;

function ratingOf(distribution) {
  const counts = Object.entries(distribution);
  const total = counts.reduce((n, [, c]) => n + c, 0);
  if (total === 0) return { rating: null, review_count: 0 };
  const sum = counts.reduce((n, [score, c]) => n + Number(score) * c, 0);
  return { rating: (Math.round((sum / total) * 10) / 10).toFixed(1), review_count: total };
}

const packs = [];

for (let i = 0; i < 60; i += 1) {
  const planted = PLANTED[i];
  const title = planted ? planted.title : `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  const handle = planted ? planted.handle : pick(HANDLES);

  const unrated = i % 17 === 0;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!unrated) {
    const volume = between(3, 40);
    for (let r = 0; r < volume; r += 1) {
      const roll = rand();
      const score = roll < 0.52 ? 5 : roll < 0.78 ? 4 : roll < 0.9 ? 3 : roll < 0.96 ? 2 : 1;
      distribution[score] += 1;
    }
  }

  const { rating, review_count } = ratingOf(distribution);

  let can_review = true;
  let reason = null;
  if (i % 11 === 3) { can_review = false; reason = 'already_reviewed'; }
  else if (i % 11 === 7) { can_review = false; reason = 'not_purchased'; }
  else if (i % 23 === 5) { can_review = false; reason = 'pack_removed'; }

  const reviews = [];
  const shown = Math.min(review_count, between(2, 6));
  for (let r = 0; r < shown; r += 1) {
    reviews.push({
      id: `rev_${String(i).padStart(4, '0')}_${r}`,
      author_handle: pick(REVIEWERS),
      score: between(3, 5),
      body: pick(REVIEW_BODIES),
      created_at: new Date(Date.UTC(2026, 0, 1 + between(0, 200), between(0, 23), between(0, 59))).toISOString(),
    });
  }
  reviews.sort((a, b) => b.created_at.localeCompare(a.created_at));

  packs.push({
    id: id(i),
    title,
    creator_handle: handle,
    price_cents: pick([599, 899, 1199, 1499, 1999, 2499, 2999, 3999, 4999]),
    cover_media_id: mediaId(i),
    description:
      `${between(12, 80)} files, delivered privately and watermarked per buyer. ` +
      'Shot over a single season and sequenced rather than dumped. ' +
      'Full resolution, no upscaling, no third-party hosting.',
    rating,
    review_count,
    distribution,
    can_review,
    reason,
    reviews,
    created_at: new Date(Date.UTC(2025, 5, 1 + i * 3, 9, 30)).toISOString(),
  });
}

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'packs.seed.json'), `${JSON.stringify(packs, null, 2)}\n`, 'utf8');

const rated = packs.filter((p) => p.rating !== null).length;
console.log(`packs.seed.json: ${packs.length} packs, ${rated} rated, ${packs.length - rated} unrated`);
console.log(`can_review false: ${packs.filter((p) => !p.can_review).length}`);
