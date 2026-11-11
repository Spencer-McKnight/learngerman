# Wegweiser — the design system

Tokens: `src/app/globals.css`. Primitives: `src/components/ui/` (import from `@/components/ui`). Fonts: `src/app/layout.tsx`.

## Identity

**Wegweiser** (signpost). German signage modern: the calm authority of DIN type and road signs, warmed by a porcelain ground and humanist body text. A learner is travelling deeper into Germany along transit lines; the interface is the signage along the way. Calm by default — one accent, quiet surfaces, generous leading — and energy only at genuine milestones, when the yellow Ortsschild arrives.

## Principles

1. **One accent.** Traffic blue carries every action and the path. If two things are blue, one of them is wrong.
2. **Yellow is a milestone.** Ortsschild yellow appears only in `Ortsschild`, the milestone overlay and the Weg history of reached signs. Never for buttons, badges, streaks or praise.
3. **Colour is feedback, never the only carrier.** Gender colours arrive after retrieval, always with the article text. Status is shape + text + colour.
4. **Honest numbers, big.** Metrics that mean something outside the app are set in DIN, tabular, large. Nothing invented gets that treatment.
5. **Motion explains, never decorates.** Things move to show where they came from or that something changed. Nothing animates at rest.
6. **Both themes, both AA.** Dark is `#16181D`-family, never pure black; every text pair is ≥ 4.5:1 in both.

## Colour tokens (semantic; Tailwind class → CSS var)

| Token | Light | AA on ground / surface | Dark | AA on ground / raised | Use |
|---|---|---|---|---|---|
| `ground` | `#F7F6F3` | — | `#16181D` | — | page background |
| `surface` / `surface-raised` / `surface-sunken` | `#FFF` / `#FFF` / `#EFEDE8` | — | `#1E2127` / `#262A32` / `#121419` | — | cards, sheets, wells |
| `hairline` (alias `line`) | `#DCD8CF` | graphics | `#2F343D` | graphics | borders |
| `ink` | `#1B1F24` | 15.3 / 16.6 | `#E8E6E1` | 14.2 / 11.5 | text |
| `ink-muted` (alias `muted`) | `#5B626D` | 5.7 / 6.2 | `#A3AAB5` | 7.6 / 6.2 | secondary text |
| `ink-faint` | `#9AA0A9` | graphics only | `#6A717C` | graphics only | placeholders, disabled marks |
| `accent` | `#154889` | 8.4 / 9.1 | `#8AB4FF` | 8.5 / 6.9 | the action colour, links, path |
| `accent-hover` (alias `accent-bright`) | `#1D5FD6` | 5.3 / 5.7 | `#A9C7FF` | 10.4 / 8.4 | hover, gradients |
| `accent-ink` | `#FFF` (9.1 on accent) | | `#16181D` (8.5 on accent) | | text on accent fills |
| `accent-soft`, `accent-glow` | `#E6EEFA`, 18 % | | `#1C2A44`, 20 % | | tinted backgrounds, rings |
| `success` / `-fill` / `-soft` | `#1F7A33` | 5.0 / 5.4 | `#6FD88A` | 10.0 / 8.1 | correct (text / bar / tint) |
| `error` / `-fill` / `-soft` | `#C92A2A` | 5.1 / 5.5 | `#FF7B7B` | 7.1 / 5.7 | wrong, destructive |
| `warning` / `-fill` / `-soft` | `#8A5300` | 5.9 / 6.3 | `#F5B454` | 9.8 / 7.9 | caution; `streak-warm` alias |
| `milestone` / `milestone-ink` | `#F7C600` / `#1B1F24` (10.3) | | same | | the Ortsschild only |
| `gender-der` / `-die` / `-das` | `#1D5FD6` / `#C92A2A` / `#237A36` | 5.3 / 5.1 / 5.0 | `#8AB4FF` / `#FF7B7B` / `#6FD88A` | 8.5 / 7.1 / 10.0 | feedback only; `.das-amber` → amber |
| `line-1…5` | `#154889` `#237A36` `#C92A2A` `#8A5300` `#6D28D9` | 8.4 5.0 5.1 5.9 6.6 | `#8AB4FF` `#6FD88A` `#FF7B7B` `#F5B454` `#B59CFF` | 8.5 10.0 7.1 9.8 7.8 | course lines, text-safe |
| `line-n-fill`, `line-n-ink` | raw hue (`#2F9E44`…) / white | 3:1 graphics | same hue / `#16181D` | | map strokes; text on a line fill |
| `scrim` | ink 55 % | | black 60 % | | sheets, overlay |

Legacy aliases (`background`, `foreground`, `surface-warm`, `muted`, `line`, `accent-bright`, `accent-glow`, `streak-warm`) keep v1 pages rendering; do not use them in new code.

## Type scale (`font-display` = Barlow, body = Inter)

| Class | Size / leading / tracking / weight | Use |
|---|---|---|
| `text-display-xl` | 44 / 1.05 / −0.02em / 700 | the one big number or greeting per screen |
| `text-display-l` | 34 / 1.1 / −0.015em / 700 | page titles, Ortsschild |
| `text-display-m` | 26 / 1.15 / −0.01em / 700 | section titles, lesson beat titles |
| `text-title` | 19 / 1.3 / −0.005em / 600 | station names, answer options, sheet titles |
| `text-body` | 16 / 1.6 | running German and English |
| `text-body-sm` | 14 / 1.55 | secondary copy, buttons |
| `text-caption` | 12 / 1.45 | timestamps, hints |
| `text-label` | 12 / 1.2 / +0.14em / 600, uppercase | eyebrows (use `Eyebrow`) |

Body leading is deliberately generous: German is compound-heavy and runs long. Numbers that change use `tabular`.

## Spacing, radius, elevation

- **Spacing**: Tailwind's 4-pt scale (`--spacing: 0.25rem`). `gutter` = 20 px side padding on phones; `pb-tab-bar` clears the tab bar and the safe area; `pt-safe` / `pb-safe` / `px-safe` apply insets.
- **Radius**: `xs` 4 · `sm` 8 · `md` 12 (buttons, inputs, station signs) · `lg` 16 (cards) · `xl` 24 (sheets) · `pill`.
- **Elevation**: `shadow-flat` (resting cards, buttons) · `shadow-raised` (the one lifted card, hover) · `shadow-floating` (sheets, toasts, the Ortsschild). Tuned per theme; `sm/md/lg` map onto them.

## Motion

- Durations: `--dur-fast` 120 ms (colour, press), `--dur` 200 ms (hover, toggles), `--dur-slow` 420 ms (enter/arrive, progress). Easings: `ease-standard`, `ease-enter`, `ease-exit`, `ease-spring` (only for arrivals: `sign-arrive`, `pop`, tab indicator).
- `transition-*` utilities default to `--dur` + standard easing.
- May animate: screen and beat entry (`animate-fade-up`, `animate-slide-in-right`, `stagger-children`), feedback (`animate-correct`, `animate-wrong`, `animate-shake`, sparks), arrivals (`animate-sign-arrive`, `animate-pop`), progress (`animate-progress-fill`), the karaoke underline, the milestone overlay. Nothing else — no breathing buttons, no idle shimmer; the ambient "Regnitz" wash is the single exception and is below 1 %/s.
- `prefers-reduced-motion`: every animation is removed and transitions are ≤ 1 ms, globally; confetti and sparks do not fire. Meaning must never depend on motion.

## Colour rules

- Yellow: reserved, see principle 2. Gender colours: feedback after retrieval, article text always present, same three colours everywhere, `.das-amber` on `<html>` for red–green CVD.
- Never colour-only: pair status with an icon or text (`StationSign` does), pair correct/wrong with words, pair line colours with the line number (`LineBadge`).
- Line fills are for strokes and badges; running text uses `text-line-n`.

## Primitives

| Primitive | Use for | Not for |
|---|---|---|
| `Button` (`primary` `secondary` `quiet` `answer` `danger`; `sm/md/lg`; `loading`, `icon`) | the one action, alternatives, drill options | navigation, two primaries per screen |
| `IconButton` (`label` required) | close, play, replay | the primary action |
| `Card` (`surface` `raised` `outline`, `as`, `interactive`) | grouping one idea | single lines, nested > 1 |
| `Eyebrow` / `SectionLabel` | tracked labels above content | body copy |
| `ProgressBar` (`value/max` or `segments/current`) | honest fractions, lesson beats | spinners, decoration |
| `Chip` (`neutral` `accent` `gender` + `revealed`) | tags, filters, nouns with gender feedback | verbs, pre-highlighted gender |
| `Sheet` (`<dialog>`, `closeLabel`) | one short decision or list | multi-step flows, toasts |
| `ToastProvider` + `useToast` + `Toaster` | calm confirmations, polite region | blocking errors, praise, milestones |
| `Spinner` (`label` → status) | waits > 300 ms | known fractions |
| `Field` (`label` `hint` `error`, `multiline`) | labelled text entry, aria wired | checkboxes, selects |
| `Segmented` (radiogroup, arrow keys) | 2–5 short options | navigation, on/off |
| `Toggle` (switch) | settings applied at once | forms needing save |
| `StationSign` (`line`, `status`, `href`, `statusLabel`) | stations on the map and lesson header | detours, settings rows |
| `LineBadge` (`line` 1–5) | identify a course line | anything else |
| `Ortsschild` (`label`, `detail`, `landkreis`) | milestones only | decoration, streaks |
| `WordChip` (`gloss`, `gender`+`revealGender`, `current`) | tappable words in scene text | vocabulary cards, links |
| `Stat` (DIN number + label, tabular) | known words, days, minutes | invented scores |

## Accessibility checklist

- Text contrast ≥ 4.5:1 in both themes (table above); graphics ≥ 3:1; never rely on `ink-faint` for text.
- Every target ≥ 44 × 44 (`md` sizes, `.touch-target`); 8 px between adjacent targets.
- Focus visible on everything (`:focus-visible` ring, 2 px accent + 2 px offset; `.focus-ring` on coloured fills).
- Every icon-only control has a text name; every image/decoration is `aria-hidden`.
- Live regions: toasts polite; feedback that matters is in the DOM, not only in colour or sound.
- Reduced motion honoured globally; sound is a preference.
- Screen-reader order follows visual order; sheets and the milestone overlay are modal dialogs with labelled titles and focus return.
- Language: German text in `lang="de"` spans where the UI language is English.

## Non-functional requirements

- **Perceived latency** ≤ 200 ms for any tap: optimistic state, `loading` on the button, never a blank screen.
- **No layout shift**: fixed-height controls, `loading` keeps labels rendered, fonts self-hosted with size-adjusted fallbacks, skeletons sized like content.
- **Offline shell**: chrome, tokens, fonts and the tab bar render without network; content degrades to a message, never a broken page.
- **One-hand reach**: the screen's primary action sits in the bottom 40 % of the viewport on phones; the tab bar is thumb-height and safe-area aware.
- **Keyboard**: everything operable by Tab/Enter/Space/Arrows/Escape; nothing requires hover.
- **i18n**: primitives take every chrome string (`label`, `closeLabel`, `dismissLabel`, `statusLabel`) from the caller via `useStrings()`; never hard-code one.

## Voice and tone

Calm, honest, specific. Say what happened and what comes next; never inflate ("Gut gemacht" only when it was). Numbers are real or absent. German chrome is welcome — Heute, Weg, Du, Weiter — and it is spelled correctly, with the article. No exclamation marks except at a milestone, and even then just one.
