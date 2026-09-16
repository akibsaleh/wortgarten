import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { Settings as SettingsType } from '../db/schema';
import { useNotifications } from '../notifications/useNotifications';

const APP_VERSION = '0.1.0';

/** Simple markdown-to-HTML for the attribution doc (handles headings, tables, bold, links, lists, blockquotes). */
function mdToHtml(md: string): string {
  let html = md;
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr />');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Tables — convert markdown tables to HTML
  html = html.replace(
    /^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, headerRow: string, _sep: string, bodyBlock: string) => {
      const headers = headerRow
        .split('|')
        .map((c: string) => c.trim())
        .filter(Boolean);
      const rows = bodyBlock
        .trim()
        .split('\n')
        .map((line: string) =>
          line
            .split('|')
            .map((c: string) => c.trim())
            .filter(Boolean),
        );
      const thead = `<thead><tr>${headers.map((h: string) => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map((row: string[]) => `<tr>${row.map((c: string) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<table>${thead}${tbody}</table>`;
    },
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs — wrap remaining loose lines
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr')
      ) {
        return trimmed;
      }
      // Wrap in paragraph, preserving internal line breaks
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}

const ATTRIBUTION_MD = `# Attribution & Licensing

Wortgarten is free and non-commercial.

## Data

| Source | License | Use in Wortgarten |
|---|---|---|
| top-1000-german-words.md (onewholearns.com-derived, DaF/DaZ-annotated) | Strictly personal use only | Primary knowledge source — parsed deterministically into \`words.json\`. Never distributed or published. |
| hermitdave/FrequencyWords (de) | Data: CC BY-SA 4.0; Code: MIT | License-clean fallback spine (not currently in use). |

**hermitdave/FrequencyWords attribution (if fallback spine is used):**

> Word frequency data derived from [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Audio

All audio in Wortgarten is self-generated using [Piper TTS](https://github.com/rhasspy/piper), licensed under the [MIT License](https://github.com/rhasspy/piper/blob/master/LICENSE). No scraped or ripped audio is used.

Voice model: \`de_DE-thorsten-medium\` from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices), licensed under [MIT](https://huggingface.co/rhasspy/piper-voices).

## Fonts

- **Source Serif 4** — [SIL Open Font License](https://scripts.sil.org/OFL)
- **Inter** — [SIL Open Font License](https://scripts.sil.org/OFL)

## Icons

- **OpenMoji** — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (if icons are shipped in a future version)

## Software

| Package | License |
|---|---|
| React | MIT |
| Vite | MIT |
| Dexie.js | Apache-2.0 |
| ts-fsrs | MIT |
| Zustand | MIT |
| React Router | MIT |
| vite-plugin-pwa | MIT |

## Non-redistributable content (curation QA only, never shipped)

- Leipzig Corpora Collection (CC BY-NC) — used for frequency ranking QA only
- SUBTLEX-DE (research/non-commercial) — used for spoken-register coverage check only
- Goethe-Institut A1/A2 Wortlisten (© Goethe-Institut) — used as coverage checklist only

None of the above content is included in any shipped artifact.

## Content completeness

Every vocabulary entry ships with: grammatical gender, plural (or explicit no-plural), part of speech, English gloss, and at least one case-marked example sentence. A bare word-to-word mapping is considered a bug.

## Honest claims

Wortgarten does not claim to teach "fluency." Coverage is stated per register:

- ~65% of non-fiction texts
- ~72% of fiction texts
- ~83% of spoken German

These 1,000 words represent the highest-utility core vocabulary for English-speaking learners reaching approximately B1 level.`;

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const groupId = `setting-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="settings-group">
      <h3 id={groupId} className="settings-group-label">
        {label}
      </h3>
      <div aria-labelledby={groupId}>
        {children}
      </div>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <div className="settings-segmented" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt}
          role="radio"
          aria-checked={value === opt}
          onClick={() => onChange(opt)}
          className={`settings-segment ${value === opt ? 'settings-segment--active' : ''}`}
        >
          {labels ? labels[opt] : opt}
        </button>
      ))}
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [exporting, setExporting] = useState(false);
  const notif = useNotifications();

  useEffect(() => {
    db.settings.get(1).then((s) => {
      if (s) setSettings(s);
    });
  }, []);

  const update = useCallback(
    async (patch: Partial<SettingsType>) => {
      if (!settings) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      await db.settings.update(1, patch);
    },
    [settings],
  );

  async function handleExport() {
    setExporting(true);
    try {
      const [words, cards, reviewLogs, sessions, settingsRow] = await Promise.all([
        db.words.toArray(),
        db.cards.toArray(),
        db.reviewLogs.toArray(),
        db.sessions.toArray(),
        db.settings.toArray(),
      ]);
      const payload = JSON.stringify({ words, cards, reviewLogs, sessions, settings: settingsRow }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wortgarten-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (!settings) {
    return (
      <main className="settings" id="main-content">
        <p className="loading-text">Loading…</p>
      </main>
    );
  }

  return (
    <main className="settings" id="main-content">
      {/* Header */}
      <div className="settings-header">
        <button
          className="settings-back"
          onClick={() => navigate('/')}
          aria-label="Back to home"
        >
          ← Back
        </button>
        <h1 className="settings-title">Settings</h1>
      </div>

      {/* Daily goal */}
      <SettingGroup label="Daily goal (minutes)">
        <SegmentedControl
          options={[5, 10, 15, 20] as const}
          value={settings.daily_goal_minutes as 5 | 10 | 15 | 20}
          onChange={(v) => update({ daily_goal_minutes: v })}
          labels={{ 5: '5 min', 10: '10 min', 15: '15 min', 20: '20 min' }}
        />
      </SettingGroup>

      {/* New cards per day */}
      <SettingGroup label="New cards per day">
        <SegmentedControl
          options={[5, 10, 15, 20] as const}
          value={settings.new_cards_per_day as 5 | 10 | 15 | 20}
          onChange={(v) => update({ new_cards_per_day: v })}
          labels={{ 5: '5', 10: '10', 15: '15', 20: '20' }}
        />
      </SettingGroup>

      {/* Review cap */}
      <SettingGroup label="Review cap">
        <SegmentedControl
          options={[30, 60, 100] as const}
          value={settings.review_cap as 30 | 60 | 100}
          onChange={(v) => update({ review_cap: v })}
          labels={{ 30: '30', 60: '60', 100: '100' }}
        />
      </SettingGroup>

      {/* Reduced motion */}
      <SettingGroup label="Reduced motion">
        <SegmentedControl
          options={['auto', 'on', 'off'] as const}
          value={settings.reduced_motion}
          onChange={(v) => update({ reduced_motion: v })}
          labels={{ auto: 'Auto', on: 'On', off: 'Off' }}
        />
      </SettingGroup>

      {/* Notifications — only shown if the platform supports the Notification API */}
      {notif.isSupported && (
        <SettingGroup label="Reminders">
          <div className="settings-row">
            <span className="settings-row-label">Daily reminder</span>
            <button
              role="switch"
              aria-checked={notif.enabled}
              onClick={notif.toggleEnabled}
              aria-label="Daily reminder"
              className={`settings-toggle ${notif.enabled ? 'settings-toggle--on' : ''}`}
            >
              <span className="settings-toggle-knob" aria-hidden="true" />
            </button>
          </div>

          {notif.enabled && (
            <>
              <div className="settings-field">
                <label className="settings-field-label" htmlFor="reminder-time">
                  Reminder time
                </label>
                <input
                  id="reminder-time"
                  type="time"
                  className="settings-field-input"
                  value={notif.reminderTime}
                  onChange={(e) => notif.setReminderTime(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Permission status */}
          <p className="settings-note">
            {notif.permission === 'granted' && '✓ Notification permission granted'}
            {notif.permission === 'denied' && '✕ Notification permission denied — enable in browser settings'}
            {notif.permission === 'default' && 'Notification permission not yet requested'}
            {notif.permission === 'unavailable' && 'Notifications not supported on this platform'}
          </p>
        </SettingGroup>
      )}

      {/* Data export */}
      <SettingGroup label="Data">
        <button
          className="btn-primary settings-export-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting…' : 'Export all data (JSON)'}
        </button>
      </SettingGroup>

      {/* Version info */}
      <SettingGroup label="About">
        <div className="settings-about">
          <p><strong>Wortgarten</strong> v{APP_VERSION}</p>
          <p>Data version: {settings.data_version}</p>
        </div>
      </SettingGroup>

      {/* Attribution / License */}
      <SettingGroup label="Attribution & License">
        <div
          className="settings-attribution"
          dangerouslySetInnerHTML={{ __html: mdToHtml(ATTRIBUTION_MD) }}
        />
      </SettingGroup>
    </main>
  );
}
