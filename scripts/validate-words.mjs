#!/usr/bin/env node
// Phase 0 — Content validation gate for words.json
// Exits 0 only if all quality gates pass (PLAN.md §7).

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WORDS_JSON = join(ROOT, 'public', 'words.json');

const POS_ENUM = ['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'num', 'part'];
const CEFR_ENUM = ['A1', 'A2', 'B1'];
const REQUIRED_FIELDS = [
  'id', 'lemma', 'gender', 'plural', 'pos', 'gloss_en', 'example_de', 'example_en',
  'case_note', 'separable', 'prefix', 'audio_word', 'audio_example', 'image_ref',
  'theme', 'cefr', 'freq_rank', 'source',
];
const FORBIDDEN_STRINGS = ['Leipzig', 'SUBTUBLEX', 'SUBTLEX', 'Goethe'];

let failures = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  failures++;
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`);
  warnings++;
}

// ---------------------------------------------------------------------------
const content = readFileSync(WORDS_JSON, 'utf-8');
const data = JSON.parse(content);
const words = data.words;

console.log(`Validating words.json (dataVersion: ${data.dataVersion})`);
console.log(`Entries: ${words.length}`);
console.log('');

// 1. Exactly 1,000 entries
if (words.length !== 1000) {
  fail(`Expected 1,000 entries, got ${words.length}`);
}

// 2. All required fields present
for (const w of words) {
  for (const f of REQUIRED_FIELDS) {
    if (!(f in w)) {
      fail(`#${w.freq_rank} ${w.id}: missing field "${f}"`);
    }
  }
}

// 3. pos within enum
for (const w of words) {
  if (!POS_ENUM.includes(w.pos)) {
    fail(`#${w.freq_rank} ${w.id}: invalid pos "${w.pos}"`);
  }
}

// 4. cefr within enum
for (const w of words) {
  if (!CEFR_ENUM.includes(w.cefr)) {
    fail(`#${w.freq_rank} ${w.id}: invalid cefr "${w.cefr}"`);
  }
}

// 5. No duplicate IDs
const idSet = new Set();
for (const w of words) {
  if (idSet.has(w.id)) {
    fail(`Duplicate id: "${w.id}"`);
  }
  idSet.add(w.id);
}

// 6. No duplicate freq_ranks, and all 1-1000 present
const rankSet = new Set();
for (const w of words) {
  if (rankSet.has(w.freq_rank)) {
    fail(`Duplicate freq_rank: ${w.freq_rank}`);
  }
  rankSet.add(w.freq_rank);
}
for (let i = 1; i <= 1000; i++) {
  if (!rankSet.has(i)) {
    fail(`Missing freq_rank: ${i}`);
  }
}

// 7. Noun completeness: every noun must have gender+plural, OR be a recognized
//    exception (Pluraliatantum, Singulariatantum, proper noun without article)
const SINGULARIATANTUM_PATTERNS = [
  'Singulariatantum', ' kein Plural', 'nur Sg.', 'meist Sg.',
  'Markenname', 'Gerundium', 'Substantiviertes Verb', 'Anglizismus',
  'Ländername mit Artikel', 'ohne Artikel',
];
const PLURALIATANTUM_PATTERNS = ['Pluraliatantum'];

/** Check if Grammatik has a main Pl. declaration (not just in parentheses). */
function hasMainPlural(gk) {
  const parenIdx = gk.indexOf('(');
  const beforeParen = parenIdx >= 0 ? gk.slice(0, parenIdx) : gk;
  return /Pl\.\s+/.test(beforeParen);
}

function matchesAny(str, patterns) {
  return patterns.some(p => str.includes(p));
}

for (const w of words) {
  if (w.pos !== 'noun') continue;

  const isPluraliatantum = w.case_note && matchesAny(w.case_note, PLURALIATANTUM_PATTERNS);
  const isSingulariatantum = w.case_note && matchesAny(w.case_note, SINGULARIATANTUM_PATTERNS);
  const isProperNoun = w.case_note && w.case_note.includes('ohne Artikel');

  if (isPluraliatantum) {
    // Pluraliatantum: gender null, plural set
    if (w.gender !== null) {
      fail(`#${w.freq_rank} ${w.id}: Pluraliatantum should have gender null`);
    }
    if (!w.plural) {
      fail(`#${w.freq_rank} ${w.id}: Pluraliatantum must have plural`);
    }
  } else if (isSingulariatantum || isProperNoun) {
    // Singulariatantum / proper noun: plural null OK
    if (w.plural !== null) {
      fail(`#${w.freq_rank} ${w.id}: should have plural null`);
    }
  } else if (w.plural === null && !hasMainPlural(w.case_note)) {
    // No main plural declaration in Grammatik → treat as Singulariatantum
    // (e.g. der Rat with Grammatik "m., Ratschlag (Pl. Ratschläge)")
  } else {
    // Regular noun: both gender and plural
    if (!w.gender) {
      fail(`#${w.freq_rank} ${w.id}: noun missing gender`);
    }
    if (!w.plural) {
      fail(`#${w.freq_rank} ${w.id}: noun missing plural`);
    }
  }
}

// 8. Non-nouns: gender null, plural null
for (const w of words) {
  if (w.pos === 'noun') continue;
  if (w.gender !== null) {
    fail(`#${w.freq_rank} ${w.id}: non-noun should have gender null, got "${w.gender}"`);
  }
  if (w.plural !== null) {
    fail(`#${w.freq_rank} ${w.id}: non-noun should have plural null, got "${w.plural}"`);
  }
}

// 9. Separable verb must have prefix
for (const w of words) {
  if (w.separable && !w.prefix) {
    fail(`#${w.freq_rank} ${w.id}: separable verb missing prefix`);
  }
  if (!w.separable && w.prefix) {
    fail(`#${w.freq_rank} ${w.id}: non-separable verb has prefix`);
  }
}

// 10. example_de should contain the lemma (normalized check)
for (const w of words) {
  const lemmaLower = w.lemma.toLowerCase().replace(/[()!?,.\s-]/g, '');
  const exampleLower = w.example_de.toLowerCase().replace(/[()!?,.\s-]/g, '');
  // Also check without umlaut normalization
  const lemmaNormalized = lemmaLower.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 's');
  const exampleNormalized = exampleLower.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 's');

  if (!exampleNormalized.includes(lemmaNormalized)) {
    // Try matching just the first 4 chars of the lemma (for inflected forms)
    if (lemmaNormalized.length > 4 && !exampleNormalized.includes(lemmaNormalized.slice(0, 4))) {
      warn(`#${w.freq_rank} ${w.id}: example may not contain lemma "${w.lemma}" in "${w.example_de}"`);
    }
  }
}

// 11. No forbidden provenance strings
for (const w of words) {
  const sourceStr = JSON.stringify(w.source);
  for (const f of FORBIDDEN_STRINGS) {
    if (sourceStr.includes(f)) {
      fail(`#${w.freq_rank} ${w.id}: forbidden source string "${f}"`);
    }
  }
}

// 12. Audio paths follow convention
for (const w of words) {
  if (w.audio_word !== `audio/${w.id}.ogg`) {
    fail(`#${w.freq_rank} ${w.id}: audio_word "${w.audio_word}" doesn't match id`);
  }
  if (w.audio_example !== `audio/${w.id}.example.ogg`) {
    fail(`#${w.freq_rank} ${w.id}: audio_example "${w.audio_example}" doesn't match id`);
  }
}

// 13. Every entry has exactly one theme
const themes = new Set();
for (const w of words) {
  if (!w.theme || typeof w.theme !== 'string') {
    fail(`#${w.freq_rank} ${w.id}: missing or invalid theme`);
  } else {
    themes.add(w.theme);
  }
}

// ---------------------------------------------------------------------------
console.log('');
console.log(`Themes: ${themes.size} distinct values`);
if (themes.size > 35) {
  warn(`Expected ~30 themes, got ${themes.size}`);
}

console.log('');
if (failures === 0) {
  console.log(`PASS — ${words.length} entries validated, ${warnings} warnings.`);
  process.exit(0);
} else {
  console.error(`FAIL — ${failures} failure(s), ${warnings} warnings.`);
  process.exit(1);
}
