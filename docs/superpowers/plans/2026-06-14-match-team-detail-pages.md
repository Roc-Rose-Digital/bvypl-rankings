# Match & Team Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clickable team and match rows to the VPL Rankings app that navigate to full detail pages fetching all available Dribl API data.

**Architecture:** Hash-based routing (`#match/result/{id}`, `#match/fixture/{id}`, `#team/{name}`) layered on top of the existing tab system with no modifications to existing logic — all changes are additive. A single `detail-view` div overlays the main content when a detail hash is active; `hashchange` drives transitions.

**Tech Stack:** Vanilla JS, Tailwind CSS (CDN), static GitHub Pages — no build system, no test framework.

---

## File Map

| File | Change |
|---|---|
| `index.html` | Add `<div id="detail-view">` inside `<main>` |
| `app.js` | Add new globals, functions, and minimal onclick additions to HTML strings in render functions |
| `app.js.bak` | Created as backup before any edits |
| `index.html.bak` | Created as backup before any edits |

---

### Task 1: Create backups

**Files:**
- Create: `app.js.bak`
- Create: `index.html.bak`

- [ ] **Step 1: Copy both files**

```powershell
Copy-Item "c:\xampp\htdocs\vpl-rankings\app.js" "c:\xampp\htdocs\vpl-rankings\app.js.bak"
Copy-Item "c:\xampp\htdocs\vpl-rankings\index.html" "c:\xampp\htdocs\vpl-rankings\index.html.bak"
```

- [ ] **Step 2: Verify backups exist**

```powershell
Get-Item "c:\xampp\htdocs\vpl-rankings\app.js.bak", "c:\xampp\htdocs\vpl-rankings\index.html.bak" | Select-Object Name, Length
```

Expected: both files listed with non-zero size.

---

### Task 2: Add detail-view div to index.html

**Files:**
- Modify: `index.html`

The spec requires a single `<div id="detail-view" class="hidden">` inside `<main>`, before the existing tab content divs. This is the only HTML change.

- [ ] **Step 1: Add the div**

In `index.html`, find the line:
```html
        <!-- Combined Club Ladder Tab -->
```

Insert immediately before it:
```html
            <!-- Detail View (match / team pages) -->
            <div id="detail-view" class="hidden"></div>

```

- [ ] **Step 2: Verify**

Open `index.html` and confirm `id="detail-view"` exists inside `<main>`, before `id="content-combined"`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add detail-view container to index.html"
```

---

### Task 3: Add globals and buildLookupMaps()

**Files:**
- Modify: `app.js`

Add three new module-level globals and the `buildLookupMaps()` function. Call it inside `initializeApp()` so maps are populated after every data load.

- [ ] **Step 1: Add globals after existing globals (after line `let selectedCombinedAgeGroups = new Set();`)**

```js
let teamIdMap = {};    // fullTeamName → teamId
let clubLogoMap = {};  // clubName (suffix-stripped) → logoUrl
let lastActiveTab = 'combined'; // restored when detail view is dismissed
```

- [ ] **Step 2: Add buildLookupMaps() function**

Add this function after the globals block, before `filterFixturesByAgeGroup`:

```js
function buildLookupMaps() {
    teamIdMap = {};
    clubLogoMap = {};

    const processEntry = (attrs) => {
        if (attrs.home_team_id && attrs.home_team_name) {
            teamIdMap[attrs.home_team_name] = attrs.home_team_id;
            const club = getClubName(attrs.home_team_name);
            if (attrs.home_logo) clubLogoMap[club] = attrs.home_logo;
        }
        if (attrs.away_team_id && attrs.away_team_name) {
            teamIdMap[attrs.away_team_name] = attrs.away_team_id;
            const club = getClubName(attrs.away_team_name);
            if (attrs.away_logo) clubLogoMap[club] = attrs.away_logo;
        }
    };

    fixturesData.forEach(f => processEntry(f.attributes));
    resultsData.forEach(r => processEntry(r.attributes));
}
```

- [ ] **Step 3: Call buildLookupMaps() in initializeApp()**

In `initializeApp()`, add `buildLookupMaps();` as the first line of the function body, before `populateFilters()`:

```js
function initializeApp() {
    buildLookupMaps();
    populateFilters();
    // ... rest unchanged
```

- [ ] **Step 4: Verify**

Open the app in a browser, open the console, and after data loads run:
```js
console.log(Object.keys(teamIdMap).length, Object.keys(clubLogoMap).length)
```
`teamIdMap` may be 0 if the Dribl API doesn't return `home_team_id` fields (not confirmed) — that's fine, the team profile section will just be omitted silently. `clubLogoMap` should have values.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "Add teamIdMap/clubLogoMap globals and buildLookupMaps()"
```

---

### Task 4: Add routing infrastructure

**Files:**
- Modify: `app.js`

Add five functions: `showDetailView`, `hideDetailView`, `navigateToMatch`, `navigateToTeam`, and `handleHashChange`. Wire `hashchange` on window and handle the initial hash on page load.

- [ ] **Step 1: Add helper to safely escape HTML attribute values**

Add at the top of `app.js`, after the initial variable declarations:

```js
function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Add showDetailView and hideDetailView**

```js
function showDetailView(html) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelector('nav').classList.add('hidden');
    const detail = document.getElementById('detail-view');
    detail.innerHTML = html;
    detail.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function hideDetailView() {
    const detail = document.getElementById('detail-view');
    detail.classList.add('hidden');
    detail.innerHTML = '';
    document.querySelector('nav').classList.remove('hidden');
    showTab(lastActiveTab);
}
```

- [ ] **Step 3: Add navigateToMatch and navigateToTeam**

```js
function navigateToMatch(id, type) {
    window.location.hash = 'match/' + type + '/' + id;
}

function navigateToTeam(clubName) {
    window.location.hash = 'team/' + encodeURIComponent(clubName);
}
```

- [ ] **Step 4: Add handleHashChange**

```js
function handleHashChange() {
    const hash = window.location.hash.replace('#', '');

    if (!hash || hash === '') {
        hideDetailView();
        return;
    }

    const matchDetail = hash.match(/^match\/(result|fixture)\/(.+)$/);
    if (matchDetail) {
        renderMatchDetail(matchDetail[2], matchDetail[1]);
        return;
    }

    const teamDetail = hash.match(/^team\/(.+)$/);
    if (teamDetail) {
        renderTeamDetail(decodeURIComponent(teamDetail[1]));
        return;
    }

    // Unknown hash — clear detail view
    hideDetailView();
}
```

- [ ] **Step 5: Wire up listener + track active tab + handle initial hash**

Three small additions to `app.js`:

**5a.** At module level near the bottom of `app.js` (after the existing `loadData` call block), add:

```js
window.addEventListener('hashchange', handleHashChange);
```

**5b.** At the END of `initializeApp()`, just before the closing `}`, add:

```js
    // Handle deep-linked detail URL on page load
    if (window.location.hash) {
        handleHashChange();
    }
```

**5c.** In `showTab()`, add `lastActiveTab = tabName;` as the very first line of the function body:

```js
function showTab(tabName) {
    lastActiveTab = tabName;
    // ... rest of existing showTab unchanged
```

After these three additions `showTab` starts with:

```js
function showTab(tabName) {
    lastActiveTab = tabName;
    // ... rest of existing showTab unchanged
```

- [ ] **Step 6: Verify routing works**

Open the app, load data, then manually type `#team/SomeClub` in the address bar. The detail view should appear (even if empty/loading). Pressing back should return to the tab view.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "Add hash routing infrastructure for detail pages"
```

---

### Task 5: Add renderApiSection() generic renderer

**Files:**
- Modify: `app.js`

A reusable function that renders any object from the Dribl API into a styled card with key-value rows.

- [ ] **Step 1: Add the function**

```js
function snakeToTitle(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderApiSection(data, title, skipFields) {
    if (!data || typeof data !== 'object') return '';
    skipFields = skipFields || [];

    const entries = Object.entries(data).filter(([k]) => !skipFields.includes(k));
    if (entries.length === 0) return '';

    let rows = '';
    entries.forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;

        let displayValue;
        if (Array.isArray(value)) {
            if (value.length === 0) return;
            if (typeof value[0] === 'object' && value[0] !== null) {
                displayValue = '<div class="space-y-1">' +
                    value.map(item => renderApiSection(item, '', [])).join('') +
                    '</div>';
            } else {
                displayValue = value.join(', ');
            }
        } else if (typeof value === 'object') {
            displayValue = renderApiSection(value, '', []);
        } else {
            displayValue = String(value);
        }

        rows += `
            <div class="flex py-2 border-b border-gray-100 last:border-0">
                <div class="w-40 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase pt-0.5">${snakeToTitle(key)}</div>
                <div class="flex-1 text-sm text-gray-800">${displayValue}</div>
            </div>`;
    });

    if (!rows) return '';

    return `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            ${title ? `<h3 class="text-lg font-bold mb-4">${title}</h3>` : ''}
            <div>${rows}</div>
        </div>`;
}
```

- [ ] **Step 2: Verify**

In the browser console, after data loads:
```js
console.log(renderApiSection({ home_team_name: 'Test FC', home_score: 2 }, 'Test Section', []))
```
Expected: HTML string with a card containing two key-value rows.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Add renderApiSection generic API data renderer"
```

---

### Task 6: Add renderMatchDetail()

**Files:**
- Modify: `app.js`

Renders the match detail page. Immediately shows a header from in-memory data, then fetches the Dribl detail endpoint and appends any additional fields.

- [ ] **Step 1: Add the function**

```js
async function renderMatchDetail(id, type) {
    const dataSet = type === 'result' ? resultsData : fixturesData;
    const match = dataSet.find(m => m.id === id);

    if (!match) {
        showDetailView(`
            <div class="text-center py-16 text-gray-500">Match not found.</div>
            <div class="text-center mt-4">
                <button onclick="history.back()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">← Back</button>
            </div>`);
        return;
    }

    const attrs = match.attributes;
    const isResult = type === 'result';
    const date = new Date(attrs.date);
    const dateStr = date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

    const scoreHtml = isResult
        ? `<div class="flex items-center justify-center gap-4 text-4xl font-bold my-4">
               <span class="${attrs.home_score > attrs.away_score ? 'text-green-600' : 'text-gray-700'}">${attrs.home_score}</span>
               <span class="text-gray-400">-</span>
               <span class="${attrs.away_score > attrs.home_score ? 'text-green-600' : 'text-gray-700'}">${attrs.away_score}</span>
           </div>`
        : `<div class="text-center text-2xl font-bold text-gray-400 my-4">vs</div>`;

    const headerHtml = `
        <button onclick="history.back()" class="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold">
            ← Back
        </button>
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3 flex-1 justify-end text-right">
                    <div>
                        <div class="font-bold text-lg cursor-pointer hover:text-blue-600"
                             onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(getClubName(attrs.home_team_name))}">
                            ${attrs.home_team_name}
                        </div>
                    </div>
                    <img src="${attrs.home_logo}" alt="${attrs.home_team_name}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">
                </div>
                <div class="text-center min-w-24">
                    ${scoreHtml}
                </div>
                <div class="flex items-center gap-3 flex-1 justify-start">
                    <img src="${attrs.away_logo}" alt="${attrs.away_team_name}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">
                    <div>
                        <div class="font-bold text-lg cursor-pointer hover:text-blue-600"
                             onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(getClubName(attrs.away_team_name))}">
                            ${attrs.away_team_name}
                        </div>
                    </div>
                </div>
            </div>
            <div class="text-center text-sm text-gray-500 mt-4 space-y-1">
                <div>${dateStr} at ${timeStr}</div>
                <div>${attrs.league_name} · ${attrs.full_round || attrs.round}</div>
                <div>${attrs.ground_name}${attrs.field_name ? ' · ' + attrs.field_name : ''}</div>
            </div>
        </div>
        <div id="match-api-data">
            <div class="text-center py-4 text-gray-400 text-sm">Loading additional match data...</div>
        </div>`;

    showDetailView(headerHtml);

    // Fetch additional detail from Dribl
    const endpoint = type === 'result' ? 'results' : 'fixtures';
    const url = `https://mc-api.dribl.com/api/${endpoint}/${id}?tenant=w8zdBWPmBX&timezone=Australia%2FSydney`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const json = await response.json();
        const detail = json.data;

        const skipFields = [
            'home_team_name', 'away_team_name', 'home_score', 'away_score',
            'date', 'round', 'full_round', 'ground_name', 'field_name',
            'league_name', 'home_logo', 'away_logo', 'status'
        ];

        let sections = '';
        if (detail && detail.attributes) {
            sections += renderApiSection(detail.attributes, 'Match Details', skipFields);
        }
        if (detail && detail.relationships) {
            sections += renderApiSection(detail.relationships, 'Related Data', []);
        }

        const apiContainer = document.getElementById('match-api-data');
        if (apiContainer) {
            apiContainer.innerHTML = sections || '';
        }
    } catch (err) {
        const apiContainer = document.getElementById('match-api-data');
        if (apiContainer) apiContainer.innerHTML = '';
    }
}
```

- [ ] **Step 2: Verify**

In the browser console, after data loads, call:
```js
renderMatchDetail(resultsData[0].id, 'result')
```
Expected: detail page renders with header, score, and "Loading additional match data..." placeholder, then either populated data or blank (depending on API response).

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Add renderMatchDetail page"
```

---

### Task 7: Add renderTeamDetail()

**Files:**
- Modify: `app.js`

Renders the team detail page using in-memory data for season stats, results, and fixtures, plus an optional Dribl team profile API call.

- [ ] **Step 1: Add the function**

```js
async function renderTeamDetail(clubName) {
    const logo = clubLogoMap[clubName] || '';
    const divisionName = divisions[currentGender][currentDivision]
        ? divisions[currentGender][currentDivision].fullName
        : '';

    // Season summary (aggregate all age groups)
    const stats = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    const ageGroupRows = [];

    leaguesData.forEach(league => {
        const ladder = calculateLadder(league.name);
        const team = ladder.find(t => getClubName(t.name) === clubName);
        if (team) {
            stats.played += team.played;
            stats.won += team.won;
            stats.drawn += team.drawn;
            stats.lost += team.lost;
            stats.gf += team.goalsFor;
            stats.ga += team.goalsAgainst;
            stats.gd += team.goalDifference;
            stats.pts += team.points;
            const pos = ladder.indexOf(team) + 1;
            ageGroupRows.push(`
                <tr class="border-b border-gray-100 last:border-0">
                    <td class="py-2 pr-4 font-medium text-sm">${league.name}</td>
                    <td class="py-2 px-4 text-center text-sm">${pos}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.played}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.won}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.drawn}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.lost}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.goalsFor}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.goalsAgainst}</td>
                    <td class="py-2 px-4 text-center text-sm font-semibold ${team.goalDifference >= 0 ? 'text-green-600' : 'text-red-600'}">${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
                    <td class="py-2 px-4 text-center text-sm font-bold text-blue-600">${team.points}</td>
                </tr>`);
        }
    });

    // Recent results (last 10, newest first)
    const clubResults = resultsData
        .filter(r => {
            const attrs = r.attributes;
            return attrs.status === 'complete' &&
                (getClubName(attrs.home_team_name) === clubName || getClubName(attrs.away_team_name) === clubName);
        })
        .sort((a, b) => new Date(b.attributes.date) - new Date(a.attributes.date))
        .slice(0, 10);

    const recentResultsHtml = clubResults.map(r => {
        const attrs = r.attributes;
        const isHome = getClubName(attrs.home_team_name) === clubName;
        const opponent = isHome ? attrs.away_team_name : attrs.home_team_name;
        const opponentLogo = isHome ? attrs.away_logo : attrs.home_logo;
        const clubScore = isHome ? attrs.home_score : attrs.away_score;
        const oppScore = isHome ? attrs.away_score : attrs.home_score;
        const outcome = clubScore > oppScore ? 'W' : clubScore < oppScore ? 'L' : 'D';
        const outcomeColor = outcome === 'W' ? 'bg-green-100 text-green-700' : outcome === 'L' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
        const date = new Date(attrs.date);
        const dateStr = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

        return `
            <div class="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50"
                 onclick="navigateToMatch('${escAttr(r.id)}', 'result')">
                <span class="text-xs text-gray-400 w-16">${dateStr}</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded ${outcomeColor} w-6 text-center">${outcome}</span>
                <img src="${opponentLogo}" class="w-6 h-6 object-contain" onerror="this.style.display='none'">
                <span class="flex-1 text-sm">${isHome ? 'vs' : '@'} ${opponent}</span>
                <span class="text-sm font-bold">${clubScore}–${oppScore}</span>
                <span class="text-xs text-gray-400">${attrs.league_name}</span>
            </div>`;
    }).join('');

    // Upcoming fixtures
    const clubFixtures = fixturesData
        .filter(f => {
            const attrs = f.attributes;
            return attrs.status === 'pending' &&
                (getClubName(attrs.home_team_name) === clubName || getClubName(attrs.away_team_name) === clubName);
        })
        .sort((a, b) => new Date(a.attributes.date) - new Date(b.attributes.date));

    const fixturesHtml = clubFixtures.map(f => {
        const attrs = f.attributes;
        const isHome = getClubName(attrs.home_team_name) === clubName;
        const opponent = isHome ? attrs.away_team_name : attrs.home_team_name;
        const opponentLogo = isHome ? attrs.away_logo : attrs.home_logo;
        const date = new Date(attrs.date);
        const dateStr = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50"
                 onclick="navigateToMatch('${escAttr(f.id)}', 'fixture')">
                <span class="text-xs text-gray-400 w-32">${dateStr} ${timeStr}</span>
                <img src="${opponentLogo}" class="w-6 h-6 object-contain" onerror="this.style.display='none'">
                <span class="flex-1 text-sm">${isHome ? 'vs' : '@'} ${opponent}</span>
                <span class="text-xs text-gray-400">${attrs.league_name}</span>
                <span class="text-xs text-gray-400">${attrs.full_round || attrs.round}</span>
            </div>`;
    }).join('');

    const html = `
        <button onclick="history.back()" class="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold">
            ← Back
        </button>

        <div class="bg-blue-600 text-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center gap-4">
                ${logo ? `<img src="${logo}" alt="${escAttr(clubName)}" class="w-16 h-16 object-contain bg-white rounded p-1">` : ''}
                <div>
                    <h2 class="text-2xl font-bold">${clubName}</h2>
                    <p class="text-blue-100">${divisionName} · 2026</p>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 class="text-lg font-bold mb-4">Season Summary</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-center">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">P</th>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">W</th>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">D</th>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">L</th>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">GF</th>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">GA</th>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">GD</th>
                            <th class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="px-3 py-3">${stats.played}</td>
                            <td class="px-3 py-3">${stats.won}</td>
                            <td class="px-3 py-3">${stats.drawn}</td>
                            <td class="px-3 py-3">${stats.lost}</td>
                            <td class="px-3 py-3">${stats.gf}</td>
                            <td class="px-3 py-3">${stats.ga}</td>
                            <td class="px-3 py-3 font-semibold ${stats.gd >= 0 ? 'text-green-600' : 'text-red-600'}">${stats.gd > 0 ? '+' : ''}${stats.gd}</td>
                            <td class="px-3 py-3 font-bold text-blue-600">${stats.pts}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        ${ageGroupRows.length ? `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 class="text-lg font-bold mb-4">Age Group Breakdown</h3>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="py-2 pr-4 text-left text-xs font-semibold text-gray-500 uppercase">Age Group</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Pos</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">P</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">W</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">D</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">L</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">GF</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">GA</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">GD</th>
                            <th class="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase">Pts</th>
                        </tr>
                    </thead>
                    <tbody>${ageGroupRows.join('')}</tbody>
                </table>
            </div>
        </div>` : ''}

        ${recentResultsHtml ? `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 class="text-lg font-bold mb-4">Recent Results</h3>
            ${recentResultsHtml}
        </div>` : ''}

        ${fixturesHtml ? `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 class="text-lg font-bold mb-4">Upcoming Fixtures</h3>
            ${fixturesHtml}
        </div>` : ''}

        <div id="team-api-data">
            <div class="text-center py-4 text-gray-400 text-sm">Loading club profile...</div>
        </div>`;

    showDetailView(html);

    // Fetch team profile from Dribl (best-effort)
    const apiContainer = document.getElementById('team-api-data');
    try {
        // Find a team ID for any age group team belonging to this club
        const teamId = Object.entries(teamIdMap).find(([name]) => getClubName(name) === clubName)?.[1];
        if (!teamId) throw new Error('no team id');

        const url = `https://mc-api.dribl.com/api/teams/${teamId}?tenant=w8zdBWPmBX`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const json = await response.json();

        const sections = renderApiSection(json.data?.attributes || json.data || json, 'Club Profile', []);
        if (apiContainer) apiContainer.innerHTML = sections || '';
    } catch {
        if (apiContainer) apiContainer.innerHTML = '';
    }
}
```

- [ ] **Step 2: Verify**

In the browser console after data loads, call:
```js
renderTeamDetail('Heidelberg United')
```
(Replace with an actual club name from the current division.)

Expected: detail page renders with header, season summary, age group breakdown, recent results, upcoming fixtures, and either club profile data or blank.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Add renderTeamDetail page"
```

---

### Task 8: Make combined ladder rows clickable

**Files:**
- Modify: `app.js` — `renderCombinedLadder()` function

The entire combined ladder row navigates to the team detail page on click.

- [ ] **Step 1: Update the row `<tr>` in renderCombinedLadder()**

Find this line inside `renderCombinedLadder()`:
```js
        html += `
            <tr class="${rowClass}">
                <td class="px-4 py-3 font-semibold">${position}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <img src="${club.logo}" alt="${club.name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                        <span class="font-medium">${club.name}</span>
                    </div>
                </td>
```

Replace with:
```js
        html += `
            <tr class="${rowClass} cursor-pointer hover:bg-blue-50"
                onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(club.name)}">
                <td class="px-4 py-3 font-semibold">${position}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <img src="${club.logo}" alt="${club.name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                        <span class="font-medium text-blue-700">${club.name}</span>
                    </div>
                </td>
```

- [ ] **Step 2: Verify**

Reload the app, go to Combined Club Ladder tab, click a club row. Expected: team detail page renders for that club. Press back. Expected: Combined ladder tab is shown again.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Make combined ladder rows clickable for team detail"
```

---

### Task 9: Make age group ladder rows clickable

**Files:**
- Modify: `app.js` — `renderAgeGroupLadders()` function

- [ ] **Step 1: Update the row `<tr>` in renderAgeGroupLadders()**

Find this line inside `renderAgeGroupLadders()`:
```js
            laddersHtml += `
                <tr class="ladder-row">
                    <td class="px-4 py-3 font-semibold">${index + 1}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                            <img src="${team.logo}" alt="${team.name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                            <span class="font-medium">${team.name}</span>
                        </div>
                    </td>
```

Replace with:
```js
            const clubName = getClubName(team.name);
            laddersHtml += `
                <tr class="ladder-row cursor-pointer hover:bg-blue-50"
                    onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(clubName)}">
                    <td class="px-4 py-3 font-semibold">${index + 1}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                            <img src="${team.logo}" alt="${team.name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                            <span class="font-medium text-blue-700">${team.name}</span>
                        </div>
                    </td>
```

- [ ] **Step 2: Verify**

Reload, go to Age Group Ladders tab, click a team row. Expected: team detail page renders. Press back. Expected: Age Group Ladders tab is restored.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Make age group ladder rows clickable for team detail"
```

---

### Task 10: Make fixture rows clickable

**Files:**
- Modify: `app.js` — `renderFixtures()` function

The entire row navigates to match detail. Team names within the row also navigate to team detail (with `event.stopPropagation()`).

- [ ] **Step 1: Update the fixture row div in renderFixtures()**

Find this block inside `renderFixtures()`:
```js
            html += `
                <div class="p-6 hover:bg-gray-50 border-b border-gray-100">
                    <div class="flex items-center gap-4">
                        <!-- Date and Time -->
                        <div class="text-sm text-gray-600 w-32">
                            <div class="font-medium">${dateStr}</div>
                            <div>${timeStr}</div>
                        </div>
                        
                        <!-- Teams and Info -->
                        <div class="flex-1">
                            <div class="flex items-center justify-center gap-4 mb-2">
                                <div class="flex items-center gap-2 flex-1 justify-end">
                                    <span class="font-semibold text-right">${attrs.home_team_name}</span>
                                    <img src="${attrs.home_logo}" alt="${attrs.home_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                </div>
                                <span class="text-gray-400 font-bold px-2">-</span>
                                <div class="flex items-center gap-2 flex-1">
                                    <img src="${attrs.away_logo}" alt="${attrs.away_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                    <span class="font-semibold">${attrs.away_team_name}</span>
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-600 flex items-center justify-center gap-2">
                                <span>${attrs.league_name}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-500">${attrs.ground_name}</span>
                                ${attrs.field_name ? `<span class="text-gray-400">•</span><span class="text-gray-500">${attrs.field_name}</span>` : ''}
                            </div>
                        </div>
                        
                        <!-- Round -->
                        <div class="text-sm text-right w-24">
                            <div class="font-medium">${attrs.round}</div>
                        </div>
                    </div>
                </div>
            `;
```

Replace with:
```js
            html += `
                <div class="p-6 hover:bg-blue-50 border-b border-gray-100 cursor-pointer"
                     onclick="navigateToMatch('${escAttr(fixture.id)}', 'fixture')">
                    <div class="flex items-center gap-4">
                        <!-- Date and Time -->
                        <div class="text-sm text-gray-600 w-32">
                            <div class="font-medium">${dateStr}</div>
                            <div>${timeStr}</div>
                        </div>
                        
                        <!-- Teams and Info -->
                        <div class="flex-1">
                            <div class="flex items-center justify-center gap-4 mb-2">
                                <div class="flex items-center gap-2 flex-1 justify-end">
                                    <span class="font-semibold text-right text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.home_team_name))}')">${attrs.home_team_name}</span>
                                    <img src="${attrs.home_logo}" alt="${attrs.home_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                </div>
                                <span class="text-gray-400 font-bold px-2">-</span>
                                <div class="flex items-center gap-2 flex-1">
                                    <img src="${attrs.away_logo}" alt="${attrs.away_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                    <span class="font-semibold text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.away_team_name))}')">${attrs.away_team_name}</span>
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-600 flex items-center justify-center gap-2">
                                <span>${attrs.league_name}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-500">${attrs.ground_name}</span>
                                ${attrs.field_name ? `<span class="text-gray-400">•</span><span class="text-gray-500">${attrs.field_name}</span>` : ''}
                            </div>
                        </div>
                        
                        <!-- Round -->
                        <div class="text-sm text-right w-24">
                            <div class="font-medium">${attrs.round}</div>
                        </div>
                    </div>
                </div>
            `;
```

- [ ] **Step 2: Verify**

Reload, go to Fixtures tab, click a fixture row. Expected: fixture detail page renders. Click back. Expected: Fixtures tab restored, same age group and round filters still set.

Also click a team name within a fixture row (not the row itself). Expected: team detail page renders.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Make fixture rows and team names clickable"
```

---

### Task 11: Make result rows clickable

**Files:**
- Modify: `app.js` — `renderResults()` function

- [ ] **Step 1: Update the result row div in renderResults()**

Find this block inside `renderResults()`:
```js
            html += `
                <div class="p-6 hover:bg-gray-50 border-b border-gray-100">
                    <div class="flex items-center gap-4">
                        <!-- Date -->
                        <div class="text-sm text-gray-600 w-32">
                            <div class="font-medium">${dateStr}</div>
                        </div>
                        
                        <!-- Teams with Scores and Info -->
                        <div class="flex-1">
                            <div class="flex items-center justify-center gap-4 mb-2">
                                <div class="flex items-center gap-2 flex-1 justify-end">
                                    <span class="font-semibold text-right">${attrs.home_team_name}</span>
                                    <img src="${attrs.home_logo}" alt="${attrs.home_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xl font-bold ${attrs.home_score > attrs.away_score ? 'text-green-600' : 'text-gray-600'}">${attrs.home_score}</span>
                                    <span class="text-gray-400 font-bold">-</span>
                                    <span class="text-xl font-bold ${attrs.away_score > attrs.home_score ? 'text-green-600' : 'text-gray-600'}">${attrs.away_score}</span>
                                </div>
                                <div class="flex items-center gap-2 flex-1">
                                    <img src="${attrs.away_logo}" alt="${attrs.away_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                    <span class="font-semibold">${attrs.away_team_name}</span>
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-600 flex items-center justify-center gap-2">
                                <span>${attrs.league_name}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-500">${attrs.ground_name}</span>
                            </div>
                        </div>
                        
                        <!-- Round -->
                        <div class="text-sm text-right w-24">
                            <div class="font-medium">${attrs.round}</div>
                        </div>
                    </div>
                </div>
            `;
```

Replace with:
```js
            html += `
                <div class="p-6 hover:bg-blue-50 border-b border-gray-100 cursor-pointer"
                     onclick="navigateToMatch('${escAttr(result.id)}', 'result')">
                    <div class="flex items-center gap-4">
                        <!-- Date -->
                        <div class="text-sm text-gray-600 w-32">
                            <div class="font-medium">${dateStr}</div>
                        </div>
                        
                        <!-- Teams with Scores and Info -->
                        <div class="flex-1">
                            <div class="flex items-center justify-center gap-4 mb-2">
                                <div class="flex items-center gap-2 flex-1 justify-end">
                                    <span class="font-semibold text-right text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.home_team_name))}')">${attrs.home_team_name}</span>
                                    <img src="${attrs.home_logo}" alt="${attrs.home_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xl font-bold ${attrs.home_score > attrs.away_score ? 'text-green-600' : 'text-gray-600'}">${attrs.home_score}</span>
                                    <span class="text-gray-400 font-bold">-</span>
                                    <span class="text-xl font-bold ${attrs.away_score > attrs.home_score ? 'text-green-600' : 'text-gray-600'}">${attrs.away_score}</span>
                                </div>
                                <div class="flex items-center gap-2 flex-1">
                                    <img src="${attrs.away_logo}" alt="${attrs.away_team_name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                    <span class="font-semibold text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.away_team_name))}')">${attrs.away_team_name}</span>
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-600 flex items-center justify-center gap-2">
                                <span>${attrs.league_name}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-500">${attrs.ground_name}</span>
                            </div>
                        </div>
                        
                        <!-- Round -->
                        <div class="text-sm text-right w-24">
                            <div class="font-medium">${attrs.round}</div>
                        </div>
                    </div>
                </div>
            `;
```

- [ ] **Step 2: Verify**

Reload, go to Results tab, click a result row. Expected: match detail with score renders. Click back. Expected: Results tab restored with filters intact.

Also click a team name within a result row. Expected: team detail page renders.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "Make result rows and team names clickable"
```

---

### Task 12: End-to-end verification + final commit

- [ ] **Step 1: Verify all existing functionality is unchanged**

Check each of these still works:
- Gender selector → loads new division
- Division selector → loads new division
- Refresh Data button → reloads data
- Combined Ladder age group filter buttons (All, U13, U14, etc.)
- Age Group Ladders tab + age group switcher buttons
- Fixtures tab + age group and round filters
- Results tab + age group and round filters

- [ ] **Step 2: Verify detail pages**

- Click a club row in Combined Ladder → team detail page
- Click a team row in Age Group Ladders → team detail page
- Click a result row → match detail page with score
- Click a fixture row → fixture detail page
- Click a team name inside a result row → team detail page (not match detail)
- Click a team name inside a fixture row → team detail page (not match detail)
- On any detail page, press ← Back → correct tab is restored
- Navigate directly to a hash URL like `#team/Heidelberg%20United` → team detail renders after data loads

- [ ] **Step 3: Verify .gitignore includes backup files**

Add to `.gitignore` if not present:
```
*.bak
```

```bash
git add .gitignore
git commit -m "Ignore .bak backup files"
```

- [ ] **Step 4: Final commit**

```bash
git add app.js index.html
git commit -m "Add match and team detail pages with Dribl API data"
```

- [ ] **Step 5: Deploy**

```bash
git push origin main
```

The GitHub Pages deployment will update automatically within ~1 minute.
