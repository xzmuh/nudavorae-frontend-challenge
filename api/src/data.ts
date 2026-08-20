import { intBetween, mulberry32, pick, pickMany } from './rng.ts';
import type { Review, Service, Seller } from './types.ts';

const SEED = 20260819;
const SERVICE_COUNT = 2400;

export const CATEGORIES = [
  { id: 'ai-ml', label: 'AI & Machine Learning' },
  { id: 'web-dev', label: 'Web Development' },
  { id: 'mobile', label: 'Mobile Apps' },
  { id: 'design', label: 'Design & Branding' },
  { id: 'video', label: 'Video & Animation' },
  { id: 'writing', label: 'Writing & Translation' },
  { id: 'data', label: 'Data & Analytics' },
  { id: 'marketing', label: 'Marketing & Growth' },
  { id: 'audio', label: 'Audio & Voice' },
] as const;

const SUBJECTS: Record<string, string[]> = {
  'ai-ml': [
    'LLM agent', 'RAG pipeline', 'Sora video model', 'fine-tuned classifier',
    'prompt system', 'vector search', 'computer vision model', 'speech-to-text stack',
    'recommendation engine', 'AI chatbot', 'model evaluation suite', 'sorting-aware ranker',
  ],
  'web-dev': [
    'React dashboard', 'Next.js storefront', 'design system', 'headless CMS setup',
    'Node API', 'performance audit', 'accessibility pass', 'Stripe integration',
    'GraphQL gateway', 'component library', 'legacy migration', 'edge runtime setup',
  ],
  mobile: [
    'React Native app', 'Flutter MVP', 'App Store launch kit', 'push notification stack',
    'offline-first sync', 'in-app purchase setup', 'mobile design handoff', 'crash triage',
  ],
  design: [
    'brand identity', 'sorveteria brand kit', 'landing page design', 'pitch deck',
    'packaging design', 'icon set', 'motion brand guide', 'UI kit', 'logo refresh',
    'social template pack', 'editorial layout', 'illustration set',
  ],
  video: [
    'product demo edit', 'YouTube shorts pack', 'motion graphics intro', 'explainer animation',
    'sorvete commercial cut', 'reels editing', 'color grading', '3D product render',
  ],
  writing: [
    'SEO article set', 'technical documentation', 'landing copy', 'newsletter series',
    'case study', 'pt-BR localization', 'script writing', 'brand voice guide',
  ],
  data: [
    'analytics setup', 'dbt model pack', 'Looker dashboard', 'churn model',
    'data warehouse migration', 'sorting benchmark report', 'ETL pipeline', 'A/B test analysis',
  ],
  marketing: [
    'growth audit', 'paid social sprint', 'lifecycle email flows', 'SEO teardown',
    'ASO package', 'landing experiment plan', 'creator campaign', 'CRO sprint',
  ],
  audio: [
    'podcast edit', 'voice-over session', 'sound design pack', 'audio mastering',
    'jingle production', 'sorvete jingle', 'audiobook narration', 'noise cleanup',
  ],
};

const QUALIFIERS = [
  'Premium', 'Complete', 'Express', 'Studio', 'Signature', 'Pro', 'Essential',
  'Advanced', 'Hands-on', 'End-to-end', 'Boutique', 'Senior-level',
];

const OUTCOMES = [
  'delivered in a single sprint',
  'with unlimited revisions',
  'built for scale',
  'documented from day one',
  'ready to ship',
  'with a live handover call',
  'tuned for conversion',
  'with source files included',
];

const SUMMARIES = [
  'A focused engagement with clear scope, weekly checkpoints and files you actually own.',
  'Everything is versioned, reviewed and handed over with a written walkthrough.',
  'Built to be maintained by your team, not to lock you into me.',
  'Includes discovery, execution and a follow-up window for adjustments.',
  'Senior execution without the agency overhead or the endless kickoff calls.',
  'Scoped in hours, not vibes. You get an estimate before anything starts.',
];

const DESCRIPTION_BLOCKS = [
  'I have shipped this exact deliverable more than sixty times, for teams between two and four hundred people. The process is boring on purpose: we agree on scope, I work in the open, and you review at fixed checkpoints.',
  'What you receive: the production files, a short written handover, and a recorded walkthrough of every decision that is not obvious from the artifact itself.',
  'Revisions are included inside the agreed scope. Anything outside of it gets a separate estimate before a single hour is spent, so the price you see is the price you pay.',
  'Timeline starts when the brief is approved. Most projects land inside the estimated window; if something slips, you hear about it the same day, not at the deadline.',
];

const FIRST_NAMES = [
  'Alice', 'Bruno', 'Camila', 'Diego', 'Elena', 'Felipe', 'Giulia', 'Hugo', 'Isabel',
  'Jonas', 'Karla', 'Lucas', 'Mariana', 'Nuno', 'Olivia', 'Pedro', 'Quiara', 'Rafael',
  'Sofia', 'Tomas', 'Ursula', 'Victor', 'Wanda', 'Xavier', 'Yara', 'Zeca',
];

const LAST_NAMES = [
  'Almeida', 'Barros', 'Castro', 'Duarte', 'Esteves', 'Ferraz', 'Gomes', 'Henriques',
  'Iglesias', 'Justino', 'Klein', 'Lopes', 'Moraes', 'Nogueira', 'Oliveira', 'Pires',
  'Queiroz', 'Ramos', 'Silveira', 'Tavares', 'Uchoa', 'Vieira', 'Werner', 'Xavier',
];

const COUNTRIES = ['Brazil', 'Portugal', 'Spain', 'Argentina', 'Mexico', 'Canada', 'Germany'];

const REVIEW_COMMENTS = [
  'Delivered ahead of schedule and the handover doc alone was worth the price.',
  'Communication was excellent. Asked the right questions before writing any code.',
  'The result matched the brief exactly, and the revisions were quick and precise.',
  'Great work overall. A couple of small details needed a second pass, nothing blocking.',
  'Professional from start to finish. Would hire again for the next phase.',
  'Solid execution. The documentation made onboarding my team trivial.',
  'Understood the product context immediately, which saved us at least a week.',
  'Good outcome, though the first draft needed more polish than I expected.',
];

const LEVELS = ['new', 'rising', 'top', 'elite'] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSellers(rand: () => number): Seller[] {
  const list: Seller[] = [];
  for (let i = 0; i < 320; i += 1) {
    const first = pick(rand, FIRST_NAMES);
    const last = pick(rand, LAST_NAMES);
    const name = `${first} ${last}`;
    const handle = `${slugify(first)}.${slugify(last)}${intBetween(rand, 1, 99)}`;
    list.push({
      id: `sel_${String(i + 1).padStart(4, '0')}`,
      name,
      handle,
      avatarImageId: `avatar-${slugify(name)}-${i}`,
      verified: rand() > 0.45,
      followers: intBetween(rand, 0, 18400),
      level: pick(rand, LEVELS),
      country: pick(rand, COUNTRIES),
    });
  }
  return list;
}

function buildServices(rand: () => number, sellerList: Seller[]): Service[] {
  const list: Service[] = [];
  const now = Date.UTC(2026, 7, 19);
  const day = 86_400_000;

  for (let i = 0; i < SERVICE_COUNT; i += 1) {
    const category = pick(rand, CATEGORIES);
    const subjects = SUBJECTS[category.id] ?? ['custom project'];
    const subject = pick(rand, subjects);
    const title = `${pick(rand, QUALIFIERS)} ${subject} ${pick(rand, OUTCOMES)}`;
    const seller = pick(rand, sellerList);
    const ratingCount = rand() > 0.12 ? intBetween(rand, 1, 480) : 0;
    const averageTarget = 3.2 + rand() * 1.8;

    list.push({
      id: `svc_${String(i + 1).padStart(5, '0')}`,
      slug: `${slugify(subject)}-${i + 1}`,
      title,
      summary: pick(rand, SUMMARIES),
      description: pickMany(rand, DESCRIPTION_BLOCKS, 3).join('\n\n'),
      category: category.id,
      tags: pickMany(rand, [...subjects, 'remote', 'async', 'fixed price', 'senior'], 3).map(slugify),
      priceCents: intBetween(rand, 1, 240) * 500 + 900,
      currency: 'USD',
      deliveryDays: intBetween(rand, 1, 30),
      filesCount: intBetween(rand, 1, 24),
      ratingSum: Math.round(averageTarget * ratingCount),
      ratingCount,
      seller,
      coverImageId: `cover-${i + 1}`,
      galleryImageIds: Array.from(
        { length: intBetween(rand, 2, 5) },
        (_, g) => `gallery-${i + 1}-${g + 1}`,
      ),
      createdAt: new Date(now - intBetween(rand, 0, 900) * day).toISOString(),
    });
  }

  return list;
}

function buildReviews(
  rand: () => number,
  serviceList: Service[],
  sellerList: Seller[],
): Map<string, Review[]> {
  const byService = new Map<string, Review[]>();
  const now = Date.UTC(2026, 7, 19);
  const day = 86_400_000;

  for (const service of serviceList) {
    const visible = Math.min(service.ratingCount, intBetween(rand, 0, 8));
    const list: Review[] = [];
    for (let i = 0; i < visible; i += 1) {
      const author = pick(rand, sellerList);
      const average = service.ratingSum / Math.max(1, service.ratingCount);
      list.push({
        id: `rev_${service.id}_${i + 1}`,
        serviceId: service.id,
        authorName: author.name,
        authorHandle: author.handle,
        authorAvatarImageId: author.avatarImageId,
        rating: Math.max(1, Math.min(5, Math.round(average + (rand() - 0.5)))),
        comment: pick(rand, REVIEW_COMMENTS),
        createdAt: new Date(now - intBetween(rand, 1, 400) * day).toISOString(),
      });
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    byService.set(service.id, list);
  }

  return byService;
}

const rand = mulberry32(SEED);

export const sellers: Seller[] = buildSellers(rand);
export const services: Service[] = buildServices(rand, sellers);
export const servicesById = new Map<string, Service>(services.map((service) => [service.id, service]));
export const reviewsByServiceId: Map<string, Review[]> = buildReviews(rand, services, sellers);

export const priceRange = {
  minCents: services.reduce((min, service) => Math.min(min, service.priceCents), Number.POSITIVE_INFINITY),
  maxCents: services.reduce((max, service) => Math.max(max, service.priceCents), 0),
};
