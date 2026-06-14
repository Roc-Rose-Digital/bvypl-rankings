# Match & Team Detail Pages — Design Spec
_2026-06-14_

## Overview

Add clickable match and team navigation to the VPL Rankings app. Clicking any team name/logo navigates to a team detail page; clicking any match row navigates to a match detail page. Both pages fetch all available data from the Dribl API and display it generically alongside locally-computed season stats.

No existing functionality is modified. All changes are additive.

---

## Routing

Hash-based navigation layered on top of the existing tab system.

- `#` / empty — normal app (tabs visible, detail view hidden)
- `#match/result/{matchId}` — completed match detail page
- `#match/fixture/{matchId}` — upcoming fixture detail page
- `#team/{encodedClubName}` — team detail page

A `hashchange` listener on `window` drives view switching. When a detail hash is active, the main nav tabs and content are hidden and the detail view is shown. When the hash clears, the detail view is hidden and the previous tab is restored.

`history.back()` is used for the back button — it pops the hash and the `hashchange` listener handles the transition.

The tab system (`showTab`, `tab-active` classes, `.tab-content` visibility) is unchanged.

---

## Data Augmentation (on load)

During `loadData()`, after fixtures and results are fetched, build two lookup maps:

- `teamIdMap: { fullTeamName → teamId }` — extracted from `home_team_id` / `away_team_id` fields on fixture/result attributes. Used to fetch team profiles from Dribl.
- `clubLogoMap: { clubName → logoUrl }` — extracted from `home_logo` / `away_logo` fields. Used to display club logos on the team detail page without an extra API call.

These maps are module-level globals, populated once per `loadData()` call, reset on each reload.

---

## Clickable Elements

Onclick handlers are added to the HTML strings generated inside existing render functions. The render function logic itself is not changed — only the generated HTML gains `onclick` and `cursor-pointer` attributes.

**Team names/logos** (all locations):
- Combined ladder rows — club name cell
- Age group ladder rows — team name cell
- Fixture rows — home and away team name
- Result rows — home and away team name

Each calls `navigateToTeam(clubName)` where `clubName` is the club name (age group suffix stripped via the existing `getClubName()` helper).

**Match rows** (fixtures + results):
- The entire row becomes clickable, calling `navigateToMatch(matchId, type)` where `type` is `'result'` or `'fixture'`. This encodes to `#match/result/{id}` or `#match/fixture/{id}`.

---

## Match Detail Page

### Layout (matches existing card/table style)

```
[ ← Back ]

┌─────────────────────────────────────────────┐
│  [Home Logo]  Home Team    vs    Away Team  [Away Logo] │
│  Score (if result) | Date | Round | Venue               │
│  League name                                            │
└─────────────────────────────────────────────┘

┌──────────────────┐
│  API Data        │
│  (all fields     │
│   from Dribl)    │
└──────────────────┘
```

### Data sources

1. The match object already in memory (`fixturesData` or `resultsData`) — provides the header fields immediately with no loading state.
2. Dribl detail endpoint (fetched on navigation):
   - Results: `https://mc-api.dribl.com/api/results/{id}?tenant=w8zdBWPmBX&timezone=Australia/Sydney`
   - Fixtures: `https://mc-api.dribl.com/api/fixtures/{id}?tenant=w8zdBWPmBX&timezone=Australia/Sydney`

### Generic API renderer

A `renderApiSection(data, title)` function renders any object returned from the API into labelled key-value rows inside a card. Rules:
- Skip fields already shown in the header (home_team_name, away_team_name, home_score, away_score, date, round, ground_name, league_name, home_logo, away_logo).
- Convert snake_case keys to Title Case labels.
- Render arrays as sub-tables if their items are objects; as comma-separated lists if primitive.
- Nested objects rendered as indented sub-sections.
- If the API call fails or returns no additional data, the card is omitted silently.

---

## Team Detail Page

### Layout

```
[ ← Back ]

┌─────────────────────────────────────────────┐
│  [Club Logo]  Club Name                     │
│  Season: Boys YPL1 (or current division)    │
└─────────────────────────────────────────────┘

┌──────────────────────────────┐
│  Season Summary              │
│  P  W  D  L  GF  GA  GD  Pts│
└──────────────────────────────┘

┌──────────────────────────────┐
│  Age Group Breakdown         │
│  U13: 3rd — 18pts            │
│  U14: 1st — 24pts            │
│  ...                         │
└──────────────────────────────┘

┌──────────────────────────────┐
│  Recent Results (last 10)    │
└──────────────────────────────┘

┌──────────────────────────────┐
│  Upcoming Fixtures           │
└──────────────────────────────┘

┌──────────────────────────────┐
│  Club Profile (Dribl API)    │
│  Generic renderer            │
└──────────────────────────────┘
```

### Data sources

1. Season stats and age group breakdown — computed from already-loaded `resultsData` filtered to the club. No API call needed.
2. Recent results — filtered from `resultsData`, most recent first, capped at 10.
3. Upcoming fixtures — filtered from `fixturesData`, chronologically, all pending matches.
4. Club profile — try `https://mc-api.dribl.com/api/teams/{teamId}?tenant=w8zdBWPmBX`. Team ID sourced from `teamIdMap`. If no ID found or the call fails, this section is omitted silently.

---

## New Functions

| Function | Purpose |
|---|---|
| `buildLookupMaps()` | Builds `teamIdMap` and `clubLogoMap` from loaded data |
| `navigateToMatch(id, type)` | Pushes `#match/result/{id}` or `#match/fixture/{id}` hash |
| `navigateToTeam(clubName)` | Pushes `#team/{encoded}` hash |
| `showDetailView(html)` | Hides tabs/content, renders html in detail container |
| `hideDetailView()` | Restores tabs/content, clears detail container |
| `renderMatchDetail(id, type)` | Builds match detail page HTML, fetches API data |
| `renderTeamDetail(clubName)` | Builds team detail page HTML, fetches API data |
| `renderApiSection(data, title, skipFields)` | Generic key-value renderer for raw API objects |
| `handleHashChange()` | Routes hash to the appropriate render function |

---

## DOM Changes (index.html)

One new `<div>` added inside `<main>` before the existing tab content divs:

```html
<div id="detail-view" class="hidden"></div>
```

No other HTML changes.

---

## Safety / Backup

- `app.js.bak` and `index.html.bak` created before any edits.
- All new code is additive — no existing functions modified.
- The only change to existing render functions is injecting `onclick` and `class="cursor-pointer"` into generated HTML strings.

---

## Out of Scope

- Persisting detail view state across page refreshes (hash already handles this).
- Player-level statistics (not confirmed available from Dribl API).
- Caching API responses between navigations (can be added later).
