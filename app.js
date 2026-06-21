// VPL Rankings Application
let leaguesData = [];
let fixturesData = [];
let resultsData = [];
let roundsData = [];
let currentGender = 'boys'; // kept for compatibility but unused
let currentDivision = 'bgdMX6MDKE'; // Default to Boys YPL1

// Division configuration (flat — gender included in fullName)
const divisions = {
    boys: {
        'bgdMX6MDKE': { name: 'Boys YPL1', fullName: 'Boys Victorian Youth Premier League 1', combined: true },
        'Bjma0zXAdR': { name: 'Boys YPL2', fullName: 'Boys Victorian Youth Premier League 2', combined: true },
        'AnmYznkyNz': { name: 'Boys BVYSL NW', fullName: 'Boys Victorian Youth State League North-West', combined: false },
        '2PmjO2pANZ': { name: 'Boys BVYSL SE', fullName: 'Boys Victorian Youth State League South-East', combined: false },
        '3pmvQvbDdv': { name: 'Girls YPL', fullName: 'Girls Victorian Youth Premier League', combined: true },
        'vbd918ywd4': { name: 'Saturday Mixed', fullName: 'Saturday Mixed', combined: false },
        'nPmrBVjAmo': { name: 'Sunday Mixed', fullName: 'Sunday Mixed', combined: false },
        'wOmejBq1N0': { name: "Men's State League", fullName: "Men's State League", combined: false }
    },
    girls: {}
};

const divisionCache = {};

async function fetchAllPagesForLeague(endpoint, leagueId, divisionId) {
    const baseUrl = 'https://mc-api.dribl.com/api';
    const params = `season=nPmrj2rmow&competition=${divisionId}&tenant=w8zdBWPmBX&timezone=Australia/Sydney`;
    let allData = [];
    let cursor = null;
    let hasMore = true;
    while (hasMore) {
        const cursorPart = cursor ? `&cursor=${cursor}` : '';
        const url = `${baseUrl}/${endpoint}?${params}&league=${leagueId}${cursorPart}`;
        try {
            const response = await fetch(url);
            const json = await response.json();
            if (json.data && json.data.length > 0) allData = allData.concat(json.data);
            const meta = json.meta || {};
            if (endpoint === 'results' && meta.prev_cursor) {
                cursor = meta.prev_cursor;
            } else if (endpoint === 'fixtures' && meta.next_cursor) {
                cursor = meta.next_cursor;
            } else {
                hasMore = false;
            }
        } catch (err) {
            hasMore = false;
        }
    }
    return allData;
}

async function loadDivisionData(divisionId) {
    if (divisionCache[divisionId]) return divisionCache[divisionId];
    const baseUrl = 'https://mc-api.dribl.com/api';
    try {
        const leaguesJson = await fetch(`${baseUrl}/list/leagues?season=nPmrj2rmow&competition=${divisionId}&tenant=w8zdBWPmBX`).then(r => r.json());
        const leagues = leaguesJson.data || [];
        const [results, fixtures] = await Promise.all([
            Promise.all(leagues.map(l => fetchAllPagesForLeague('results', l.id, divisionId))).then(a => a.flat()),
            Promise.all(leagues.map(l => fetchAllPagesForLeague('fixtures', l.id, divisionId))).then(a => a.flat())
        ]);
        divisionCache[divisionId] = { leagues, results, fixtures };
    } catch (e) {
        divisionCache[divisionId] = { leagues: [], results: [], fixtures: [] };
    }
    return divisionCache[divisionId];
}

// Load all data on page load
async function loadData(gender = 'boys', divisionId = null) {
    try {
        currentGender = gender;
        const allDivisions = divisions.boys;

        // If no division specified, use first division
        if (!divisionId) {
            divisionId = Object.keys(allDivisions)[0];
        }
        currentDivision = divisionId;

        // Show loading message
        document.getElementById('combined-ladder').innerHTML = `<div class="text-center py-8 text-gray-500">Loading ${allDivisions[divisionId].fullName} data from API...</div>`;
        
        const baseUrl = 'https://mc-api.dribl.com/api';
        const params = `date_range=default&season=nPmrj2rmow&competition=${divisionId}&tenant=w8zdBWPmBX&timezone=Australia/Sydney`;
        
        // Fetch leagues from API and rounds from local file
        const [leagues, rounds] = await Promise.all([
            fetch(`${baseUrl}/list/leagues?season=nPmrj2rmow&competition=${divisionId}&tenant=w8zdBWPmBX`).then(r => r.json()),
            fetch('api-responses/rounds-api.json').then(r => r.json())
        ]);
        
        leaguesData = leagues.data || [];
        roundsData = rounds || [];
        
        // Fetch fixtures and results for each league with pagination
        const leagueIds = leaguesData.map(l => l.id);
        
        // Helper function to fetch all pages.
        // Dribl returns results newest-first (follow prev_cursor for history).
        // Fixtures are returned oldest-first (follow next_cursor for more upcoming).
        // Neither uses date_range so we get the full season.
        async function fetchAllPages(endpoint, leagueId) {
            const epParams = `season=nPmrj2rmow&competition=${divisionId}&tenant=w8zdBWPmBX&timezone=Australia/Sydney`;
            let allData = [];
            let cursor = null;
            let hasMore = true;
            while (hasMore) {
                const cursorPart = cursor ? `&cursor=${cursor}` : '';
                const url = `${baseUrl}/${endpoint}?${epParams}&league=${leagueId}${cursorPart}`;
                try {
                    const response = await fetch(url);
                    const json = await response.json();
                    if (json.data && json.data.length > 0) allData = allData.concat(json.data);
                    const meta = json.meta || {};
                    if (endpoint === 'results' && meta.prev_cursor) {
                        cursor = meta.prev_cursor;
                    } else if (endpoint === 'fixtures' && meta.next_cursor) {
                        cursor = meta.next_cursor;
                    } else {
                        hasMore = false;
                    }
                } catch (err) {
                    hasMore = false;
                }
            }
            return allData;
        }
        
        // Fetch all fixtures with pagination
        const fixturesPromises = leagueIds.map(leagueId => fetchAllPages('fixtures', leagueId));
        const resultsPromises = leagueIds.map(leagueId => fetchAllPages('results', leagueId));
        
        const fixturesArrays = await Promise.all(fixturesPromises);
        const resultsArrays = await Promise.all(resultsPromises);
        
        // Combine all fixtures and results
        fixturesData = fixturesArrays.flat();
        resultsData = resultsArrays.flat();
        divisionCache[divisionId] = { leagues: leaguesData, results: resultsData, fixtures: fixturesData };
        
        console.log(`Loaded ${leaguesData.length} leagues`);
        console.log(`Loaded ${fixturesData.length} fixtures`);
        console.log(`Loaded ${resultsData.length} results`);

        initializeApp();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data. Please check console.');
    }
}

// Update ladder description based on gender
function updateLadderDescription(gender) {
    const descriptionEl = document.getElementById('ladder-description');
    const zonesEl = document.getElementById('ladder-zones');
    
    if (gender === 'boys') {
        descriptionEl.textContent = 'Aggregate standings across all age groups (U13, U14, U15, U16, U18)';
        
        // BVYPL1: only show relegation zone (no promotion from top division)
        if (currentDivision === 'bgdMX6MDKE') {
            zonesEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-red-200 border border-red-300"></div>
                    <span>Relegation (Bottom 2 to BVYPL2)</span>
                </div>
            `;
        } else if (currentDivision === 'Bjma0zXAdR') {
            // BVYPL2: promotion to BVYPL1, relegation to BYSL
            zonesEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-green-200 border border-green-300"></div>
                    <span>Promotion (Top 2 to BVYPL1)</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-red-200 border border-red-300"></div>
                    <span>Relegation (Bottom 2 to BYSL)</span>
                </div>
            `;
        } else {
            // BYSL divisions: promotion to BVYPL2, relegation out of pyramid
            zonesEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-green-200 border border-green-300"></div>
                    <span>Promotion (1st place to BVYPL2)</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-4 h-4 bg-red-200 border border-red-300"></div>
                    <span>Relegation (Last place out of pyramid)</span>
                </div>
            `;
        }
    } else {
        descriptionEl.textContent = 'Aggregate standings across all age groups (U13, U15, U17)';
        zonesEl.innerHTML = ''; // No promotion/relegation for girls
    }
}

// Populate division dropdown
function populateDivisionDropdown() {
    const divisionSelector = document.getElementById('division-selector');
    const allDivisions = divisions.boys;
    let options = '';
    Object.keys(allDivisions).forEach(id => {
        options += `<option value="${id}">${escHtml(allDivisions[id].fullName)}</option>`;
    });
    divisionSelector.innerHTML = options;
}

// Refresh data for current division
async function refreshData() {
    const refreshButton = document.getElementById('refresh-button');
    const refreshIcon = document.getElementById('refresh-icon');
    
    // Disable button and add spinning animation
    refreshButton.disabled = true;
    refreshIcon.style.display = 'inline-block';
    refreshIcon.style.animation = 'spin 1s linear infinite';
    
    // Add CSS animation if not already present
    if (!document.getElementById('refresh-animation-style')) {
        const style = document.createElement('style');
        style.id = 'refresh-animation-style';
        style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }
    
    try {
        // Reload data for current gender and division
        await loadData(currentGender, currentDivision);
    } catch (error) {
        console.error('Error refreshing data:', error);
        alert('Failed to refresh data. Please try again.');
    } finally {
        // Re-enable button and stop animation
        refreshButton.disabled = false;
        refreshIcon.style.animation = '';
    }
}

// Initialize the application
function initializeApp() {
    buildLookupMaps();
    populateFilters();
    renderCombinedLadder();
    renderAgeGroupLadders();
    renderFixtures();
    renderResults();
    
    updateLadderDescription(currentGender);

    // Division selector
    const divisionSelector = document.getElementById('division-selector');
    populateDivisionDropdown();
    divisionSelector.value = currentDivision;
    divisionSelector.addEventListener('change', (e) => {
        localStorage.setItem('vpl_division', e.target.value);
        loadData('boys', e.target.value);
    });
    
    // Show/hide Combined tab based on division, then show appropriate default tab
    updateCombinedTabVisibility();

    // Handle deep-linked detail URL on page load
    if (window.location.hash) {
        handleHashChange();
    }
}

// Tab switching
function updateCombinedTabVisibility() {
    const hasCombined = divisions.boys[currentDivision]?.combined !== false;
    const combinedTab = document.getElementById('tab-combined');
    if (combinedTab) combinedTab.classList.toggle('hidden', !hasCombined);

    const groupLabel = hasCombined ? 'Age Group' : 'League';
    const laddersTab = document.getElementById('tab-ladders');
    if (laddersTab) laddersTab.textContent = hasCombined ? 'Age Group Ladders' : 'Ladders';
    const laddersHeading = document.querySelector('#content-ladders h2');
    if (laddersHeading) laddersHeading.textContent = hasCombined ? 'Age Group Ladders' : 'Ladders';
    document.querySelectorAll('.fixture-group-label, .result-group-label').forEach(el => {
        el.textContent = groupLabel;
    });

    showTab(hasCombined ? 'combined' : 'ladders');
}

function showTab(tabName) {
    lastActiveTab = tabName;

    // If a detail view is open, close it first (without recursing back into showTab)
    const detail = document.getElementById('detail-view');
    if (detail && !detail.classList.contains('hidden')) {
        detail.classList.add('hidden');
        detail.innerHTML = '';
        if (window.location.hash) history.pushState('', '', window.location.pathname);
    }

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('tab-active'));
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
    if (tabName === 'stats') {
        const statsEl = document.getElementById('stats-content');
        if (statsEl && !statsEl.innerHTML.trim()) resetLeagueStats();
    }
}

// Populate filter dropdowns
function populateFilters() {
    populateCombinedLadderFilters();
    // Get unique rounds from fixtures (pending matches only)
    const fixtureRounds = new Set();
    fixturesData.forEach(fixture => {
        if (fixture.attributes.status === 'pending') {
            const round = fixture.attributes.round;
            fixtureRounds.add(round);
        }
    });
    
    // Get unique rounds from results (completed matches only)
    const resultRounds = new Set();
    resultsData.forEach(result => {
        if (result.attributes.status === 'complete') {
            const round = result.attributes.round;
            resultRounds.add(round);
        }
    });
    
    // Populate round dropdown for Fixtures (only rounds with pending matches)
    const fixtureRoundDropdown = document.getElementById('fixture-round-dropdown');
    let fixtureRoundOptions = '<option value="">All Rounds</option>';
    roundsData.forEach(round => {
        const roundCode = round.value.replace('roundrobin_', 'R');
        if (fixtureRounds.has(roundCode)) {
            fixtureRoundOptions += `<option value="${round.value}">${round.title}</option>`;
        }
    });
    fixtureRoundDropdown.innerHTML = fixtureRoundOptions;
    fixtureRoundDropdown.addEventListener('change', (e) => {
        selectedFixtureRound = e.target.value;
        renderFixtures();
    });
    
    // Populate round dropdown for Results (only rounds with completed matches)
    const resultRoundDropdown = document.getElementById('result-round-dropdown');
    let resultRoundOptions = '<option value="">All Rounds</option>';
    roundsData.forEach(round => {
        const roundCode = round.value.replace('roundrobin_', 'R');
        if (resultRounds.has(roundCode)) {
            resultRoundOptions += `<option value="${round.value}">${round.title}</option>`;
        }
    });
    resultRoundDropdown.innerHTML = resultRoundOptions;
    resultRoundDropdown.addEventListener('change', (e) => {
        selectedResultRound = e.target.value;
        renderResults();
    });
    
    buildLeagueFilters();
}

// Global variables to track selected filters
let selectedFixtureLeague = '';
let selectedResultLeague = '';
let selectedLadderLeague = '';
let selectedStatsLeague = '';
const leagueStatsCache = {};
let selectedFixtureRound = '';
let selectedResultRound = '';
let selectedCombinedAgeGroups = new Set(); // empty = all selected

let teamIdMap = {};    // fullTeamName → teamId
let clubLogoMap = {};  // clubName (suffix-stripped) → logoUrl
const playerCache = {}; // hash_id → { player fields + teamName, teamLogo }

let cascadeAge = '';
let cascadeRegion = '';
let cascadeGrade = '';
let cascadeType = '';

function parseLeagueName(name) {
    if (!name) return null;

    // Men's State League: "State League N Men's - Region[ Reserves]"
    const stateMatch = name.match(/State League (\d+)\s+Men's\s*-\s*(.+)/i);
    if (stateMatch) {
        let region = stateMatch[2].trim();
        let type = 'Seniors';
        if (region.endsWith(' Reserves')) {
            type = 'Reserves';
            region = region.slice(0, -9).trim();
        }
        return { age: stateMatch[1], region, grade: null, type };
    }

    // Community leagues
    let n = name.replace(/^\([^)]*\)\s*/, '').replace(/^Mixed\s+/i, '').replace(/^(Saturday|Sunday)\s+/i, '');
    const regions = ['North-West', 'North-East', 'South-East', 'South-West', 'North', 'South', 'East', 'West'];
    let region = null;
    for (const r of regions) {
        if (n.startsWith(r + ' ')) { region = r; n = n.slice(r.length + 1); break; }
    }
    const m = n.match(/^(\d+)([A-D]?)\s*(Blue|Red|Yellow|Green)?/i);
    if (!m || !region) return null;
    const grade = [m[2], m[3] ? m[3].charAt(0).toUpperCase() + m[3].slice(1).toLowerCase() : ''].filter(Boolean).join(' ') || null;
    return { age: m[1], region, grade, type: null };
}

function buildLeagueFilters() {
    const parsed = leaguesData.map(l => ({ ...parseLeagueName(l.name), id: l.id }));
    const useCascade = parsed.some(p => p.region);

    if (!useCascade) {
        const saved = localStorage.getItem(`vpl_league_${currentGender}_${currentDivision}`);
        const validId = leaguesData.find(l => l.id === saved) ? saved : leaguesData[0]?.id || '';
        const opts = leaguesData.map(l => `<option value="${escAttr(l.id)}">${escHtml(l.name)}</option>`).join('');
        const html = `<select class="league-simple-select border rounded px-3 py-2 text-sm" onchange="setActiveLeague(this.value)">
            ${opts}
        </select>`;
        ['age-group-filters', 'fixture-age-group-filters', 'result-age-group-filters', 'stats-age-group-filters'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        });
        if (validId) setActiveLeague(validId);
        return;
    }

    const savedAge = localStorage.getItem(`vpl_cascade_age_${currentGender}_${currentDivision}`);
    const savedRegion = localStorage.getItem(`vpl_cascade_region_${currentGender}_${currentDivision}`);
    const savedGrade = localStorage.getItem(`vpl_cascade_grade_${currentGender}_${currentDivision}`);
    const savedType = localStorage.getItem(`vpl_cascade_type_${currentGender}_${currentDivision}`);
    setCascade(savedAge || '', savedRegion || '', savedGrade || '', savedType || '');
}

function setCascade(age, region, grade, type) {
    const parsed = leaguesData.map(l => ({ ...parseLeagueName(l.name), id: l.id })).filter(p => p && p.age);
    const ages = [...new Set(parsed.map(p => p.age))].sort((a, b) => +a - +b);

    cascadeAge = ages.includes(age) ? age : ages[0] || '';
    const regions = [...new Set(parsed.filter(p => p.age === cascadeAge).map(p => p.region))].sort();
    cascadeRegion = regions.includes(region) ? region : regions[0] || '';
    const grades = [...new Set(parsed.filter(p => p.age === cascadeAge && p.region === cascadeRegion).map(p => p.grade).filter(Boolean))].sort();
    cascadeGrade = grades.includes(grade) ? grade : grades[0] || '';
    const types = [...new Set(parsed.filter(p => p.age === cascadeAge && p.region === cascadeRegion).map(p => p.type).filter(Boolean))].sort();
    cascadeType = types.includes(type) ? type : types[0] || '';

    localStorage.setItem(`vpl_cascade_age_${currentGender}_${currentDivision}`, cascadeAge);
    localStorage.setItem(`vpl_cascade_region_${currentGender}_${currentDivision}`, cascadeRegion);
    localStorage.setItem(`vpl_cascade_grade_${currentGender}_${currentDivision}`, cascadeGrade);
    localStorage.setItem(`vpl_cascade_type_${currentGender}_${currentDivision}`, cascadeType);

    const match = parsed.find(p => {
        if (p.age !== cascadeAge || p.region !== cascadeRegion) return false;
        if (types.length > 0) return p.type === cascadeType;
        return p.grade === (cascadeGrade || null);
    });
    if (match) setActiveLeague(match.id);

    ['age-group-filters', 'fixture-age-group-filters', 'result-age-group-filters', 'stats-age-group-filters'].forEach(id => {
        renderCascadeUI(id, parsed, ages);
    });
}

function renderCascadeUI(containerId, parsed, ages) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const regions = [...new Set(parsed.filter(p => p.age === cascadeAge).map(p => p.region))].sort();
    const grades = [...new Set(parsed.filter(p => p.age === cascadeAge && p.region === cascadeRegion).map(p => p.grade).filter(Boolean))].sort();
    const types = [...new Set(parsed.filter(p => p.age === cascadeAge && p.region === cascadeRegion).map(p => p.type).filter(Boolean))].sort();
    const isStatLeague = types.length > 0;
    const ageLabel = isStatLeague ? 'Level' : 'Age';
    const agePrefix = isStatLeague ? 'State League ' : 'U';

    let html = `<div class="flex flex-wrap gap-3">
        <div>
            <label class="block text-xs text-gray-500 mb-1">${ageLabel}</label>
            <select class="border rounded px-3 py-2 text-sm" onchange="setCascade(this.value,cascadeRegion,cascadeGrade,cascadeType)">
                ${ages.map(a => `<option value="${a}"${a === cascadeAge ? ' selected' : ''}>${agePrefix}${escHtml(a)}</option>`).join('')}
            </select>
        </div>
        <div>
            <label class="block text-xs text-gray-500 mb-1">Region</label>
            <select class="border rounded px-3 py-2 text-sm" onchange="setCascade(cascadeAge,this.value,cascadeGrade,cascadeType)">
                ${regions.map(r => `<option value="${r}"${r === cascadeRegion ? ' selected' : ''}>${escHtml(r)}</option>`).join('')}
            </select>
        </div>`;
    if (grades.length > 0) {
        html += `<div>
            <label class="block text-xs text-gray-500 mb-1">Grade</label>
            <select class="border rounded px-3 py-2 text-sm" onchange="setCascade(cascadeAge,cascadeRegion,this.value,cascadeType)">
                ${grades.map(g => `<option value="${g}"${g === cascadeGrade ? ' selected' : ''}>${escHtml(g)}</option>`).join('')}
            </select>
        </div>`;
    }
    if (types.length > 1) {
        html += `<div>
            <label class="block text-xs text-gray-500 mb-1">Type</label>
            <select class="border rounded px-3 py-2 text-sm" onchange="setCascade(cascadeAge,cascadeRegion,cascadeGrade,this.value)">
                ${types.map(t => `<option value="${t}"${t === cascadeType ? ' selected' : ''}>${escHtml(t)}</option>`).join('')}
            </select>
        </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}
let lastActiveTab = 'combined'; // restored when detail view is dismissed

function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showDetailView(html) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const detail = document.getElementById('detail-view');
    detail.innerHTML = html;
    detail.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function hideDetailView() {
    const detail = document.getElementById('detail-view');
    detail.classList.add('hidden');
    detail.innerHTML = '';
    showTab(lastActiveTab);
}

function showTeamTab(name) {
    ['overview', 'squad', 'results', 'fixtures'].forEach(t => {
        const panel = document.getElementById('team-panel-' + t);
        const btn = document.getElementById('team-tab-' + t);
        if (panel) panel.classList.toggle('hidden', t !== name);
        if (btn) {
            btn.classList.toggle('tab-active', t === name);
            btn.classList.toggle('hover:text-blue-600', t !== name);
        }
    });
    window.scrollTo(0, 0);
}

function showMatchTab(name) {
    sessionStorage.setItem('lastMatchTab', name);
    ['summary', 'home', 'away'].forEach(t => {
        const panel = document.getElementById('match-panel-' + t);
        const btn = document.getElementById('match-tab-' + t);
        if (panel) panel.classList.toggle('hidden', t !== name);
        if (btn) {
            btn.classList.toggle('bg-blue-600', t === name);
            btn.classList.toggle('text-white', t === name);
            btn.classList.toggle('bg-gray-200', t !== name);
            btn.classList.toggle('text-gray-700', t !== name);
        }
    });
}

function filterTeamTab(section, value) {
    document.querySelectorAll('.team-tab-' + section).forEach(btn => {
        btn.classList.toggle('tab-active', btn.dataset.value === value);
    });
    let visibleIndex = 0;
    document.querySelectorAll('.team-row-' + section).forEach(row => {
        const visible = !value || row.dataset.league === value;
        row.style.display = visible ? '' : 'none';
        if (visible) {
            row.style.backgroundColor = visibleIndex % 2 === 1 ? '#f9fafb' : '';
            visibleIndex++;
        }
    });
}

function navigateToMatch(id, type) {
    window.location.hash = 'match/' + type + '/' + id;
}

function navigateToTeam(clubName) {
    window.location.hash = 'team/' + encodeURIComponent(clubName);
}

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

    const playerDetail = hash.match(/^player\/(.+)$/);
    if (playerDetail) {
        renderPlayerDetail(playerDetail[1]);
        return;
    }

    // Unknown hash — clear detail view
    hideDetailView();
}

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
                displayValue = value.map(v => escHtml(String(v))).join(', ');
            }
        } else if (typeof value === 'object') {
            displayValue = renderApiSection(value, '', []);
        } else {
            displayValue = escHtml(String(value));
        }

        rows += `
            <div class="stripe-row flex py-2 border-b border-gray-100 last:border-0">
                <div class="w-40 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase pt-0.5">${escHtml(snakeToTitle(key))}</div>
                <div class="flex-1 text-sm text-gray-800">${displayValue}</div>
            </div>`;
    });

    if (!rows) return '';

    return `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            ${title ? `<h3 class="text-lg font-bold mb-4">${escHtml(title)}</h3>` : ''}
            <div>${rows}</div>
        </div>`;
}

function renderMatchCentre(data) {
    if (!data || !data.attributes) return '';
    const a = data.attributes;
    let html = '';

    // Venue
    if (a.ground_name) {
        const mapUrl = a.ground_latitude && a.ground_longitude
            ? `https://maps.google.com/?q=${encodeURIComponent(a.ground_latitude + ',' + a.ground_longitude)}`
            : null;
        html += `<div class="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 class="text-lg font-semibold mb-2">Venue</h3>
            ${mapUrl
                ? `<a href="${escAttr(mapUrl)}" target="_blank" rel="noopener" class="text-sm font-medium text-blue-700 hover:underline">${escHtml(a.ground_name)}</a>`
                : `<div class="text-sm font-medium">${escHtml(a.ground_name)}</div>`
            }
            ${a.ground_address ? `<div class="text-xs text-gray-500 mt-1">${escHtml(a.ground_address)}</div>` : ''}
        </div>`;
    }

    // Match info (half-time score, duration, status)
    const infoRows = [];
    if (a.game_progress === 'ft') infoRows.push(['Status', 'Full Time']);
    else if (a.game_progress === 'et') infoRows.push(['Status', 'After Extra Time']);
    else if (a.game_progress === 'pen') infoRows.push(['Status', 'After Penalties']);
    if (a.home_score_half != null && a.away_score_half != null) infoRows.push(['Half-Time Score', `${a.home_score_half}–${a.away_score_half}`]);
    if (a.ft_first_half_duration) infoRows.push(['Half Duration', `${a.ft_first_half_duration} min`]);
    if (a.home_score_penalty != null && a.away_score_penalty != null) infoRows.push(['Penalties', `${a.home_score_penalty}–${a.away_score_penalty}`]);
    if (infoRows.length) {
        html += `<div class="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 class="text-lg font-semibold mb-3">Match Info</h3>
            <div>`;
        infoRows.forEach(([label, value]) => {
            html += `<div class="stripe-row flex py-2 border-b border-gray-100 last:border-0">
                <span class="w-40 text-xs font-semibold text-gray-500 uppercase pt-0.5">${escHtml(label)}</span>
                <span class="text-sm text-gray-800">${escHtml(String(value))}</span>
            </div>`;
        });
        html += `</div></div>`;
    }

    // Match events timeline (goals + cards)
    const matchEvents = (a.match_events || []).filter(ev =>
        ev.type === 'goal' || ev.type === 'yellow_card' || ev.type === 'red_card' || ev.type === 'yellow_red_card'
    ).sort((a, b) => (parseInt(a.minute) || 0) - (parseInt(b.minute) || 0));
    if (matchEvents.length) {
        html += `<div class="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 class="text-lg font-semibold mb-4">Match Events</h3><div>`;
        let prevHome = 0;
        matchEvents.forEach(ev => {
            if (ev.type === 'goal') {
                const isHome = ev.home_score > prevHome;
                const team = escHtml(isHome ? (a.home_team_name || '') : (a.away_team_name || ''));
                const color = escAttr(isHome ? (a.home_club_color || '#2563eb') : (a.away_club_color || '#6b7280'));
                const note = ev.own_goal ? ' (OG)' : ev.penalty_kick ? ' (Pen)' : '';
                html += `<div class="stripe-row flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span class="text-sm font-bold text-gray-400 w-8 text-right flex-shrink-0">${escHtml(String(ev.minute))}'</span>
                    <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}"></div>
                    <span class="flex-1 text-sm min-w-0 truncate">${escHtml(ev.name || '—')}${ev.jersey ? ` <span class="text-gray-400 text-xs">#${ev.jersey}</span>` : ''}${note ? ` <span class="text-gray-500 text-xs">${escHtml(note)}</span>` : ''}</span>
                    <span class="hidden sm:inline text-xs text-gray-500 w-28 text-right flex-shrink-0">${team}</span>
                    <span class="text-sm font-bold tabular-nums w-10 text-right flex-shrink-0">${ev.home_score}–${ev.away_score}</span>
                </div>`;
                prevHome = ev.home_score;
            } else {
                const cardType = ev.type;
                const cardIcon = cardType === 'yellow_card'
                    ? '<span class="inline-block w-3 h-4 bg-yellow-400 rounded-sm align-middle"></span>'
                    : cardType === 'yellow_red_card'
                        ? '<span class="inline-block w-3 h-4 bg-yellow-400 rounded-sm align-middle"></span><span class="inline-block w-3 h-4 bg-red-600 rounded-sm align-middle"></span>'
                        : '<span class="inline-block w-3 h-4 bg-red-600 rounded-sm align-middle"></span>';
                const isHome = ev.team_hash_id === a.home_team_hash_id;
                const team = escHtml(isHome ? (a.home_team_name || '') : (a.away_team_name || ''));
                html += `<div class="stripe-row flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span class="text-sm font-bold text-gray-400 w-8 text-right flex-shrink-0">${escHtml(String(ev.minute))}'</span>
                    <div class="flex gap-0.5 flex-shrink-0">${cardIcon}</div>
                    <span class="flex-1 text-sm min-w-0 truncate">${escHtml(ev.name || '—')}${ev.jersey ? ` <span class="text-gray-400 text-xs">#${ev.jersey}</span>` : ''}</span>
                    <span class="hidden sm:inline text-xs text-gray-500 w-28 text-right flex-shrink-0">${team}</span>
                    <span class="w-10 flex-shrink-0"></span>
                </div>`;
            }
        });
        html += `</div></div>`;
    }

    // Officials
    const refs = a.referees || [];
    if (refs.length) {
        const roleMap = { cr: 'Centre Referee', ar1: 'Assistant Referee 1', ar2: 'Assistant Referee 2', '4th': 'Fourth Official', gl: 'Game Leader' };
        html += `<div class="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 class="text-lg font-semibold mb-4">Officials</h3>
            <div class="space-y-3">`;
        refs.forEach(ref => {
            html += `<div class="flex items-center gap-3">
                <img src="${escAttr(ref.image || '')}" class="w-10 h-10 rounded-full object-cover bg-gray-100" onerror="this.style.display='none'">
                <div>
                    <div class="text-sm font-medium">${escHtml(ref.name || '')}</div>
                    <div class="text-xs text-gray-500">${escHtml(roleMap[ref.role] || ref.role || '')}</div>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }

    return html;
}

function navigateToPlayer(id) {
    // Capture whichever lineup tab is currently visible so Back restores it
    const active = ['home', 'away', 'summary'].find(t => {
        const p = document.getElementById('match-panel-' + t);
        return p && !p.classList.contains('hidden');
    });
    if (active) sessionStorage.setItem('lastMatchTab', active);
    window.location.hash = 'player/' + id;
}

function renderLineup(players, teamName, teamLogo) {
    if (!Array.isArray(players) || !players.length) return '';

    const isStaff = (p) => {
        const r = (p.role_slug || '').toLowerCase();
        return r.includes('coach') || r.includes('manager') || r.includes('staff') ||
               r.includes('physio') || r.includes('trainer') || r.includes('doctor');
    };
    const staffLabel = (slug) => slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const starters = players.filter(p => !isStaff(p) && p.starting).sort((a, b) => (parseInt(a.jersey) || 99) - (parseInt(b.jersey) || 99));
    const bench = players.filter(p => !isStaff(p) && !p.starting && p.available).sort((a, b) => (parseInt(a.jersey) || 99) - (parseInt(b.jersey) || 99));
    const staff = players.filter(isStaff);

    if (!starters.length && !bench.length && !staff.length) return '';

    const renderPlayer = (p) => {
        const pid = p.user_hash_id || '';
        if (pid) playerCache[pid] = { ...p, teamName, teamLogo: teamLogo || '' };
        const name = escHtml(`${p.first_name} ${p.last_name}`);
        const pos = p.is_goalkeeper ? 'GK' : (p.field_role || '');
        const cardHtml = p.has_cards
            ? (p.cards || []).map(c => {
                const ct = (c.final_card_type || c.first_card_type || c.type || c.card_type || '').toLowerCase();
                if (ct.includes('yellow')) return '<span class="inline-block w-3 h-4 bg-yellow-400 rounded-sm align-middle"></span>';
                return '<span class="inline-block w-3 h-4 bg-red-600 rounded-sm align-middle"></span>';
              }).join('')
            : '';
        const goalHtml = p.has_goals && p.goals && p.goals.length
            ? `<span class="text-sm leading-none">${'⚽'.repeat(Math.min(p.goals.length, 3))}${p.goals.length > 3 ? `<span class="text-xs text-gray-500">×${p.goals.length}</span>` : ''}</span>`
            : '';
        const capHtml = p.is_captain ? '<span class="text-xs font-bold text-yellow-600 border border-yellow-400 rounded px-1">C</span>' : '';
        const nameEl = pid
            ? `<span class="flex-1 text-sm font-medium text-blue-700 cursor-pointer hover:underline" data-id="${escAttr(pid)}" onclick="navigateToPlayer(this.dataset.id)">${name}</span>`
            : `<span class="flex-1 text-sm font-medium">${name}</span>`;

        return `<div class="stripe-row flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            <img src="${escAttr(p.image || '')}" class="w-8 h-8 rounded-full object-cover bg-gray-100 flex-shrink-0" onerror="this.style.display='none'">
            <span class="text-xs text-gray-400 w-8 flex-shrink-0 text-right">${p.jersey ? escHtml(String(p.jersey)) : ''}</span>
            ${nameEl}
            ${pos ? `<span class="text-xs text-gray-400">${escHtml(pos)}</span>` : ''}
            <div class="flex items-center gap-1">${capHtml}${goalHtml}${cardHtml}</div>
        </div>`;
    };

    const renderStaff = (p) => {
        const pid = p.user_hash_id || '';
        if (pid) playerCache[pid] = { ...p, teamName, teamLogo: teamLogo || '', isStaffMember: true };
        const name = escHtml(`${p.first_name} ${p.last_name}`);
        const role = p.role_slug ? escHtml(staffLabel(p.role_slug)) : '';
        const nameEl = pid
            ? `<span class="flex-1 text-sm font-medium text-blue-700 cursor-pointer hover:underline" data-id="${escAttr(pid)}" onclick="navigateToPlayer(this.dataset.id)">${name}</span>`
            : `<span class="flex-1 text-sm font-medium">${name}</span>`;
        return `<div class="stripe-row flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            <img src="${escAttr(p.image || '')}" class="w-8 h-8 rounded-full object-cover bg-gray-100 flex-shrink-0" onerror="this.style.display='none'">
            <span class="w-8 flex-shrink-0"></span>
            ${nameEl}
            ${role ? `<span class="text-xs text-gray-400">${role}</span>` : ''}
        </div>`;
    };

    let html = `<div class="bg-white rounded-lg shadow-md p-6 mb-4">
        <h3 class="text-lg font-semibold mb-4">${escHtml(teamName)}</h3>`;

    if (starters.length) {
        html += `<div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Starting XI</div>
            <div class="mb-4">${starters.map(renderPlayer).join('')}</div>`;
    }
    if (bench.length) {
        html += `<div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bench</div>
            <div class="mb-4">${bench.map(renderPlayer).join('')}</div>`;
    }
    if (staff.length) {
        html += `<div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Staff</div>
            <div>${staff.map(renderStaff).join('')}</div>`;
    }

    return html + '</div>';
}

async function renderMatchDetail(id, type) {
    const dataSet = type === 'result' ? resultsData : fixturesData;
    const match = dataSet.find(m => m.hash_id === id);

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
        ? `<div class="flex items-center justify-center gap-2 sm:gap-4 text-2xl sm:text-4xl font-bold my-2 sm:my-4">
               <span class="${attrs.home_score > attrs.away_score ? 'text-green-600' : 'text-gray-700'}">${attrs.home_score}</span>
               <span class="text-gray-400">-</span>
               <span class="${attrs.away_score > attrs.home_score ? 'text-green-600' : 'text-gray-700'}">${attrs.away_score}</span>
           </div>`
        : `<div class="text-center text-lg sm:text-2xl font-bold text-gray-400 my-2 sm:my-4">vs</div>`;

    const headerHtml = `
        <button onclick="history.back()" class="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold">
            ← Back
        </button>
        <div class="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
            <div class="flex items-center justify-between gap-2 sm:gap-4">
                <div class="flex items-center gap-2 sm:gap-3 flex-1 justify-end text-right min-w-0">
                    <div class="min-w-0">
                        <div class="font-bold text-sm sm:text-lg cursor-pointer hover:text-blue-600 leading-tight"
                             onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(getClubName(attrs.home_team_name))}">
                            ${escHtml(attrs.home_team_name)}
                        </div>
                    </div>
                    <img src="${escAttr(attrs.home_logo)}" alt="${escAttr(attrs.home_team_name)}" class="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0" onerror="this.style.display='none'">
                </div>
                <div class="text-center flex-shrink-0">
                    ${scoreHtml}
                </div>
                <div class="flex items-center gap-2 sm:gap-3 flex-1 justify-start min-w-0">
                    <img src="${escAttr(attrs.away_logo)}" alt="${escAttr(attrs.away_team_name)}" class="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0" onerror="this.style.display='none'">
                    <div class="min-w-0">
                        <div class="font-bold text-sm sm:text-lg cursor-pointer hover:text-blue-600 leading-tight"
                             onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(getClubName(attrs.away_team_name))}">
                            ${escHtml(attrs.away_team_name)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="text-center text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4 space-y-1">
                <div>${escHtml(dateStr)} at ${escHtml(timeStr)}</div>
                <div>${escHtml(attrs.league_name)} · ${escHtml(attrs.full_round || attrs.round)}</div>
                <div>${escHtml(attrs.ground_name)}${attrs.field_name ? ' · ' + escHtml(attrs.field_name) : ''}</div>
            </div>
        </div>
        <div class="flex gap-2 mb-4">
            <button onclick="showMatchTab('summary')" id="match-tab-summary" class="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Summary</button>
            <button onclick="showMatchTab('home')" id="match-tab-home" class="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-blue-700 hover:text-white text-sm truncate">${escHtml(getClubName(attrs.home_team_name))}</button>
            <button onclick="showMatchTab('away')" id="match-tab-away" class="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-blue-700 hover:text-white text-sm truncate">${escHtml(getClubName(attrs.away_team_name))}</button>
        </div>
        <div id="match-panel-summary"><div class="text-center py-4 text-gray-400 text-sm">Loading...</div></div>
        <div id="match-panel-home" class="hidden"><div class="text-center py-4 text-gray-400 text-sm">Loading...</div></div>
        <div id="match-panel-away" class="hidden"><div class="text-center py-4 text-gray-400 text-sm">Loading...</div></div>`;

    showDetailView(headerHtml);

    const matchHashId = attrs.match_hash_id;
    const homeTeamHashId = attrs.home_team_hash_id;
    const awayTeamHashId = attrs.away_team_hash_id;

    const safeFetch = url => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);

    const [centreResult, homeResult, awayResult] = await Promise.all([
        matchHashId ? safeFetch(`https://mc-api.dribl.com/api/matchcentre/${matchHashId}?tenant=w8zdBWPmBX`) : null,
        matchHashId && homeTeamHashId ? safeFetch(`https://mc-api.dribl.com/api/matchcentre-match-members/match/${matchHashId}/team/${homeTeamHashId}?tenant=w8zdBWPmBX`) : null,
        matchHashId && awayTeamHashId ? safeFetch(`https://mc-api.dribl.com/api/matchcentre-match-members/match/${matchHashId}/team/${awayTeamHashId}?tenant=w8zdBWPmBX`) : null,
    ]);

    const summaryEl = document.getElementById('match-panel-summary');
    const homeEl = document.getElementById('match-panel-home');
    const awayEl = document.getElementById('match-panel-away');

    if (summaryEl) summaryEl.innerHTML = (centreResult && centreResult.data) ? renderMatchCentre(centreResult.data) : '<div class="text-center py-4 text-gray-400 text-sm">No match centre data available.</div>';
    if (homeEl) homeEl.innerHTML = homeResult ? renderLineup(homeResult, attrs.home_team_name, attrs.home_logo) : '<div class="text-center py-4 text-gray-400 text-sm">No lineup data.</div>';
    if (awayEl) awayEl.innerHTML = awayResult ? renderLineup(awayResult, attrs.away_team_name, attrs.away_logo) : '<div class="text-center py-4 text-gray-400 text-sm">No lineup data.</div>';

    const savedTab = sessionStorage.getItem('lastMatchTab');
    if (savedTab && savedTab !== 'summary') {
        showMatchTab(savedTab);
        sessionStorage.removeItem('lastMatchTab');
    }
}

async function renderTeamDetail(clubName) {
    const logo = clubLogoMap[clubName] || '';
    const divisionName = divisions.boys[currentDivision]
        ? divisions.boys[currentDivision].fullName
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
                    <td class="py-2 pr-4 font-medium text-sm">${escHtml(league.name)}</td>
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



    const html = `
        <button onclick="history.back()" class="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm">
            ← Back
        </button>

        <div class="bg-blue-600 text-white rounded-lg shadow-md p-6 mb-4">
            <div class="flex items-center gap-4">
                ${logo ? `<img src="${escAttr(logo)}" alt="${escAttr(clubName)}" class="w-16 h-16 object-contain bg-white rounded p-1">` : ''}
                <div>
                    <h2 class="text-2xl font-bold">${escHtml(clubName)}</h2>
                    <p class="text-blue-100">${escHtml(divisionName)} · 2026</p>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow-md mb-6">
            <div class="flex overflow-x-auto border-b border-gray-200 px-2">
                <button onclick="showTeamTab('overview')" id="team-tab-overview" class="py-3 px-4 text-sm whitespace-nowrap tab-active">Overview</button>
                <button onclick="showTeamTab('squad')" id="team-tab-squad" class="py-3 px-4 text-sm whitespace-nowrap hover:text-blue-600">Squad</button>
                <button onclick="showTeamTab('results')" id="team-tab-results" class="py-3 px-4 text-sm whitespace-nowrap hover:text-blue-600">Results</button>
                <button onclick="showTeamTab('fixtures')" id="team-tab-fixtures" class="py-3 px-4 text-sm whitespace-nowrap hover:text-blue-600">Fixtures</button>
            </div>
        </div>

        <div id="team-panel-overview">
            ${divisions.boys[currentDivision]?.combined ? `
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
            </div>` : ''}
            <div id="team-breakdown-section">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div class="text-center py-4 text-gray-400 text-sm">Loading...</div>
                </div>
            </div>
        </div>

        <div id="team-panel-squad" class="hidden">
            <div id="team-stats-section">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div class="text-center py-4 text-gray-400 text-sm">Loading...</div>
                </div>
            </div>
            <div id="team-squad-section">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div class="text-center py-4 text-gray-400 text-sm">Loading...</div>
                </div>
            </div>
        </div>

        <div id="team-panel-results" class="hidden">
            <div id="team-results-section">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div class="text-center py-4 text-gray-400 text-sm">Loading...</div>
                </div>
            </div>
        </div>

        <div id="team-panel-fixtures" class="hidden">
            <div id="team-fixtures-section">
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div class="text-center py-4 text-gray-400 text-sm">Loading...</div>
                </div>
            </div>
        </div>
    `;

    showDetailView(html);
    populateTeamBreakdown(clubName);
}

function leagueSortKey(name) {
    const stateMatch = name.match(/State League (\d+)/i);
    if (stateMatch) return [1000 + parseInt(stateMatch[1]), name.includes('Reserves') ? 1 : 0, name];
    const ageMatch = name.match(/U(\d+)/i);
    return [ageMatch ? parseInt(ageMatch[1]) : 999, 0, name];
}

async function renderPlayerDetail(playerId) {
    const cached = playerCache[playerId] || {};
    const fullName = cached.first_name ? `${cached.first_name} ${cached.last_name}` : 'Player';
    const isStaffMember = cached.isStaffMember || false;
    const roleSlug = cached.role_slug || '';
    const pos = isStaffMember
        ? roleSlug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : (cached.is_goalkeeper ? 'GK' : (cached.field_role || ''));

    // Match stats from cache
    const goals = (cached.has_goals && cached.goals) ? cached.goals : [];
    const cards = (cached.has_cards && cached.cards) ? cached.cards : [];

    const goalMinutes = goals.map(g => {
        const min = g.minute || g.time || g.minute_of_play || '';
        const type = (g.type || g.goal_type || '').toLowerCase();
        const label = type.includes('penalty') ? 'pen' : type.includes('own') ? 'og' : '';
        return min ? `${min}'${label ? ' (' + label + ')' : ''}` : label || '⚽';
    }).join(', ');

    const cardItems = cards.map(c => {
        const ct = (c.final_card_type || c.first_card_type || c.type || c.card_type || '').toLowerCase();
        const min = c.minute || c.time || '';
        const colour = ct.includes('yellow') ? 'bg-yellow-400' : 'bg-red-600';
        return `<span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-4 ${colour} rounded-sm"></span>${min ? `<span class="text-xs text-gray-500">${escHtml(String(min))}'</span>` : ''}</span>`;
    }).join(' ');

    const matchStatsHtml = (goals.length || cards.length) ? `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">This Match</div>
            <div class="flex gap-6 text-sm">
                ${goals.length ? `<div><span class="text-gray-500">Goals</span><div class="font-semibold mt-1">${escHtml(goalMinutes)}</div></div>` : ''}
                ${cards.length ? `<div><span class="text-gray-500">Cards</span><div class="mt-1 flex gap-1">${cardItems}</div></div>` : ''}
            </div>
        </div>` : '';

    showDetailView(`
        <div class="max-w-2xl mx-auto">
            <button onclick="history.back()" class="mb-4 text-blue-600 hover:underline text-sm">&larr; Back</button>
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <div class="flex items-center gap-4 mb-4">
                    ${cached.image ? `<img src="${escAttr(cached.image)}" class="w-16 h-16 rounded-full object-cover bg-gray-100">` : '<div class="w-16 h-16 rounded-full bg-gray-100 flex-shrink-0"></div>'}
                    <div>
                        <h2 class="text-2xl font-bold">${escHtml(fullName)}</h2>
                        ${cached.teamName ? `<div class="text-sm mt-1 flex items-center gap-2">
                            ${cached.teamLogo ? `<img src="${escAttr(cached.teamLogo)}" class="w-5 h-5 object-contain">` : ''}
                            <span class="text-blue-600 hover:underline cursor-pointer" data-club="${escAttr(getClubName(cached.teamName))}" onclick="navigateToTeam(this.dataset.club)">${escHtml(cached.teamName)}</span>
                        </div>` : ''}
                    </div>
                </div>
                <div class="flex flex-wrap gap-6 text-sm">
                    ${pos ? `<div><span class="text-gray-500">${isStaffMember ? 'Role' : 'Position'}</span><div class="font-semibold">${escHtml(pos)}</div></div>` : ''}
                    ${!isStaffMember && cached.jersey ? `<div><span class="text-gray-500">Jersey</span><div class="font-semibold">#${escHtml(String(cached.jersey))}</div></div>` : ''}
                    ${cached.is_captain ? `<div class="self-end"><span class="text-xs font-bold text-yellow-600 border border-yellow-400 rounded px-2 py-1">Captain</span></div>` : ''}
                </div>
            </div>
            ${matchStatsHtml}
            <div id="player-stats-section"></div>
        </div>
    `);

    if (!isStaffMember && cached.teamName) {
        populatePlayerSeasonStats(playerId, cached.teamName);
    }
}

async function populatePlayerSeasonStats(playerId, teamName) {
    const el = document.getElementById('player-stats-section');
    if (!el) return;
    el.innerHTML = '<div class="text-center py-2 text-gray-400 text-xs">Loading season stats...</div>';

    // Collect all results for this team across cached divisions, keeping full match context
    const matches = [];
    for (const divData of Object.values(divisionCache)) {
        for (const result of (divData.results || [])) {
            const attrs = result.attributes || {};
            if (attrs.status !== 'complete') continue;
            const isHome = attrs.home_team_name === teamName;
            const isAway = !isHome && attrs.away_team_name === teamName;
            if (!isHome && !isAway) continue;
            if (!attrs.match_hash_id) continue;
            const teamHashId = isHome ? attrs.home_team_hash_id : attrs.away_team_hash_id;
            if (!teamHashId) continue;
            matches.push({ matchHashId: attrs.match_hash_id, teamHashId, resultHashId: result.hash_id, attrs, isHome });
        }
    }

    if (!matches.length) { el.innerHTML = ''; return; }

    const lineups = await Promise.all(matches.map(m =>
        fetch(`https://mc-api.dribl.com/api/matchcentre-match-members/match/${m.matchHashId}/team/${m.teamHashId}?tenant=w8zdBWPmBX`)
            .then(r => r.ok ? r.json() : null).catch(() => null)
    ));

    let totalGoals = 0, totalAppearances = 0;
    const games = [];

    for (let i = 0; i < matches.length; i++) {
        const lineup = lineups[i];
        if (!Array.isArray(lineup)) continue;
        const player = lineup.find(p => p.user_hash_id === playerId);
        if (!player) continue;

        const m = matches[i];
        const attrs = m.attrs;
        totalAppearances++;
        const matchGoals = (player.has_goals && player.goals) ? player.goals.length : 0;
        totalGoals += matchGoals;

        const gf = parseInt(m.isHome ? attrs.home_score : attrs.away_score) || 0;
        const ga = parseInt(m.isHome ? attrs.away_score : attrs.home_score) || 0;
        const outcome = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
        const outcomeColor = outcome === 'W' ? 'bg-green-500 text-white' : outcome === 'L' ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700';
        const opponent = m.isHome ? attrs.away_team_name : attrs.home_team_name;
        const opponentLogo = m.isHome ? (attrs.away_logo || '') : (attrs.home_logo || '');
        const date = new Date(attrs.date);
        const dateStr = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

        const cardHtml = (player.has_cards && player.cards)
            ? player.cards.map(c => {
                const ct = (c.final_card_type || c.first_card_type || c.type || c.card_type || '').toLowerCase();
                return ct.includes('red') && !ct.includes('yellow')
                    ? '<span class="inline-block w-2.5 h-3.5 bg-red-600 rounded-sm"></span>'
                    : '<span class="inline-block w-2.5 h-3.5 bg-yellow-400 rounded-sm"></span>';
              }).join('')
            : '';
        const goalHtml = matchGoals ? `<span class="text-sm">${'⚽'.repeat(Math.min(matchGoals, 3))}${matchGoals > 3 ? `<span class="text-xs text-gray-500">×${matchGoals}</span>` : ''}</span>` : '';

        games.push({ date, dateStr, outcome, outcomeColor, opponent, opponentLogo, gf, ga, goalHtml, cardHtml, resultHashId: m.resultHashId });
    }

    games.sort((a, b) => b.date - a.date);

    if (!el.isConnected) return;

    const gamesHtml = games.map(g => `
        <div class="stripe-row flex items-center gap-2 sm:gap-3 py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50"
             data-id="${escAttr(g.resultHashId)}" onclick="navigateToMatch(this.dataset.id, 'result')">
            <span class="text-xs text-gray-400 w-14 flex-shrink-0">${escHtml(g.dateStr)}</span>
            <span class="text-xs font-semibold px-1.5 py-0.5 rounded ${g.outcomeColor} flex-shrink-0 w-6 text-center">${g.outcome}</span>
            <img src="${escAttr(g.opponentLogo)}" class="w-5 h-5 object-contain flex-shrink-0" onerror="this.style.display='none'">
            <span class="flex-1 text-sm min-w-0 truncate">${escHtml(g.opponent)}</span>
            <span class="text-xs font-semibold text-gray-600 flex-shrink-0">${g.gf}–${g.ga}</span>
            <div class="flex items-center gap-1 w-12 justify-end flex-shrink-0">${g.goalHtml}${g.cardHtml}</div>
        </div>`).join('');

    el.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Season Stats</div>
            <div class="flex gap-8 mb-6">
                <div class="text-center">
                    <div class="text-2xl font-bold">${totalAppearances}</div>
                    <div class="text-gray-500 text-xs mt-1">Appearances</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold">${totalGoals}</div>
                    <div class="text-gray-500 text-xs mt-1">Goals</div>
                </div>
            </div>
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Games</div>
            <div>${gamesHtml}</div>
        </div>`;
}

async function populateTeamBreakdown(clubName) {
    const el = document.getElementById('team-breakdown-section');
    if (!el) return;

    await Promise.all(Object.keys(divisions.boys).map(id => loadDivisionData(id)));

    const rows = [];
    for (const divId of Object.keys(divisions.boys)) {
        const cached = divisionCache[divId];
        if (!cached || !cached.leagues.length) continue;
        const divName = divisions.boys[divId].fullName;
        cached.leagues.forEach(league => {
            const ladder = calculateLadder(league.name, cached.results);
            const team = ladder.find(t => getClubName(t.name) === clubName);
            if (!team) return;
            const pos = ladder.indexOf(team) + 1;
            rows.push(`
                <tr class="border-b border-gray-100 last:border-0">
                    <td class="py-2 pr-4 text-sm">
                        <div class="font-medium">${escHtml(league.name)}</div>
                        <div class="text-xs text-gray-400">${escHtml(divName)}</div>
                    </td>
                    <td class="py-2 px-4 text-center text-sm font-bold text-blue-600">${pos}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.played}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.won}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.drawn}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.lost}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.goalsFor}</td>
                    <td class="py-2 px-4 text-center text-sm">${team.goalsAgainst}</td>
                    <td class="py-2 px-4 text-center text-sm font-semibold ${team.goalDifference >= 0 ? 'text-green-600' : 'text-red-600'}">${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
                    <td class="py-2 px-4 text-center text-sm font-bold text-blue-600">${team.points}</td>
                </tr>`);
        });
    }

    if (rows.length) {
        el.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 class="text-lg font-bold mb-4">Division Breakdown</h3>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="py-2 pr-4 text-left text-xs font-semibold text-gray-500 uppercase">League</th>
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
                        <tbody>${rows.join('')}</tbody>
                    </table>
                </div>
            </div>`;
    } else {
        el.innerHTML = '';
    }

    // Collect all results across divisions
    const allResults = Object.values(divisionCache).flatMap(d => d.results || []);
    const clubResults = allResults
        .filter(r => {
            const attrs = r.attributes;
            return attrs.status === 'complete' &&
                (getClubName(attrs.home_team_name) === clubName || getClubName(attrs.away_team_name) === clubName);
        })
        .sort((a, b) => new Date(b.attributes.date) - new Date(a.attributes.date));

    const resultLeagues = [...new Set(clubResults.map(r => r.attributes.league_name))].sort((a, b) => { const ka = leagueSortKey(a), kb = leagueSortKey(b); return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]); });
    const resultTabsHtml = resultLeagues.length > 1
        ? `<div class="mb-4">
            <select class="border rounded px-3 py-2 text-sm w-full md:w-auto" onchange="filterTeamTab('results', this.value)">
                ${resultLeagues.map((lg, i) => `<option value="${escAttr(lg)}">${escHtml(lg)}</option>`).join('')}
            </select>
           </div>`
        : '';
    const recentResultsHtml = clubResults.map(r => {
        const attrs = r.attributes;
        const isHome = getClubName(attrs.home_team_name) === clubName;
        const opponent = isHome ? attrs.away_team_name : attrs.home_team_name;
        const opponentLogo = isHome ? attrs.away_logo : attrs.home_logo;
        const clubScore = isHome ? attrs.home_score : attrs.away_score;
        const oppScore = isHome ? attrs.away_score : attrs.home_score;
        const outcome = clubScore > oppScore ? 'W' : clubScore < oppScore ? 'L' : 'D';
        const outcomeColor = outcome === 'W' ? 'bg-green-100 text-green-700' : outcome === 'L' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
        const dateStr = new Date(attrs.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        return `
            <div class="team-row-results flex items-center gap-2 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50"
                 data-league="${escAttr(attrs.league_name)}"
                 data-id="${escAttr(r.hash_id)}"
                 onclick="navigateToMatch(this.dataset.id, 'result')">
                <span class="text-xs text-gray-400 w-14 flex-shrink-0">${escHtml(dateStr)}</span>
                <span class="text-xs font-semibold px-1.5 py-0.5 rounded ${outcomeColor} flex-shrink-0 text-center w-6">${outcome}</span>
                <img src="${escAttr(opponentLogo)}" class="w-6 h-6 object-contain flex-shrink-0" onerror="this.style.display='none'">
                <span class="flex-1 text-sm min-w-0 truncate">${isHome ? 'vs' : '@'} ${escHtml(opponent)}</span>
                <span class="text-sm font-bold flex-shrink-0">${clubScore}–${oppScore}</span>
                <span class="hidden sm:inline text-xs text-gray-400 flex-shrink-0">${escHtml(attrs.league_name)}</span>
            </div>`;
    }).join('');

    const resultsEl = document.getElementById('team-results-section');
    if (resultsEl) {
        resultsEl.innerHTML = recentResultsHtml
            ? `<div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 class="text-lg font-bold mb-4">Recent Results</h3>
                ${resultTabsHtml}${recentResultsHtml}
               </div>`
            : '';
        if (resultLeagues.length > 1) filterTeamTab('results', resultLeagues[0]);
    }

    // Collect all fixtures across divisions
    const allFixtures = Object.values(divisionCache).flatMap(d => d.fixtures || []);
    const clubFixtures = allFixtures
        .filter(f => {
            const attrs = f.attributes;
            return attrs.status === 'pending' &&
                (getClubName(attrs.home_team_name) === clubName || getClubName(attrs.away_team_name) === clubName);
        })
        .sort((a, b) => new Date(a.attributes.date) - new Date(b.attributes.date));

    const fixtureLeagues = [...new Set(clubFixtures.map(f => f.attributes.league_name))].sort((a, b) => { const ka = leagueSortKey(a), kb = leagueSortKey(b); return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]); });
    const fixtureTabsHtml = fixtureLeagues.length > 1
        ? `<div class="mb-4">
            <select class="border rounded px-3 py-2 text-sm w-full md:w-auto" onchange="filterTeamTab('fixtures', this.value)">
                ${fixtureLeagues.map((lg, i) => `<option value="${escAttr(lg)}">${escHtml(lg)}</option>`).join('')}
            </select>
           </div>`
        : '';
    const fixturesHtml = clubFixtures.map(f => {
        const attrs = f.attributes;
        const isHome = getClubName(attrs.home_team_name) === clubName;
        const opponent = isHome ? attrs.away_team_name : attrs.home_team_name;
        const opponentLogo = isHome ? attrs.away_logo : attrs.home_logo;
        const date = new Date(attrs.date);
        const dateStr = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="team-row-fixtures flex items-center gap-2 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50"
                 data-league="${escAttr(attrs.league_name)}"
                 data-id="${escAttr(f.hash_id)}"
                 onclick="navigateToMatch(this.dataset.id, 'fixture')">
                <span class="text-xs text-gray-400 w-20 sm:w-28 flex-shrink-0">${escHtml(dateStr)}<br>${escHtml(timeStr)}</span>
                <img src="${escAttr(opponentLogo)}" class="w-6 h-6 object-contain flex-shrink-0" onerror="this.style.display='none'">
                <span class="flex-1 text-sm min-w-0 truncate">${isHome ? 'vs' : '@'} ${escHtml(opponent)}</span>
                <span class="hidden sm:inline text-xs text-gray-400 flex-shrink-0">${escHtml(attrs.league_name)}</span>
                <span class="text-xs text-gray-400 flex-shrink-0">${escHtml(attrs.full_round || attrs.round)}</span>
            </div>`;
    }).join('');

    const fixturesEl = document.getElementById('team-fixtures-section');
    if (fixturesEl) {
        fixturesEl.innerHTML = fixturesHtml
            ? `<div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 class="text-lg font-bold mb-4">Upcoming Fixtures</h3>
                ${fixtureTabsHtml}${fixturesHtml}
               </div>`
            : '';
        if (fixtureLeagues.length > 1) filterTeamTab('fixtures', fixtureLeagues[0]);
    }

    populateSquadAndStats(clubName);
}

async function populateSquadAndStats(clubName) {
    const isStaffRole = (p) => {
        const r = (p.role_slug || '').toLowerCase();
        return r.includes('coach') || r.includes('manager') || r.includes('staff') ||
               r.includes('physio') || r.includes('trainer') || r.includes('doctor');
    };

    // Collect all results for each team of this club
    const teamMatches = {}; // fullTeamName → [{ matchHashId, teamHashId, isHome, attrs }]
    for (const divData of Object.values(divisionCache)) {
        for (const result of (divData.results || [])) {
            const attrs = result.attributes || {};
            const isHome = getClubName(attrs.home_team_name) === clubName;
            const isAway = !isHome && getClubName(attrs.away_team_name) === clubName;
            if (!isHome && !isAway) continue;
            if (!attrs.match_hash_id) continue;
            const teamName = isHome ? attrs.home_team_name : attrs.away_team_name;
            const teamHashId = isHome ? attrs.home_team_hash_id : attrs.away_team_hash_id;
            if (!teamHashId) continue;
            if (!teamMatches[teamName]) teamMatches[teamName] = [];
            teamMatches[teamName].push({ matchHashId: attrs.match_hash_id, teamHashId, isHome, attrs });
        }
    }

    const teamNames = Object.keys(teamMatches);
    if (!teamNames.length) {
        ['team-stats-section', 'team-squad-section'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
        return;
    }

    // Fetch all lineups per team in parallel
    const teamLineups = {};
    await Promise.all(teamNames.map(async (teamName) => {
        const lineups = await Promise.all(teamMatches[teamName].map(m =>
            fetch(`https://mc-api.dribl.com/api/matchcentre-match-members/match/${m.matchHashId}/team/${m.teamHashId}?tenant=w8zdBWPmBX`)
                .then(r => r.ok ? r.json() : null).catch(() => null)
        ));
        teamLineups[teamName] = lineups.filter(Boolean);
    }));

    // Aggregate per team
    const teamData = {};
    for (const teamName of teamNames) {
        const lineups = teamLineups[teamName] || [];
        const players = {};
        let yellows = 0, reds = 0;

        for (const lineup of lineups) {
            if (!Array.isArray(lineup)) continue;
            for (const p of lineup) {
                if (!p.user_hash_id || isStaffRole(p)) continue;
                const pid = p.user_hash_id;
                if (!players[pid]) players[pid] = { pid, name: `${p.first_name} ${p.last_name}`, image: p.image || '', jersey: '', goals: 0, yellows: 0, reds: 0, appearances: 0 };
                if (!players[pid].jersey && p.jersey) players[pid].jersey = String(p.jersey);
                if (!playerCache[pid]) playerCache[pid] = { ...p, teamName, teamLogo: clubLogoMap[clubName] || '' };
                players[pid].appearances++;
                if (p.has_goals && p.goals) players[pid].goals += p.goals.length;
                if (p.has_cards && p.cards) {
                    for (const c of p.cards) {
                        const ct = (c.final_card_type || c.first_card_type || c.type || c.card_type || '').toLowerCase();
                        if (ct.includes('red') && !ct.includes('yellow')) { players[pid].reds++; reds++; }
                        else { players[pid].yellows++; yellows++; }
                    }
                }
            }
        }

        // Goals/conceded/clean sheets from results
        let goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
        for (const m of teamMatches[teamName]) {
            const gf = parseInt(m.isHome ? m.attrs.home_score : m.attrs.away_score) || 0;
            const ga = parseInt(m.isHome ? m.attrs.away_score : m.attrs.home_score) || 0;
            goalsFor += gf; goalsAgainst += ga;
            if (ga === 0) cleanSheets++;
        }

        teamData[teamName] = {
            players: Object.values(players).sort((a, b) => b.appearances - a.appearances),
            goalsFor, goalsAgainst, cleanSheets, yellows, reds,
            gamesPlayed: teamMatches[teamName].length
        };
    }

    const isSingle = teamNames.length === 1;
    const sortedTeams = teamNames.sort((a, b) => {
        const ka = leagueSortKey(a), kb = leagueSortKey(b);
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]);
    });

    const renderTeamPanel = (teamName, d) => {
        const topScorers = [...d.players].sort((a, b) => b.goals - a.goals).filter(p => p.goals > 0).slice(0, 10);
        const scorersHtml = topScorers.length ? `
            <div class="mb-6">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Scorers</div>
                ${topScorers.map((p, i) => `
                    <div class="stripe-row flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        <span class="text-xs text-gray-400 w-5 text-right flex-shrink-0">${i + 1}</span>
                        ${p.image ? `<img src="${escAttr(p.image)}" class="w-7 h-7 rounded-full object-cover bg-gray-100 flex-shrink-0" onerror="this.style.display='none'">` : '<div class="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0"></div>'}
                        <span class="flex-1 text-sm font-medium cursor-pointer text-blue-700 hover:underline" data-id="${escAttr(p.pid)}" onclick="navigateToPlayer(this.dataset.id)">${escHtml(p.name)}</span>
                        <span class="text-sm">${'⚽'.repeat(Math.min(p.goals, 5))}${p.goals > 5 ? `<span class="text-xs text-gray-500"> ×${p.goals}</span>` : ''}</span>
                    </div>`).join('')}
            </div>` : '';

        const squadRows = d.players.map(p => `
            <tr class="stripe-row border-b border-gray-100 last:border-0">
                <td class="py-3 pr-2 w-8">
                    ${p.image ? `<img src="${escAttr(p.image)}" class="w-8 h-8 rounded-full object-cover bg-gray-100" onerror="this.style.display='none'">` : '<div class="w-8 h-8 rounded-full bg-gray-100"></div>'}
                </td>
                <td class="py-3 pr-4 text-xs text-gray-400 w-10 text-right">${p.jersey ? escHtml(p.jersey) : ''}</td>
                <td class="py-3 text-sm font-medium cursor-pointer text-blue-700 hover:underline" data-id="${escAttr(p.pid)}" onclick="navigateToPlayer(this.dataset.id)">${escHtml(p.name)}</td>
                <td class="py-3 text-center text-sm text-gray-700 w-16 font-semibold">${p.appearances}</td>
                <td class="py-3 text-center w-24">${p.goals ? `<span class="text-sm">${'⚽'.repeat(Math.min(p.goals, 3))}${p.goals > 3 ? `<span class="text-xs text-gray-500"> ×${p.goals}</span>` : ''}</span>` : '<span class="text-gray-300 text-xs">—</span>'}</td>
                <td class="py-3 text-center w-24">
                    <div class="flex items-center justify-center gap-1">
                    ${p.yellows ? `<span class="inline-flex items-center gap-0.5"><span class="inline-block w-3 h-4 bg-yellow-400 rounded-sm"></span><span class="text-xs text-gray-500">${p.yellows > 1 ? p.yellows : ''}</span></span>` : ''}
                    ${p.reds ? `<span class="inline-flex items-center gap-0.5"><span class="inline-block w-3 h-4 bg-red-600 rounded-sm"></span><span class="text-xs text-gray-500">${p.reds > 1 ? p.reds : ''}</span></span>` : ''}
                    ${!p.yellows && !p.reds ? '<span class="text-gray-300 text-xs">—</span>' : ''}
                    </div>
                </td>
            </tr>`).join('');

        return `
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 class="text-base font-semibold text-gray-700 mb-4">Team Stats</h3>
                <div class="flex flex-wrap gap-6 text-center mb-6">
                    <div><div class="text-2xl font-bold">${d.gamesPlayed}</div><div class="text-xs text-gray-500 mt-1">Played</div></div>
                    <div><div class="text-2xl font-bold text-green-600">${d.goalsFor}</div><div class="text-xs text-gray-500 mt-1">Goals For</div></div>
                    <div><div class="text-2xl font-bold text-red-500">${d.goalsAgainst}</div><div class="text-xs text-gray-500 mt-1">Goals Against</div></div>
                    <div><div class="text-2xl font-bold">${d.cleanSheets}</div><div class="text-xs text-gray-500 mt-1">Clean Sheets</div></div>
                    <div><div class="text-2xl font-bold flex justify-center gap-1 items-center"><span class="inline-block w-4 h-5 bg-yellow-400 rounded-sm"></span>${d.yellows}</div><div class="text-xs text-gray-500 mt-1">Yellow Cards</div></div>
                    <div><div class="text-2xl font-bold flex justify-center gap-1 items-center"><span class="inline-block w-4 h-5 bg-red-600 rounded-sm"></span>${d.reds}</div><div class="text-xs text-gray-500 mt-1">Red Cards</div></div>
                </div>
                ${scorersHtml}
                ${d.players.length ? `
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Squad</div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead><tr class="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                            <th class="pb-3 w-8"></th>
                            <th class="pb-3 w-10 text-right pr-4">#</th>
                            <th class="pb-3 text-left">Player</th>
                            <th class="pb-3 text-center w-16">Apps</th>
                            <th class="pb-3 text-center w-24">Goals</th>
                            <th class="pb-3 text-center w-24">Cards</th>
                        </tr></thead>
                        <tbody>${squadRows}</tbody>
                    </table>
                </div>` : ''}
            </div>`;
    };

    const statsEl = document.getElementById('team-stats-section');
    const squadEl = document.getElementById('team-squad-section');
    if (squadEl) squadEl.innerHTML = '';

    if (statsEl) {
        if (isSingle) {
            const d = teamData[sortedTeams[0]];
            statsEl.innerHTML = d ? renderTeamPanel(sortedTeams[0], d) : '';
        } else {
            const tabLabel = name => name.match(/U\d+|Seniors|Reserves/i)?.[0] || name;
            const tabBtns = sortedTeams.map((name, i) =>
                `<button id="squad-stab-btn-${i}" onclick="showSquadSubTab(${i})"
                    class="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${i === 0 ? 'tab-active border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}"
                >${escHtml(tabLabel(name))}</button>`
            ).join('');
            const panels = sortedTeams.map((name, i) => {
                const d = teamData[name];
                return `<div id="squad-stab-panel-${i}" ${i > 0 ? 'class="hidden"' : ''}>${d ? renderTeamPanel(name, d) : ''}</div>`;
            }).join('');
            statsEl.innerHTML = `
                <div class="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                    <div class="flex overflow-x-auto border-b border-gray-200 px-2">${tabBtns}</div>
                </div>
                ${panels}`;
        }
    }
}

function showSquadSubTab(idx) {
    document.querySelectorAll('[id^="squad-stab-panel-"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="squad-stab-btn-"]').forEach(btn => {
        btn.classList.remove('tab-active', 'border-blue-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    const panel = document.getElementById('squad-stab-panel-' + idx);
    const btn = document.getElementById('squad-stab-btn-' + idx);
    if (panel) panel.classList.remove('hidden');
    if (btn) {
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('tab-active', 'border-blue-600', 'text-blue-600');
    }
}

// Populate combined ladder age group toggle buttons
function saveChipSelection() {
    const key = `vpl_chips_${currentGender}_${currentDivision}`;
    localStorage.setItem(key, JSON.stringify([...selectedCombinedAgeGroups]));
}

function populateCombinedLadderFilters() {
    const key = `vpl_chips_${currentGender}_${currentDivision}`;
    const saved = localStorage.getItem(key);
    selectedCombinedAgeGroups = saved ? new Set(JSON.parse(saved)) : new Set();
    const container = document.getElementById('combined-age-group-filters');
    let html = `
        <button onclick="selectAllCombinedAgeGroups(this)" id="combined-age-all-btn"
            class="px-4 py-2 rounded" style="background-color:#2563eb;color:#ffffff;">
            All
        </button>
    `;
    leaguesData.forEach(league => {
        html += `
            <button onclick="toggleCombinedAgeGroup('${league.id}', this)" id="combined-age-btn-${league.id}"
                class="px-4 py-2 rounded combined-age-btn" style="background-color:#2563eb;color:#ffffff;" data-league="${league.id}">
                ${league.name}
            </button>
        `;
    });
    container.innerHTML = html;
    updateCombinedAgeGroupButtons();
}

// Toggle a single age group on the combined ladder
function toggleCombinedAgeGroup(leagueId, el) {
    if (selectedCombinedAgeGroups.size === 0) {
        // All selected — isolate just the clicked one
        selectedCombinedAgeGroups.add(leagueId);
    } else if (selectedCombinedAgeGroups.has(leagueId)) {
        // Already in selection — remove it, unless it's the last one
        if (selectedCombinedAgeGroups.size === 1) return;
        selectedCombinedAgeGroups.delete(leagueId);
    } else {
        // Add to existing selection
        selectedCombinedAgeGroups.add(leagueId);
        // If all age groups are now selected, reset to "All" state
        if (selectedCombinedAgeGroups.size === leaguesData.length) {
            selectedCombinedAgeGroups = new Set();
        }
    }
    saveChipSelection();
    updateCombinedAgeGroupButtons();
    renderCombinedLadder();
    el.blur();
}

// Reset combined ladder to show all age groups
function selectAllCombinedAgeGroups(el) {
    selectedCombinedAgeGroups = new Set();
    saveChipSelection();
    updateCombinedAgeGroupButtons();
    renderCombinedLadder();
    if (el) el.blur();
}

// Sync button styles and summary line to current selection state
function updateCombinedAgeGroupButtons() {
    const allSelected = selectedCombinedAgeGroups.size === 0;

    const allBtn = document.getElementById('combined-age-all-btn');
    if (allBtn) {
        allBtn.style.backgroundColor = allSelected ? '#2563eb' : '#e5e7eb';
        allBtn.style.color = allSelected ? '#ffffff' : '#374151';
    }
    document.querySelectorAll('.combined-age-btn').forEach(btn => {
        const active = allSelected || selectedCombinedAgeGroups.has(btn.dataset.league);
        btn.style.backgroundColor = active ? '#2563eb' : '#e5e7eb';
        btn.style.color = active ? '#ffffff' : '#374151';
    });

    // Update summary line above the table
    const summaryEl = document.getElementById('combined-ladder-summary');
    const summaryTextEl = document.getElementById('combined-ladder-summary-text');
    if (summaryEl && summaryTextEl) {
        if (allSelected) {
            summaryEl.classList.add('hidden');
        } else {
            const activeNames = leaguesData
                .filter(l => selectedCombinedAgeGroups.has(l.id))
                .map(l => l.name)
                .join(', ');
            summaryTextEl.textContent = `Showing: ${activeNames}`;
            summaryEl.classList.remove('hidden');
        }
    }
}

function buildLookupMaps() {
    teamIdMap = {};
    clubLogoMap = {};

    const processEntry = (attrs) => {
        if (attrs.home_team_hash_id && attrs.home_team_name) {
            teamIdMap[attrs.home_team_name] = attrs.home_team_hash_id;
            const club = getClubName(attrs.home_team_name);
            if (attrs.home_logo) clubLogoMap[club] = attrs.home_logo;
        }
        if (attrs.away_team_hash_id && attrs.away_team_name) {
            teamIdMap[attrs.away_team_name] = attrs.away_team_hash_id;
            const club = getClubName(attrs.away_team_name);
            if (attrs.away_logo) clubLogoMap[club] = attrs.away_logo;
        }
    };

    fixturesData.forEach(f => processEntry(f.attributes));
    resultsData.forEach(r => processEntry(r.attributes));
}

// Filter fixtures by age group
function setActiveLeague(leagueId) {
    selectedFixtureLeague = leagueId;
    selectedResultLeague = leagueId;
    selectedLadderLeague = leagueId;
    selectedStatsLeague = leagueId;
    localStorage.setItem(`vpl_league_${currentGender}_${currentDivision}`, leagueId);
    document.querySelectorAll('.age-group-ladder').forEach(el => {
        el.style.display = el.dataset.league === leagueId ? 'block' : 'none';
    });
    document.querySelectorAll('.league-simple-select').forEach(el => { el.value = leagueId; });
    renderFixtures();
    renderResults();
    resetLeagueStats();
}


function resetLeagueStats() {
    const el = document.getElementById('stats-content');
    if (!el) return;
    const league = leaguesData.find(l => l.id === selectedStatsLeague);
    el.innerHTML = `
        <div class="text-center py-12">
            <p class="text-gray-500 mb-1 text-sm">${league ? escHtml(league.name) : ''}</p>
            <p class="text-gray-400 mb-4 text-sm">Stats require fetching all match lineups — click to load.</p>
            <button onclick="loadLeagueStats()" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">Load Stats</button>
        </div>`;
}

async function loadLeagueStats() {
    const leagueId = selectedStatsLeague;
    if (!leagueId) return;

    if (leagueStatsCache[leagueId]) {
        renderLeagueStatsResult(leagueStatsCache[leagueId]);
        return;
    }

    const el = document.getElementById('stats-content');
    if (!el) return;

    const league = leaguesData.find(l => l.id === leagueId);
    const leagueName = league?.name;
    const matches = resultsData.filter(r => r.attributes.league_name === leagueName && r.attributes.match_hash_id);

    if (!matches.length) {
        el.innerHTML = '<div class="text-center py-12 text-gray-400">No completed matches found for this league.</div>';
        return;
    }

    el.innerHTML = `<div class="text-center py-12 text-gray-500">Loading stats for ${escHtml(leagueName || '')} (${matches.length} matches)…</div>`;

    const fetches = [];
    for (const match of matches) {
        const a = match.attributes;
        if (a.home_team_hash_id) fetches.push({ matchHashId: a.match_hash_id, teamHashId: a.home_team_hash_id, teamName: a.home_team_name, logo: a.home_logo });
        if (a.away_team_hash_id) fetches.push({ matchHashId: a.match_hash_id, teamHashId: a.away_team_hash_id, teamName: a.away_team_name, logo: a.away_logo });
    }

    const lineups = await Promise.all(fetches.map(f =>
        fetch(`https://mc-api.dribl.com/api/matchcentre-match-members/match/${f.matchHashId}/team/${f.teamHashId}?tenant=w8zdBWPmBX`)
            .then(r => r.ok ? r.json() : null).catch(() => null)
            .then(lineup => ({ ...f, lineup }))
    ));

    const isStaff = p => { const r = (p.role_slug || '').toLowerCase(); return r.includes('coach') || r.includes('manager') || r.includes('staff') || r.includes('physio') || r.includes('trainer') || r.includes('doctor'); };
    const players = {};

    for (const { lineup, teamName, logo } of lineups) {
        if (!Array.isArray(lineup)) continue;
        for (const p of lineup) {
            if (!p.user_hash_id || isStaff(p)) continue;
            const pid = p.user_hash_id;
            if (!players[pid]) {
                players[pid] = { pid, name: `${p.first_name} ${p.last_name}`, image: p.image || '', teamName, teamLogo: logo || '', goals: 0, yellows: 0, reds: 0, appearances: 0 };
                if (!playerCache[pid]) playerCache[pid] = { ...p, teamName, teamLogo: logo || '' };
            }
            players[pid].appearances++;
            if (p.has_goals && p.goals) players[pid].goals += p.goals.length;
            if (p.has_cards && p.cards) {
                for (const c of p.cards) {
                    const ct = (c.final_card_type || c.first_card_type || c.type || c.card_type || '').toLowerCase();
                    if (ct.includes('red') && !ct.includes('yellow')) players[pid].reds++;
                    else players[pid].yellows++;
                }
            }
        }
    }

    const data = Object.values(players);
    leagueStatsCache[leagueId] = data;
    renderLeagueStatsResult(data);
}

function renderLeagueStatsResult(players) {
    const el = document.getElementById('stats-content');
    if (!el) return;

    const playerRow = (p, display) => `
        <div class="stripe-row flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            ${p.image ? `<img src="${escAttr(p.image)}" class="w-8 h-8 rounded-full object-cover bg-gray-100 flex-shrink-0" onerror="this.style.display='none'">` : '<div class="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0"></div>'}
            <div class="flex-1 min-w-0">
                <span class="text-sm font-medium cursor-pointer text-blue-700 hover:underline" data-id="${escAttr(p.pid)}" onclick="navigateToPlayer(this.dataset.id)">${escHtml(p.name)}</span>
                <div class="text-xs text-gray-400 truncate">${escHtml(p.teamName)}</div>
            </div>
            <div class="text-right flex-shrink-0">${display}</div>
        </div>`;

    const topScorers = [...players].filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 20);
    const topApps = [...players].sort((a, b) => b.appearances - a.appearances).slice(0, 20);
    const topCards = [...players].filter(p => p.yellows + p.reds > 0).sort((a, b) => (b.yellows + b.reds * 2) - (a.yellows + a.reds * 2)).slice(0, 20);

    const panels = [
        { key: 'scorers', label: 'Top Scorers', rows: topScorers.map(p => playerRow(p,
            `<div class="flex items-center gap-1">${'⚽'.repeat(Math.min(p.goals, 5))}${p.goals > 5 ? `<span class="text-xs text-gray-500 ml-1">×${p.goals}</span>` : ''}</div>`
        )).join('') },
        { key: 'appearances', label: 'Appearances', rows: topApps.map(p => playerRow(p,
            `<span class="text-sm font-bold text-blue-700">${p.appearances}</span>`
        )).join('') },
        { key: 'cards', label: 'Cards', rows: topCards.map(p => playerRow(p,
            `<div class="flex items-center gap-2">
                ${p.yellows ? `<span class="flex items-center gap-1"><span class="inline-block w-3.5 h-5 bg-yellow-400 rounded-sm"></span><span class="text-sm font-medium">${p.yellows}</span></span>` : ''}
                ${p.reds ? `<span class="flex items-center gap-1"><span class="inline-block w-3.5 h-5 bg-red-600 rounded-sm"></span><span class="text-sm font-medium">${p.reds}</span></span>` : ''}
            </div>`
        )).join('') },
    ];

    const tabBtns = panels.map((t, i) =>
        `<button id="stats-stab-btn-${t.key}" onclick="showStatsSubTab('${t.key}')"
            class="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${i === 0 ? 'tab-active border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}"
        >${t.label}</button>`
    ).join('');

    const tabPanels = panels.map((t, i) =>
        `<div id="stats-stab-panel-${t.key}" ${i > 0 ? 'class="hidden"' : ''}>
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                ${t.rows || '<div class="text-gray-400 text-sm text-center py-4">No data</div>'}
            </div>
        </div>`
    ).join('');

    el.innerHTML = `
        <div class="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div class="flex overflow-x-auto border-b border-gray-200 px-2">${tabBtns}</div>
        </div>
        ${tabPanels}`;
}

function showStatsSubTab(key) {
    document.querySelectorAll('[id^="stats-stab-panel-"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="stats-stab-btn-"]').forEach(btn => {
        btn.classList.remove('tab-active', 'border-blue-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    const panel = document.getElementById('stats-stab-panel-' + key);
    const btn = document.getElementById('stats-stab-btn-' + key);
    if (panel) panel.classList.remove('hidden');
    if (btn) { btn.classList.remove('border-transparent', 'text-gray-500'); btn.classList.add('tab-active', 'border-blue-600', 'text-blue-600'); }
}

// Calculate ladder for a specific age group
function calculateLadder(leagueName, results) {
    const data = results || resultsData;
    const teams = {};

    // Process results for this league
    data
        .filter(result => result.attributes.league_name === leagueName)
        .forEach(result => {
            const attrs = result.attributes;
            const homeTeam = attrs.home_team_name;
            const awayTeam = attrs.away_team_name;
            const homeScore = attrs.home_score || 0;
            const awayScore = attrs.away_score || 0;
            
            // Initialize teams if not exists
            if (!teams[homeTeam]) {
                teams[homeTeam] = {
                    name: homeTeam,
                    logo: attrs.home_logo,
                    played: 0,
                    won: 0,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    goalDifference: 0,
                    points: 0
                };
            }
            if (!teams[awayTeam]) {
                teams[awayTeam] = {
                    name: awayTeam,
                    logo: attrs.away_logo,
                    played: 0,
                    won: 0,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    goalDifference: 0,
                    points: 0
                };
            }
            
            // Update stats
            teams[homeTeam].played++;
            teams[awayTeam].played++;
            teams[homeTeam].goalsFor += homeScore;
            teams[homeTeam].goalsAgainst += awayScore;
            teams[awayTeam].goalsFor += awayScore;
            teams[awayTeam].goalsAgainst += homeScore;
            
            if (homeScore > awayScore) {
                teams[homeTeam].won++;
                teams[homeTeam].points += 3;
                teams[awayTeam].lost++;
            } else if (awayScore > homeScore) {
                teams[awayTeam].won++;
                teams[awayTeam].points += 3;
                teams[homeTeam].lost++;
            } else {
                teams[homeTeam].drawn++;
                teams[awayTeam].drawn++;
                teams[homeTeam].points += 1;
                teams[awayTeam].points += 1;
            }
            
            teams[homeTeam].goalDifference = teams[homeTeam].goalsFor - teams[homeTeam].goalsAgainst;
            teams[awayTeam].goalDifference = teams[awayTeam].goalsFor - teams[awayTeam].goalsAgainst;
        });
    
    // Convert to array and sort
    return Object.values(teams).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.name.localeCompare(b.name);
    });
}

// Extract club name from team name (remove age group suffix)
function getClubName(teamName) {
    if (!teamName) return '';
    return teamName.replace(/\s+(U\d+|Seniors|Reserves)$/i, '').trim();
}

// Calculate combined club ladder
function calculateCombinedLadder() {
    const clubs = {};
    
    // Process each age group (filtered to selection; empty set = all)
    const activeLeagues = selectedCombinedAgeGroups.size === 0
        ? leaguesData
        : leaguesData.filter(l => selectedCombinedAgeGroups.has(l.id));

    activeLeagues.forEach(league => {
        const ladder = calculateLadder(league.name);
        
        ladder.forEach((team, index) => {
            const clubName = getClubName(team.name);
            
            if (!clubs[clubName]) {
                clubs[clubName] = {
                    name: clubName,
                    logo: team.logo,
                    totalPoints: 0,
                    totalGoalsFor: 0,
                    totalGoalsAgainst: 0,
                    totalGoalDifference: 0,
                    totalPlayed: 0,
                    totalWon: 0,
                    totalDrawn: 0,
                    totalLost: 0,
                    ageGroups: {}
                };
            }
            
            // Aggregate stats
            clubs[clubName].totalPoints += team.points;
            clubs[clubName].totalGoalsFor += team.goalsFor;
            clubs[clubName].totalGoalsAgainst += team.goalsAgainst;
            clubs[clubName].totalGoalDifference += team.goalDifference;
            clubs[clubName].totalPlayed += team.played;
            clubs[clubName].totalWon += team.won;
            clubs[clubName].totalDrawn += team.drawn;
            clubs[clubName].totalLost += team.lost;
            
            // Store individual age group performance
            clubs[clubName].ageGroups[league.name] = {
                position: index + 1,
                points: team.points,
                played: team.played
            };
        });
    });
    
    // Convert to array and sort by total points
    return Object.values(clubs).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.totalGoalDifference !== a.totalGoalDifference) return b.totalGoalDifference - a.totalGoalDifference;
        if (b.totalGoalsFor !== a.totalGoalsFor) return b.totalGoalsFor - a.totalGoalsFor;
        return a.name.localeCompare(b.name);
    });
}

// Render combined club ladder
function renderCombinedLadder() {
    const ladder = calculateCombinedLadder();
    const container = document.getElementById('combined-ladder');
    
    if (ladder.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500">No data available</div>';
        return;
    }
    
    let html = `
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Club</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">P</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">W</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">D</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">L</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GF</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GA</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GD</th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Pts</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
    `;
    
    ladder.forEach((club, index) => {
        const position = index + 1;
        let rowClass = 'ladder-row';
        
        // Highlight promotion/relegation zones based on gender and division
        // Girls league: no colors (no promotion/relegation)
        // BVYPL1 (bgdMX6MDKE): only relegation zone (bottom 2) - no promotion from top division
        // BVYPL2 (Bjma0zXAdR): top 2 promoted, bottom 2 relegated
        // BYSL (AnmYznkyNz, 2PmjO2pANZ): only 1st promoted, only last relegated
        if (currentGender === 'boys') {
            if (currentDivision === 'bgdMX6MDKE') {
                // BVYPL1: only show relegation zone (bottom 2)
                if (position >= 15) {
                    rowClass += ' relegated';
                }
            } else if (currentDivision === 'Bjma0zXAdR') {
                // BVYPL2: top 2 promoted, bottom 2 relegated
                if (position <= 2) {
                    rowClass += ' promoted';
                } else if (position >= 15) {
                    rowClass += ' relegated';
                }
            } else {
                // BYSL divisions: only 1st place promoted, only last place relegated (10 teams)
                if (position === 1) {
                    rowClass += ' promoted';
                } else if (position >= ladder.length) {
                    rowClass += ' relegated';
                }
            }
        }
        // Girls league: no colors applied
        
        html += `
            <tr class="${rowClass} cursor-pointer hover:bg-blue-50"
                onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(club.name)}">
                <td class="px-4 py-3 font-semibold">${position}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <img src="${club.logo}" alt="${escAttr(club.name)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                        <span class="font-medium text-blue-700">${escHtml(club.name)}</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-center">${club.totalPlayed}</td>
                <td class="px-4 py-3 text-center">${club.totalWon}</td>
                <td class="px-4 py-3 text-center">${club.totalDrawn}</td>
                <td class="px-4 py-3 text-center">${club.totalLost}</td>
                <td class="px-4 py-3 text-center">${club.totalGoalsFor}</td>
                <td class="px-4 py-3 text-center">${club.totalGoalsAgainst}</td>
                <td class="px-4 py-3 text-center font-semibold ${club.totalGoalDifference >= 0 ? 'text-green-600' : 'text-red-600'}">${club.totalGoalDifference > 0 ? '+' : ''}${club.totalGoalDifference}</td>
                <td class="px-4 py-3 text-center font-bold text-blue-600">${club.totalPoints}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

// Render age group ladders
function renderAgeGroupLadders() {
    const filtersContainer = document.getElementById('age-group-filters');
    const laddersContainer = document.getElementById('age-group-ladders');
    
    // Render all ladders
    let laddersHtml = '';
    
    leaguesData.forEach(league => {
        const ladder = calculateLadder(league.name);
        
        laddersHtml += `
            <div class="bg-white rounded-lg shadow-md overflow-hidden mb-6 age-group-ladder" data-league="${league.id}">
                <div class="bg-blue-600 text-white px-6 py-4">
                    <h3 class="text-xl font-bold">${league.name}</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-100 border-b-2 border-gray-300">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pos</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Team</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">P</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">W</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">D</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">L</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GF</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GA</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">GD</th>
                                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Pts</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
        `;
        
        ladder.forEach((team, index) => {
            const clubName = getClubName(team.name);
            laddersHtml += `
                <tr class="ladder-row cursor-pointer hover:bg-blue-50"
                    onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(clubName)}">
                    <td class="px-4 py-3 font-semibold">${index + 1}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                            <img src="${team.logo}" alt="${escAttr(team.name)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                            <span class="font-medium text-blue-700">${escHtml(team.name)}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center">${team.played}</td>
                    <td class="px-4 py-3 text-center">${team.won}</td>
                    <td class="px-4 py-3 text-center">${team.drawn}</td>
                    <td class="px-4 py-3 text-center">${team.lost}</td>
                    <td class="px-4 py-3 text-center">${team.goalsFor}</td>
                    <td class="px-4 py-3 text-center">${team.goalsAgainst}</td>
                    <td class="px-4 py-3 text-center font-semibold ${team.goalDifference >= 0 ? 'text-green-600' : 'text-red-600'}">${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
                    <td class="px-4 py-3 text-center font-bold text-blue-600">${team.points}</td>
                </tr>
            `;
        });
        
        laddersHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    laddersContainer.innerHTML = laddersHtml;
}


// Render fixtures
function renderFixtures() {
    const roundFilter = selectedFixtureRound;
    const leagueFilter = selectedFixtureLeague;
    const container = document.getElementById('fixtures-list');
    
    let filteredFixtures = fixturesData.filter(fixture => {
        const attrs = fixture.attributes;
        const isPending = attrs.status === 'pending';
        const matchesRound = !roundFilter || attrs.round === roundFilter.replace('roundrobin_', 'R');
        const matchesLeague = !leagueFilter || leaguesData.find(l => l.id === leagueFilter)?.name === attrs.league_name;
        return isPending && matchesRound && matchesLeague;
    });
    
    if (filteredFixtures.length === 0) {
        container.innerHTML = '<div class="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">No fixtures found</div>';
        return;
    }
    
    // Group by round, then by matchup (club names)
    const fixturesByRound = {};
    filteredFixtures.forEach(fixture => {
        const round = fixture.attributes.full_round;
        if (!fixturesByRound[round]) {
            fixturesByRound[round] = {};
        }
        
        // Extract club names (remove age group suffix)
        const homeClub = getClubName(fixture.attributes.home_team_name);
        const awayClub = getClubName(fixture.attributes.away_team_name);
        const matchupKey = `${homeClub} vs ${awayClub}`;
        
        if (!fixturesByRound[round][matchupKey]) {
            fixturesByRound[round][matchupKey] = [];
        }
        fixturesByRound[round][matchupKey].push(fixture);
    });
    
    let html = '';
    // Sort rounds numerically by extracting the round number
    Object.keys(fixturesByRound).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
    }).forEach(round => {
        html += `
            <div class="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                <div class="bg-gray-800 text-white px-6 py-3">
                    <h3 class="text-lg font-bold">${round}</h3>
                </div>
                <div class="divide-y divide-gray-200">
        `;
        
        // Sort matchups alphabetically
        Object.keys(fixturesByRound[round]).sort().forEach(matchupKey => {
            const matchupFixtures = fixturesByRound[round][matchupKey];
            
            // Display all age group fixtures for this matchup
            matchupFixtures.forEach(fixture => {
            const attrs = fixture.attributes;
            const date = new Date(attrs.date);
            const dateStr = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
            
            html += `
                <div class="stripe-row p-3 sm:p-6 hover:bg-blue-50 border-b border-gray-100 cursor-pointer"
                     onclick="navigateToMatch('${escAttr(fixture.hash_id)}', 'fixture')">
                    <div class="flex items-center gap-2 sm:gap-4">
                        <!-- Date and Time -->
                        <div class="text-xs sm:text-sm text-gray-600 w-20 sm:w-32 flex-shrink-0">
                            <div class="font-medium">${escHtml(dateStr)}</div>
                            <div>${escHtml(timeStr)}</div>
                        </div>

                        <!-- Teams and Info -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-center gap-2 sm:gap-4 mb-1 sm:mb-2">
                                <div class="flex items-center gap-1 sm:gap-2 flex-1 justify-end min-w-0">
                                    ${attrs.home_team_name
                                        ? `<span class="font-semibold text-right text-blue-700 hover:underline text-xs sm:text-base truncate"
                                              onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.home_team_name))}')">${escHtml(attrs.home_team_name)}</span>`
                                        : `<span class="text-gray-400 text-sm">Bye</span>`}
                                    <img src="${escAttr(attrs.home_logo || '')}" class="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" onerror="this.style.display='none'">
                                </div>
                                <span class="text-gray-400 font-bold px-1">-</span>
                                <div class="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                                    <img src="${escAttr(attrs.away_logo || '')}" class="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" onerror="this.style.display='none'">
                                    ${attrs.away_team_name
                                        ? `<span class="font-semibold text-blue-700 hover:underline text-xs sm:text-base truncate"
                                              onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.away_team_name))}')">${escHtml(attrs.away_team_name)}</span>`
                                        : `<span class="text-gray-400 text-sm">Bye</span>`}
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-500 flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                                <span class="hidden sm:inline">${escHtml(attrs.league_name)}</span>
                                <span class="hidden sm:inline text-gray-300">•</span>
                                <span>${escHtml(attrs.ground_name)}</span>
                                ${attrs.field_name ? `<span class="text-gray-300">•</span><span>${escHtml(attrs.field_name)}</span>` : ''}
                            </div>
                        </div>

                        <!-- Round -->
                        <div class="hidden sm:block text-sm text-right w-16 flex-shrink-0">
                            <div class="font-medium">${escHtml(attrs.round)}</div>
                        </div>
                    </div>
                </div>
            `;
            });
        });

        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Render results
function renderResults() {
    const roundFilter = selectedResultRound;
    const leagueFilter = selectedResultLeague;
    const container = document.getElementById('results-list');
    
    let filteredResults = resultsData.filter(result => {
        const attrs = result.attributes;
        const isComplete = attrs.status === 'complete';
        const matchesRound = !roundFilter || attrs.round === roundFilter.replace('roundrobin_', 'R');
        const matchesLeague = !leagueFilter || leaguesData.find(l => l.id === leagueFilter)?.name === attrs.league_name;
        return isComplete && matchesRound && matchesLeague;
    });
    
    if (filteredResults.length === 0) {
        container.innerHTML = '<div class="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">No results found</div>';
        return;
    }
    
    // Group by round, then by matchup (club names)
    const resultsByRound = {};
    filteredResults.forEach(result => {
        const round = result.attributes.full_round;
        if (!resultsByRound[round]) {
            resultsByRound[round] = {};
        }
        
        // Extract club names (remove age group suffix)
        const homeClub = getClubName(result.attributes.home_team_name);
        const awayClub = getClubName(result.attributes.away_team_name);
        const matchupKey = `${homeClub} vs ${awayClub}`;
        
        if (!resultsByRound[round][matchupKey]) {
            resultsByRound[round][matchupKey] = [];
        }
        resultsByRound[round][matchupKey].push(result);
    });
    
    let html = '';
    // Sort rounds numerically in descending order (most recent first)
    Object.keys(resultsByRound).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numB - numA;
    }).forEach(round => {
        html += `
            <div class="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                <div class="bg-gray-800 text-white px-6 py-3">
                    <h3 class="text-lg font-bold">${round}</h3>
                </div>
                <div class="divide-y divide-gray-200">
        `;
        
        // Sort matchups alphabetically
        Object.keys(resultsByRound[round]).sort().forEach(matchupKey => {
            const matchupResults = resultsByRound[round][matchupKey];
            
            // Display all age group results for this matchup
            matchupResults.forEach(result => {
            const attrs = result.attributes;
            const date = new Date(attrs.date);
            const dateStr = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            
            html += `
                <div class="stripe-row p-3 sm:p-6 hover:bg-blue-50 border-b border-gray-100 cursor-pointer"
                     onclick="navigateToMatch('${escAttr(result.hash_id)}', 'result')">
                    <div class="flex items-center gap-2 sm:gap-4">
                        <!-- Date -->
                        <div class="text-xs sm:text-sm text-gray-600 w-16 sm:w-28 flex-shrink-0">
                            <div class="font-medium">${escHtml(dateStr)}</div>
                        </div>

                        <!-- Teams with Scores and Info -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-center gap-2 sm:gap-4 mb-1 sm:mb-2">
                                <div class="flex items-center gap-1 sm:gap-2 flex-1 justify-end min-w-0">
                                    ${attrs.home_team_name
                                        ? `<span class="font-semibold text-right text-blue-700 hover:underline text-xs sm:text-base truncate"
                                              onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.home_team_name))}')">${escHtml(attrs.home_team_name)}</span>`
                                        : `<span class="text-gray-400 text-sm">Bye</span>`}
                                    <img src="${escAttr(attrs.home_logo || '')}" class="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" onerror="this.style.display='none'">
                                </div>
                                <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                    <span class="text-base sm:text-xl font-bold ${attrs.home_score > attrs.away_score ? 'text-green-600' : 'text-gray-600'}">${attrs.home_score}</span>
                                    <span class="text-gray-400 font-bold">-</span>
                                    <span class="text-base sm:text-xl font-bold ${attrs.away_score > attrs.home_score ? 'text-green-600' : 'text-gray-600'}">${attrs.away_score}</span>
                                </div>
                                <div class="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                                    <img src="${escAttr(attrs.away_logo || '')}" class="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" onerror="this.style.display='none'">
                                    ${attrs.away_team_name
                                        ? `<span class="font-semibold text-blue-700 hover:underline text-xs sm:text-base truncate"
                                              onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.away_team_name))}')">${escHtml(attrs.away_team_name)}</span>`
                                        : `<span class="text-gray-400 text-sm">Bye</span>`}
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-500 flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                                <span class="hidden sm:inline">${escHtml(attrs.league_name)}</span>
                                <span class="hidden sm:inline text-gray-300">•</span>
                                <span>${escHtml(attrs.ground_name)}</span>
                            </div>
                        </div>

                        <!-- Round -->
                        <div class="hidden sm:block text-sm text-right w-16 flex-shrink-0">
                            <div class="font-medium">${escHtml(attrs.round)}</div>
                        </div>
                    </div>
                </div>
            `;
            });
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load data when page loads — works whether script is static or dynamically injected
function getInitialSelection() {
    const savedDivision = localStorage.getItem('vpl_division');
    const allDivisions = divisions.boys;
    const division = savedDivision && allDivisions[savedDivision] ? savedDivision : Object.keys(allDivisions)[0];
    return { gender: 'boys', division };
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => { const s = getInitialSelection(); loadData(s.gender, s.division); });
} else {
    const s = getInitialSelection(); loadData(s.gender, s.division);
}

window.addEventListener('hashchange', handleHashChange);
