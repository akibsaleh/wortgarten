#!/usr/bin/env node
// Phase 0 — Deterministic parser: top-1000-german-words.md → words.json
// No LLM anywhere in the pipeline. Pure string manipulation.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'top-1000-german-words.md');
const OUT = join(ROOT, 'src', 'assets', 'words.json');

const DATA_VERSION = '2026-09-16-1';

// ---------------------------------------------------------------------------
// Theme mapping (Themenfeld → slug). ~30 units per PLAN.md §2.
// ---------------------------------------------------------------------------
const THEME_MAP = {
  'Alltag & Begrüßung': 'essentials',
  'Bildung & Sprache': 'education',
  'Reisen & Verkehr': 'travel',
  'Freizeit & Sport': 'leisure',
  'Familie & Soziales': 'people-family',
  'Medien & IT': 'media',
  'Arbeit & Beruf': 'work',
  'Essen & Trinken': 'food',
  'Wohnen & Haushalt': 'home',
  'Einkaufen & Finanzen': 'shopping',
  'Gesundheit & Körper': 'health',
  'Natur & Wetter': 'nature',
  'Gesellschaft & Kultur': 'society-culture',
  'Charakter & Gefühle': 'feelings',
  'Grammatik & Struktur': 'grammar',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase, ä→ae / ö→oe / ü→ue / ß→ss, spaces→-, strip punctuation. */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Strip leading article (der/die/das/dem/den/des) from a headword. */
function stripArticle(str) {
  return str.replace(/^(der|die|das|dem|den|des)\s+/, '');
}

const UMLAUT_FORWARD = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' };

/** Apply umlaut to the last umlautable vowel (or diphthong au→äu). */
function applyUmlaut(word) {
  // Handle "au" → "äu" first (Haus → Häuser)
  if (/au/.test(word)) {
    return word.replace(/au/, 'äu');
  }
  // Find last single vowel that can take umlaut
  for (let i = word.length - 1; i >= 0; i--) {
    if (UMLAUT_FORWARD[word[i]]) {
      return word.slice(0, i) + UMLAUT_FORWARD[word[i]] + word.slice(i + 1);
    }
  }
  return word;
}

/**
 * Pre-compute cloze data: blank the lemma's exact surface form in example_de.
 * Deterministic, case-insensitive, unicode-aware word boundary (\b fails for
 * lemmas starting with umlauts, e.g. "Österreich"). Returns nulls when the
 * lemma doesn't appear verbatim (separable verbs, inflected-only forms) —
 * such words never get cloze cards.
 */
function computeCloze(exampleDe, lemma) {
  const EMPTY = { cloze_sentence: null, cloze_answer: null };
  if (!exampleDe || !lemma) return EMPTY;
  const escaped = lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    'iu',
  );
  const m = exampleDe.match(re);
  if (!m) return EMPTY;
  return {
    cloze_sentence: exampleDe.replace(re, '_____'),
    cloze_answer: m[0], // the exact surface form that appeared in the sentence
  };
}

// ---------------------------------------------------------------------------
// Noun parsing
// ---------------------------------------------------------------------------

/**
 * Parse a noun headword like:
 *   "der Automat, -en"     → { gender: 'der', lemma: 'Automat', plural: 'Automaten' }
 *   "das Buch, ¨-er"       → { gender: 'das', lemma: 'Buch',  plural: 'Bücher' }
 *   "die Familie, -n"      → { gender: 'die', lemma: 'Familie', plural: 'Familien' }
 *   "der Computer, -"      → { gender: 'der', lemma: 'Computer', plural: 'Computer' }
 *   "der Bruder, ¨"        → { gender: 'der', lemma: 'Bruder', plural: 'Brüder' }
 *   "die Eltern"           → Pluraliatantum → { gender: null, lemma: 'Eltern', plural: 'Eltern' }
 *   "der Durst"            → Singulariatantum → { gender: 'der', lemma: 'Durst', plural: null }
 *   "Deutschland"          → Proper noun → { gender: null, lemma: 'Deutschland', plural: null }
 *   "die Niederlande"      → Pluraliatantum proper → { gender: null, lemma: 'Niederlande', plural: 'Niederlande' }
 */
function parseNoun(headword, grammatik) {
  // Strip (Pl.) marker from headword
  const hw = headword.trim().replace(/\s*\(Pl\.\)\s*$/, '');
  const gk = grammatik.trim();

  // Pluraliatantum (no singular exists)
  if (gk.includes('Pluraliatantum')) {
    // "die Eltern", "die Niederlande", "Kopfschmerzen"
    const m = hw.match(/^(der|die|das)\s+(.+)$/);
    if (m) {
      return { gender: null, lemma: m[2].trim(), plural: m[2].trim() };
    }
    // No article (Kopfschmerzen, Schmerzen)
    return { gender: null, lemma: hw, plural: hw };
  }

  // Singulariatantum (no plural)
  if (gk.includes('Singulariatantum')) {
    const m = hw.match(/^(der|die|das)\s+(.+)$/);
    if (m) {
      return { gender: m[1], lemma: m[2].trim(), plural: null };
    }
    return { gender: null, lemma: hw, plural: null };
  }

  // Proper noun without article (Deutschland, Österreich) — "ohne Artikel" in Grammatik
  if (!/^(der|die|das)\s/.test(hw) && gk.includes('ohne Artikel')) {
    return { gender: null, lemma: hw, plural: null };
  }

  // No article prefix (compound noun like "erste Eindruck") — extract gender+plural from Grammatik
  if (!/^(der|die|das)\s/.test(hw)) {
    const genderFromGk = extractGenderFromGrammatik(gk);
    const pluralFromGk = extractPluralFromGrammatik(gk);
    return { gender: genderFromGk, lemma: hw, plural: pluralFromGk };
  }

  // Standard noun: "article, lemma, plural-notation"
  const m = hw.match(/^(der|die|das)\s+(.+?)(?:,\s*(.+))?$/);
  if (!m) {
    // No article prefix (compound noun like "erste Eindruck") — extract gender+plural from Grammatik
    const genderFromGk = extractGenderFromGrammatik(gk);
    const pluralFromGk = extractPluralFromGrammatik(gk);
    return { gender: genderFromGk, lemma: hw, plural: pluralFromGk };
  }

  const gender = m[1];
  const lemma = m[2].trim();
  const notation = m[3] ? m[3].trim() : null;

  if (!notation) {
    // No comma notation — try extracting plural from Grammatik, else Singulariatantum
    const pluralFromGk = extractPluralFromGrammatik(gk);
    return { gender, lemma, plural: pluralFromGk };
  }

  // "-" → unchanged
  if (notation === '-') return { gender, lemma, plural: lemma };

  // Pluraliatantum with dash (e.g. "die Geschwister, -")
  if (notation === '-' && gk.includes('Pluraliatantum')) {
    return { gender: null, lemma, plural: lemma };
  }

  // Compute plural from notation
  const plural = computePlural(lemma, notation);
  return { gender, lemma, plural };
}

/**
 * Extract plural form from Grammatik column when headword notation is missing.
 * Handles patterns like "Pl. erste Eindrücke", "Pl. Partizipien II", "Pl. -en".
 * Returns the explicit plural string or null.
 */
function extractPluralFromGrammatik(gk) {
  // Only extract if "Pl." is a main declaration (not inside parentheses).
  // "m., Pl. erste Eindrücke" → "erste Eindrücke"
  // "m., Ratschlag (Pl. Ratschläge)" → null (secondary note)
  const parenIdx = gk.indexOf('(');
  const beforeParen = parenIdx >= 0 ? gk.slice(0, parenIdx) : gk;
  const explicit = beforeParen.match(/Pl\.\s+(.+?)$/);
  if (explicit) {
    return explicit[1].trim() || null;
  }
  return null;
}

/**
 * Extract gender from Grammatik column for article-less nouns.
 * Handles "m., ..." / "f., ..." / "n., ..." at the start.
 */
function extractGenderFromGrammatik(gk) {
  const m = gk.match(/^([mfn])\./);
  if (!m) return null;
  return { m: 'der', f: 'die', n: 'das' }[m[1]];
}

/** Compute plural form from headword notation like "-en", "¨-er", "-e", "-n", "-s", "¨-e", "¨". */
function computePlural(lemma, notation) {
  // "¨-er" → umlaut + "-er"
  if (notation === '¨-er' || notation === '¨-e') {
    const suffix = notation === '¨-er' ? 'er' : 'e';
    return applyUmlaut(lemma) + suffix;
  }
  // "¨" → umlaut only
  if (notation === '¨') {
    return applyUmlaut(lemma);
  }
  // "-en", "-er", "-e", "-n", "-s", "-nen", "-ina"
  const suffix = notation.replace(/^-/, '');
  return lemma + suffix;
}

// ---------------------------------------------------------------------------
// Verb parsing
// ---------------------------------------------------------------------------

const SEPARABLE_PREFIXES = [
  'ab',
  'an',
  'auf',
  'aus',
  'bei',
  'da',
  'durch',
  'ein',
  'fest',
  'fort',
  'her',
  'hin',
  'los',
  'mit',
  'nach',
  'vor',
  'weg',
  'weiter',
  'zu',
  'zurück',
  'zusammen',
  'heim',
  'hoch',
  'nieder',
  'wieder',
  'kennen', // sich kennenlernen — compound separable
];

function parseVerb(headword, grammatik) {
  const hw = headword.trim();
  const gk = grammatik.trim();

  // Split principal parts: "infinitive, praeteritum, perfekt"
  const parts = hw.split(',').map((p) => p.trim());
  const infinitive = parts[0];

  const separable = /trennb\./.test(gk) && !/untrennb\./.test(gk);
  let prefix = null;

  if (separable) {
    // Strip "sich " before extracting prefix (e.g. "sich ausruhen" → "ausruhen")
    const stem = infinitive.replace(/^sich\s+/, '');
    for (const p of SEPARABLE_PREFIXES) {
      if (stem.startsWith(p) && stem.length > p.length) {
        prefix = p;
        break;
      }
    }
  }

  return { lemma: infinitive, separable, prefix };
}

// ---------------------------------------------------------------------------
// POS mapping (Wortart → enum)
// ---------------------------------------------------------------------------

function mapPos(wortart) {
  const w = wortart.toLowerCase().trim();
  if (w.startsWith('nomen')) return 'noun';
  if (w.startsWith('eigenname')) return 'noun'; // proper nouns
  if (w.startsWith('verbverbindung')) return 'part'; // must precede verb check
  if (w.startsWith('verbphrase')) return 'verb';
  if (w.startsWith('reflexiv')) return 'verb';
  if (w.startsWith('modal')) return 'verb';
  if (w.startsWith('verb')) return 'verb';
  if (w === 'adjektiv') return 'adj';
  if (w.startsWith('adverb')) return 'adv';
  if (w === 'präposition') return 'prep';
  if (w === 'konjunktion') return 'conj';
  if (w === 'subjunktion') return 'conj';
  if (w.startsWith('personalpronomen')) return 'pron';
  if (w.startsWith('interrogativpronomen')) return 'pron';
  if (w.startsWith('indefinitpronomen')) return 'pron';
  if (w.startsWith('possessivpronomen')) return 'pron';
  if (w.startsWith('kardinalzahl')) return 'num';
  if (w.startsWith('zahlwort')) return 'num';
  if (w === 'antwortpartikel') return 'part';
  if (w === 'negationspartikel') return 'part';
  if (w === 'gradpartikel') return 'part';
  if (w === 'fokuspartikel') return 'part';
  if (w === 'partikel / adjektiv') return 'part';
  if (w.startsWith('grußformel')) return 'part';
  if (w === 'feste wendung') return 'part';
  if (w === 'adverbialphrase') return 'part';
  if (w === 'präpositionalphrase') return 'part';
  if (w === 'interjektion') return 'part';
  if (w === 'possessivartikel') return 'part';
  if (w === 'unbestimmter artikel') return 'part';
  if (w === 'negationsartikel') return 'part';
  if (w === 'fragewort / w-adverb') return 'pron';
  return 'part'; // fallback
}

// ---------------------------------------------------------------------------
// Table parser
// ---------------------------------------------------------------------------

function parseTable(content) {
  const lines = content.split('\n');
  const rows = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('|---') || trimmed.startsWith('| #')) continue;

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 8) continue;

    const rank = parseInt(cells[0], 10);
    if (isNaN(rank)) continue;

    rows.push({
      freq_rank: rank,
      german: cells[1],
      english: cells[2],
      wortart: cells[3],
      grammatik: cells[4],
      cefr: cells[5],
      themenfeld: cells[6],
      example: cells[7],
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

function transform(rows) {
  const words = [];
  const errors = [];

  // First pass: compute base slugs and detect collisions
  const baseSlugs = rows.map((row) => {
    const rawHead = row.german
      .split(',')[0]
      .replace(/!|\?/g, '')
      .replace(/\s*\(Pl\.\)\s*$/, '')
      .trim();
    return slugify(stripArticle(rawHead));
  });

  const slugCounts = {};
  baseSlugs.forEach((s) => {
    slugCounts[s] = (slugCounts[s] || 0) + 1;
  });

  // Track usage count for disambiguation
  const slugUsed = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const pos = mapPos(row.wortart);
      const baseSlug = baseSlugs[i];

      // Disambiguate collisions with POS tag
      let slug;
      if (slugCounts[baseSlug] > 1) {
        slug = `${baseSlug}-${pos}`;
      } else {
        slug = baseSlug;
      }

      const theme = THEME_MAP[row.themenfeld] || slugify(row.themenfeld);

      const rawLemma = row.german
        .split(',')[0]
        .replace(/!|\?/g, '')
        .replace(/\s*\(Pl\.\)\s*$/, '')
        .trim();

      let entry = {
        id: slug,
        lemma: rawLemma,
        gender: null,
        plural: null,
        pos,
        gloss_en: row.english,
        example_de: row.example,
        example_en: '', // No English translations in source; filled by owner spot-check or left empty
        case_note: row.grammatik,
        separable: false,
        prefix: null,
        audio_word: `audio/${slug}.ogg`,
        audio_example: `audio/${slug}.example.ogg`,
        image_ref: null,
        theme,
        cefr: row.cefr,
        freq_rank: row.freq_rank,
        source: ['frequencywords-de', 'top1000-annotated'],
      };

      if (pos === 'noun') {
        const noun = parseNoun(row.german, row.grammatik);
        entry.gender = noun.gender;
        entry.lemma = noun.lemma;
        entry.plural = noun.plural;
      } else if (pos === 'verb') {
        const verb = parseVerb(row.german, row.grammatik);
        entry.lemma = verb.lemma;
        entry.separable = verb.separable;
        entry.prefix = verb.prefix;
      }

      // Cloze must come last — the noun/verb branches above rewrite the lemma
      Object.assign(entry, computeCloze(entry.example_de, entry.lemma));

      words.push(entry);
    } catch (e) {
      errors.push({ rank: row.freq_rank, error: e.message });
    }
  }

  return { words, errors };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const content = readFileSync(SOURCE, 'utf-8');
const rows = parseTable(content);
const { words, errors } = transform(rows);

if (errors.length > 0) {
  console.error('Parse errors:', errors);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
const output = { dataVersion: DATA_VERSION, words };
writeFileSync(OUT, JSON.stringify(output, null, 2));

console.log(`Parsed ${words.length} entries → ${OUT}`);
console.log(`  nouns: ${words.filter((w) => w.pos === 'noun').length}`);
console.log(`  verbs: ${words.filter((w) => w.pos === 'verb').length}`);
console.log(`  adj:   ${words.filter((w) => w.pos === 'adj').length}`);
console.log(`  adv:   ${words.filter((w) => w.pos === 'adv').length}`);
console.log(`  prep:  ${words.filter((w) => w.pos === 'prep').length}`);
console.log(`  conj:  ${words.filter((w) => w.pos === 'conj').length}`);
console.log(`  pron:  ${words.filter((w) => w.pos === 'pron').length}`);
console.log(`  num:   ${words.filter((w) => w.pos === 'num').length}`);
console.log(`  part:  ${words.filter((w) => w.pos === 'part').length}`);
