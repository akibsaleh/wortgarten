# Coding Agent Prompt — Plan a Zen-Style German Vocabulary PWA

*This is a ready-to-paste prompt for a coding agent (e.g. Claude Code). It asks the agent to produce a PLAN first — no application code — grounded in the accompanying research paper "Zen-Style German Vocabulary PWA: Foundations, Design, and Retention Strategy for the 1,000-Word Core." Attach that paper alongside this prompt if your agent supports file attachments; the key facts are also summarized below so the prompt is self-contained.*

---

## Role

You are a senior full-stack product engineer and UX architect. You have access to a frontend-design skill/capability for crafting distinctive, high-quality interfaces — use it when producing the design plan in Section 4, and again later during implementation.

## Mission

Before writing any application code, produce a complete **planning document** for a web app that teaches learners the **1,000 most frequent, highest-utility German words** — a core vocabulary that covers roughly 65–83% of everyday German depending on register (non-fiction ~65%, fiction ~72%, spoken ~83%), commonly summarized as "~75% of everyday German." Propose 2–3 candidate names for the app as part of your plan. Do not begin implementation until this plan has been reviewed and approved.

## Grounding research (treat as constraints, not suggestions)

- **Linguistic foundation:** top 1,000 German lemmas cover ~65% of non-fiction, ~72% of fiction, ~83% of spoken German (Jones 2003 / Davies 2005). Coverage grows logarithmically (Zipf's law) — frame this honestly in-product rather than as one flat number.
- **Content sourcing:** curate from open frequency datasets (hermitdave/FrequencyWords German list, SUBTLEX-DE, Leipzig Corpora Collection) cross-checked against the official Goethe-Institut A1/A2 Wortlisten. Every entry needs gender (der/die/das), plural, part of speech, an example sentence with case context, and audio — a bare word-to-word mapping is insufficient.
- **Learning engine:** spaced repetition via **FSRS** (not SM-2), active recall as the default interaction (typing/production over passive multiple choice) with immediate corrective feedback, dual coding (text + audio + image per card), and hybrid interleaving (short thematic block, then interleaved with due reviews).
- **Design philosophy — "zen style":** calm, minimalist UI — one action per screen, a single accent color plus neutrals, generous whitespace, restrained typography, soft rounded shapes, purposeful sub-300ms micro-interactions, full `prefers-reduced-motion` support. Think "spa, not billboard."
- **Technical architecture:** offline-first Progressive Web App — IndexedDB as local source of truth (e.g. via Dexie.js), service worker for asset/data caching and background sync, Web Speech API for German TTS with bundled-audio fallback for the core 1,000 words (voice availability varies by browser/OS).
- **Retention / "reboot" strategy (key differentiator):** humane streaks with freeze/repair mechanics decoupled from the daily goal; a dedicated lapsed-user reboot flow that caps and gracefully staggers the overdue-review backlog, offers a short low-friction comeback session, re-diagnoses forgotten words, and uses encouraging (not guilt-based) copy; reminders timed to predicted forgetting rather than spammed.

## What to plan (deliverable sections)

**1. Product Definition & Scope** — MVP feature set vs. V2/V3 backlog; explicit non-goals (e.g., not a full grammar course, not exam-certification prep).

**2. Content & Data Architecture** — word-list sourcing/curation pipeline; per-word schema (lemma, gender, plural, POS, gloss, example sentence with case, separable-verb flag, audio ref, image ref, theme tag, CEFR tag, frequency rank); curriculum structure (frequency backbone + ~20–40 thematic units + CEFR bands A1→A2→B1).

**3. Learning Engine** — FSRS implementation approach; interaction types (recognition, typed recall, cloze from example sentences, audio recall); session composition logic (due reviews first, then new words interleaved, not blocked).

**4. Zen-Style UI/UX Design Plan** *(use the frontend-design skill here)* — visual design system (palette, type scale, spacing, motion principles, accessibility incl. WCAG contrast and reduced-motion); screen inventory and key flows (onboarding, daily session, review, progress dashboard, settings); signature interactions (gender-color-coded cards, flip animation, pronunciation button, progress rings).

**5. Retention & Reboot System** — streak/freeze/repair mechanics; lapsed-user detection and reboot flow (backlog capping/staggering, diagnostic recheck, comeback session, tone of copy); notification strategy tied to the forgetting curve.

**6. Technical Architecture** — stack recommendation with rationale (e.g. React + TypeScript + Vite, Dexie.js/IndexedDB, Workbox service worker, Web Speech API + fallback audio); offline-first data flow (describe in text or ASCII diagram); state management for SRS state and sync.

**7. Content Sourcing & Licensing Plan** — which datasets are open-license and usable as-is; how enrichment (gender, plural, example sentences, audio) will be produced — manual curation, LLM-assisted generation with human review, or licensed data — and how quality will be verified.

**8. Roadmap & Milestones** — Phase 0: word list + data pipeline. Phase 1: MVP (core FSRS loop + flashcards + basic zen UI, no offline yet). Phase 2: zen polish + audio + light gamification + streaks. Phase 3: offline/PWA + full reboot system + reminders. Phase 4 (stretch): speech recognition, thematic deep-dives, B1 extension.

**9. Open Questions & Assumptions** — state anything you're assuming (e.g., target learner's native language, single-user local app vs. accounts/sync, monetization) and flag anything that needs explicit sign-off before building.

## Constraints & non-negotiables

- No dark patterns, ad clutter, or aggressive paywalls; all pressure mechanics (streaks, reminders) must be optional/dismissible.
- Must work fully offline after first load.
- Must be accessible: keyboard navigation, screen-reader labels, reduced-motion support, sufficient contrast even within a muted palette.
- State the coverage claim honestly and specifically (spoken vs. written) in any in-app copy — never oversell "fluency."
- Every vocabulary entry must ship with grammatical gender (color-coded), plural, and at least one case-marked example sentence.

## Output format

Respond with the planning document only, using the nine numbered headers above (tables where useful, e.g. for the data schema and roadmap). **Do not generate application code in this response** — implementation will be requested in a follow-up turn once the plan is reviewed. Where an assumption is needed to keep the plan concrete, state it explicitly rather than leaving a gap.
