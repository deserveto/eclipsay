/**
 * Fetch all 78 RWS card images from Wikimedia Commons into
 * public/cards/rws/{cardId}.jpg — original 1909 Pamela Colman Smith scans,
 * US public domain (plan: Static tarot data).
 *
 * One-time script; no runtime fetching anywhere in the app.
 * Idempotent: existing files are skipped. Throttled + backoff for Commons 429s.
 * Usage: npx tsx scripts/fetch-card-images.ts
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.resolve('public/cards/rws');
const UA = 'EclipsayMVP/1.0 (local development; contact: dev@eclipsay.local)';
const WIDTH = 768;

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

// cardId → Commons file title. Majors + 54 minors use the cleaned
// "(Rider-Waite Smith tarot deck)" series; two aces fall back to the RWS1909 scans.
const MANIFEST: Record<string, string> = {
  the_fool: 'RWS_Tarot_00_Fool.jpg',
  the_magician: 'RWS_Tarot_01_Magician.jpg',
  the_high_priestess: 'RWS_Tarot_02_High_Priestess.jpg',
  the_empress: 'RWS_Tarot_03_Empress.jpg',
  the_emperor: 'RWS_Tarot_04_Emperor.jpg',
  the_hierophant: 'RWS_Tarot_05_Hierophant.jpg',
  the_lovers: 'RWS_Tarot_06_Lovers.jpg',
  the_chariot: 'RWS_Tarot_07_Chariot.jpg',
  strength: 'RWS_Tarot_08_Strength.jpg',
  the_hermit: 'RWS_Tarot_09_Hermit.jpg',
  wheel_of_fortune: 'RWS_Tarot_10_Wheel_of_Fortune.jpg',
  justice: 'RWS_Tarot_11_Justice.jpg',
  the_hanged_man: 'RWS_Tarot_12_Hanged_Man.jpg',
  death: 'RWS_Tarot_13_Death.jpg',
  temperance: 'RWS_Tarot_14_Temperance.jpg',
  the_devil: 'RWS_Tarot_15_Devil.jpg',
  the_tower: 'RWS_Tarot_16_Tower.jpg',
  the_star: 'RWS_Tarot_17_Star.jpg',
  the_moon: 'RWS_Tarot_18_Moon.jpg',
  the_sun: 'RWS_Tarot_19_Sun.jpg',
  judgement: 'RWS_Tarot_20_Judgement.jpg',
  the_world: 'RWS_Tarot_21_World.jpg',
};

const RANKS = [
  'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Page', 'Knight', 'Queen', 'King',
] as const;
const SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'] as const;
const SUIT_DIRS: Record<string, string> = {
  Wands: 'wands',
  Cups: 'cups',
  Swords: 'swords',
  Pentacles: 'pentacles',
};

for (const suit of SUITS) {
  RANKS.forEach((rank) => {
    const id = `${rank.toLowerCase()}_of_${SUIT_DIRS[suit]}`;
    if (id === 'ace_of_swords') MANIFEST[id] = 'RWS1909 - Swords 01.jpeg';
    else if (id === 'ace_of_pentacles') MANIFEST[id] = 'RWS1909 - Pentacles 01.jpeg';
    else MANIFEST[id] = `${rank} of ${suit} (Rider-Waite Smith tarot deck).png`;
  });
}

async function thumbUrl(title: string): Promise<string> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(WIDTH),
    titles: `File:${title}`,
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${title}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> };
  };
  const pages = Object.values(data.query?.pages ?? {});
  const info = pages[0]?.imageinfo?.[0];
  if (!info) throw new Error(`No imageinfo for ${title}`);
  return info.thumburl ?? info.url ?? '';
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.max(retryAfter * 1000, 2500 * (attempt + 1)));
      continue;
    }
    throw new Error(`download ${res.status}`);
  }
  throw new Error('download retries exhausted');
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const ids = Object.keys(MANIFEST);
  let ok = 0;
  const failed: string[] = [];

  for (const id of ids) {
    const dest = path.join(OUT_DIR, `${id}.jpg`);
    if (existsSync(dest)) {
      ok++;
      continue;
    }
    try {
      const url = await thumbUrl(MANIFEST[id]);
      const buf = await download(url);
      await sharp(buf).resize({ width: WIDTH, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(dest);
      ok++;
      process.stdout.write(`ok ${id}\n`);
      await sleep(1200);
    } catch (err) {
      failed.push(id);
      process.stdout.write(`FAIL ${id}: ${err instanceof Error ? err.message : String(err)}\n`);
      await sleep(2500);
    }
  }

  process.stdout.write(`\nDownloaded/verified ${ok}/${ids.length}\n`);
  if (failed.length > 0) {
    process.stdout.write(`Failed: ${failed.join(', ')}\n`);
    process.exit(1);
  }
}

main();
