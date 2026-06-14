// VPL Rankings Application
let leaguesData = [];
let fixturesData = [];
let resultsData = [];
let roundsData = [];
let currentGender = 'boys'; // Default to boys
let currentDivision = 'bgdMX6MDKE'; // Default to YPL1

// Division configuration by gender
const divisions = {
    boys: {
        'bgdMX6MDKE': { name: 'YPL1', fullName: 'Boys Victorian Youth Premier League 1' },
        'Bjma0zXAdR': { name: 'YPL2', fullName: 'Boys Victorian Youth Premier League 2' },
        'AnmYznkyNz': { name: 'BVYSL NW', fullName: 'Boys Victorian Youth State League North-West' },
        '2PmjO2pANZ': { name: 'BVYSL SE', fullName: 'Boys Victorian Youth State League South-East' }
    },
    girls: {
        '3pmvQvbDdv': { name: 'YGPL', fullName: 'Girls Victorian Youth Premier League' }
    }
};

// Load all data on page load
async function loadData(gender = 'boys', divisionId = null) {
    try {
        currentGender = gender;
        
        // If no division specified, use first division for the gender
        if (!divisionId) {
            divisionId = Object.keys(divisions[gender])[0];
        }
        currentDivision = divisionId;
        
        // Show loading message
        document.getElementById('combined-ladder').innerHTML = `<div class="text-center py-8 text-gray-500">Loading ${divisions[gender][divisionId].fullName} data from API...</div>`;
        
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
        
        // Helper function to fetch all pages
        async function fetchAllPages(endpoint, leagueId) {
            let allData = [];
            let cursor = null;
            let hasMore = true;
            
            while (hasMore) {
                const url = cursor 
                    ? `${baseUrl}/${endpoint}?${params}&league=${leagueId}&cursor=${cursor}`
                    : `${baseUrl}/${endpoint}?${params}&league=${leagueId}`;
                
                try {
                    const response = await fetch(url);
                    const json = await response.json();
                    
                    if (json.data && json.data.length > 0) {
                        allData = allData.concat(json.data);
                    }
                    
                    // Check for next page cursor
                    if (json.meta && json.meta.next_cursor) {
                        cursor = json.meta.next_cursor;
                    } else {
                        hasMore = false;
                    }
                } catch (err) {
                    console.error(`Error fetching ${endpoint} for ${leagueId}:`, err);
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

// Populate division dropdown based on gender
function populateDivisionDropdown(gender) {
    const divisionSelector = document.getElementById('division-selector');
    const genderDivisions = divisions[gender];
    
    let options = '';
    Object.keys(genderDivisions).forEach(divisionId => {
        options += `<option value="${divisionId}">${genderDivisions[divisionId].fullName}</option>`;
    });
    
    divisionSelector.innerHTML = options;
    divisionSelector.value = Object.keys(genderDivisions)[0];
    
    // Update ladder description when gender changes
    updateLadderDescription(gender);
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
    
    // Update ladder description for initial gender
    updateLadderDescription(currentGender);
    
    // Add gender selector event listener
    const genderSelector = document.getElementById('gender-selector');
    genderSelector.value = currentGender;
    genderSelector.addEventListener('change', (e) => {
        const newGender = e.target.value;
        populateDivisionDropdown(newGender);
        const firstDivision = Object.keys(divisions[newGender])[0];
        loadData(newGender, firstDivision);
    });
    
    // Add division selector event listener
    const divisionSelector = document.getElementById('division-selector');
    populateDivisionDropdown(currentGender);
    divisionSelector.value = currentDivision;
    divisionSelector.addEventListener('change', (e) => {
        loadData(currentGender, e.target.value);
    });
    
    // Show combined ladder by default
    showTab('combined');

    // Handle deep-linked detail URL on page load
    if (window.location.hash) {
        handleHashChange();
    }
}

// Tab switching
function showTab(tabName) {
    lastActiveTab = tabName;
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('tab-active');
    });
    
    // Show selected tab
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('tab-active');
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
    
    // Create age group button filters for Fixtures (without "All Age Groups")
    const fixtureAgeGroupFilters = document.getElementById('fixture-age-group-filters');
    let fixtureButtonsHtml = '';
    leaguesData.forEach((league, index) => {
        const isFirst = index === 0;
        fixtureButtonsHtml += `
            <button onclick="filterFixturesByAgeGroup('${league.id}')" class="px-4 py-2 ${isFirst ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} rounded hover:bg-blue-700 fixture-age-btn ${isFirst ? 'active' : ''}" data-league="${league.id}">
                ${league.name}
            </button>
        `;
    });
    fixtureAgeGroupFilters.innerHTML = fixtureButtonsHtml;
    
    // Create age group button filters for Results (without "All Age Groups")
    const resultAgeGroupFilters = document.getElementById('result-age-group-filters');
    let resultButtonsHtml = '';
    leaguesData.forEach((league, index) => {
        const isFirst = index === 0;
        resultButtonsHtml += `
            <button onclick="filterResultsByAgeGroup('${league.id}')" class="px-4 py-2 ${isFirst ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} rounded hover:bg-blue-700 result-age-btn ${isFirst ? 'active' : ''}" data-league="${league.id}">
                ${league.name}
            </button>
        `;
    });
    resultAgeGroupFilters.innerHTML = resultButtonsHtml;
    
    // Set first age group as default for both fixtures and results
    if (leaguesData.length > 0) {
        selectedFixtureLeague = leaguesData[0].id;
        selectedResultLeague = leaguesData[0].id;
    }
}

// Global variables to track selected filters
let selectedFixtureLeague = '';
let selectedResultLeague = '';
let selectedFixtureRound = '';
let selectedResultRound = '';
let selectedCombinedAgeGroups = new Set(); // empty = all selected

let teamIdMap = {};    // fullTeamName → teamId
let clubLogoMap = {};  // clubName (suffix-stripped) → logoUrl
let lastActiveTab = 'combined'; // restored when detail view is dismissed

function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

function showMatchTab(name) {
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
            <div class="flex py-2 border-b border-gray-100 last:border-0">
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
            html += `<div class="flex py-2 border-b border-gray-100 last:border-0">
                <span class="w-40 text-xs font-semibold text-gray-500 uppercase pt-0.5">${escHtml(label)}</span>
                <span class="text-sm text-gray-800">${escHtml(String(value))}</span>
            </div>`;
        });
        html += `</div></div>`;
    }

    // Goals timeline
    const goals = (a.match_events || []).filter(ev => ev.type === 'goal');
    if (goals.length) {
        html += `<div class="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3 class="text-lg font-semibold mb-4">Goals</h3><div>`;
        let prevHome = 0;
        goals.forEach(ev => {
            const isHome = ev.home_score > prevHome;
            const team = escHtml(isHome ? (a.home_team_name || '') : (a.away_team_name || ''));
            const color = escAttr(isHome ? (a.home_club_color || '#2563eb') : (a.away_club_color || '#6b7280'));
            const note = ev.own_goal ? ' (OG)' : ev.penalty_kick ? ' (Pen)' : '';
            html += `<div class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span class="text-sm font-bold text-gray-400 w-8 text-right">${escHtml(String(ev.minute))}'</span>
                <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}"></div>
                <span class="flex-1 text-sm">${escHtml(ev.name || '—')}${ev.jersey ? ` <span class="text-gray-400 text-xs">#${ev.jersey}</span>` : ''}${note ? ` <span class="text-gray-500 text-xs">${escHtml(note)}</span>` : ''}</span>
                <span class="text-xs text-gray-500 w-32 text-right">${team}</span>
                <span class="text-sm font-bold tabular-nums w-10 text-right">${ev.home_score}–${ev.away_score}</span>
            </div>`;
            prevHome = ev.home_score;
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

function renderLineup(players, teamName) {
    if (!Array.isArray(players) || !players.length) return '';

    const starters = players.filter(p => p.starting).sort((a, b) => (parseInt(a.jersey) || 99) - (parseInt(b.jersey) || 99));
    const bench = players.filter(p => !p.starting && p.available).sort((a, b) => (parseInt(a.jersey) || 99) - (parseInt(b.jersey) || 99));

    if (!starters.length && !bench.length) return '';

    const renderPlayer = (p) => {
        const name = escHtml(`${p.first_name} ${p.last_name}`);
        const pos = p.is_goalkeeper ? 'GK' : (p.field_role || '');
        const cardHtml = p.has_cards
            ? (p.cards || []).map(c =>
                (c.type || c.card_type) === 'yellow'
                    ? '<span class="inline-block w-3 h-4 bg-yellow-400 rounded-sm align-middle"></span>'
                    : '<span class="inline-block w-3 h-4 bg-red-600 rounded-sm align-middle"></span>'
              ).join('')
            : '';
        const goalHtml = p.has_goals && p.goals && p.goals.length
            ? `<span class="text-xs text-gray-500">${p.goals.length > 1 ? p.goals.length + 'G' : 'G'}</span>`
            : '';
        const capHtml = p.is_captain ? '<span class="text-xs font-bold text-yellow-600 border border-yellow-400 rounded px-1">C</span>' : '';

        return `<div class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
            <img src="${escAttr(p.image || '')}" class="w-8 h-8 rounded-full object-cover bg-gray-100 flex-shrink-0" onerror="this.style.display='none'">
            <span class="text-xs text-gray-400 w-8 flex-shrink-0 text-right">${p.jersey ? escHtml(String(p.jersey)) : ''}</span>
            <span class="flex-1 text-sm font-medium">${name}</span>
            ${pos ? `<span class="text-xs text-gray-400">${escHtml(pos)}</span>` : ''}
            <div class="flex items-center gap-1">${capHtml}${goalHtml}${cardHtml}</div>
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
            <div>${bench.map(renderPlayer).join('')}</div>`;
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
                            ${escHtml(attrs.home_team_name)}
                        </div>
                    </div>
                    <img src="${escAttr(attrs.home_logo)}" alt="${escAttr(attrs.home_team_name)}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">
                </div>
                <div class="text-center min-w-24">
                    ${scoreHtml}
                </div>
                <div class="flex items-center gap-3 flex-1 justify-start">
                    <img src="${escAttr(attrs.away_logo)}" alt="${escAttr(attrs.away_team_name)}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">
                    <div>
                        <div class="font-bold text-lg cursor-pointer hover:text-blue-600"
                             onclick="navigateToTeam(this.dataset.club)" data-club="${escAttr(getClubName(attrs.away_team_name))}">
                            ${escHtml(attrs.away_team_name)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="text-center text-sm text-gray-500 mt-4 space-y-1">
                <div>${escHtml(dateStr)} at ${escHtml(timeStr)}</div>
                <div>${escHtml(attrs.league_name)} · ${escHtml(attrs.full_round || attrs.round)}</div>
                <div>${escHtml(attrs.ground_name)}${attrs.field_name ? ' · ' + escHtml(attrs.field_name) : ''}</div>
            </div>
        </div>
        <div class="flex gap-2 mb-4 flex-wrap">
            <button onclick="showMatchTab('summary')" id="match-tab-summary" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Summary</button>
            <button onclick="showMatchTab('home')" id="match-tab-home" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-blue-700 hover:text-white text-sm">${escHtml(getClubName(attrs.home_team_name))}</button>
            <button onclick="showMatchTab('away')" id="match-tab-away" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-blue-700 hover:text-white text-sm">${escHtml(getClubName(attrs.away_team_name))}</button>
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
    if (homeEl) homeEl.innerHTML = homeResult ? renderLineup(homeResult, attrs.home_team_name) : '<div class="text-center py-4 text-gray-400 text-sm">No lineup data.</div>';
    if (awayEl) awayEl.innerHTML = awayResult ? renderLineup(awayResult, attrs.away_team_name) : '<div class="text-center py-4 text-gray-400 text-sm">No lineup data.</div>';
}

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
                 onclick="navigateToMatch('${escAttr(r.hash_id)}', 'result')">
                <span class="text-xs text-gray-400 w-16">${escHtml(dateStr)}</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded ${outcomeColor} w-6 text-center">${outcome}</span>
                <img src="${escAttr(opponentLogo)}" class="w-6 h-6 object-contain" onerror="this.style.display='none'">
                <span class="flex-1 text-sm">${isHome ? 'vs' : '@'} ${escHtml(opponent)}</span>
                <span class="text-sm font-bold">${clubScore}–${oppScore}</span>
                <span class="text-xs text-gray-400">${escHtml(attrs.league_name)}</span>
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
                 onclick="navigateToMatch('${escAttr(f.hash_id)}', 'fixture')">
                <span class="text-xs text-gray-400 w-32">${escHtml(dateStr)} ${escHtml(timeStr)}</span>
                <img src="${escAttr(opponentLogo)}" class="w-6 h-6 object-contain" onerror="this.style.display='none'">
                <span class="flex-1 text-sm">${isHome ? 'vs' : '@'} ${escHtml(opponent)}</span>
                <span class="text-xs text-gray-400">${escHtml(attrs.league_name)}</span>
                <span class="text-xs text-gray-400">${escHtml(attrs.full_round || attrs.round)}</span>
            </div>`;
    }).join('');

    const html = `
        <button onclick="history.back()" class="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold">
            ← Back
        </button>

        <div class="bg-blue-600 text-white rounded-lg shadow-md p-6 mb-6">
            <div class="flex items-center gap-4">
                ${logo ? `<img src="${escAttr(logo)}" alt="${escAttr(clubName)}" class="w-16 h-16 object-contain bg-white rounded p-1">` : ''}
                <div>
                    <h2 class="text-2xl font-bold">${escHtml(clubName)}</h2>
                    <p class="text-blue-100">${escHtml(divisionName)} · 2026</p>
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

    `;

    showDetailView(html);

}

// Populate combined ladder age group toggle buttons
function populateCombinedLadderFilters() {
    selectedCombinedAgeGroups = new Set(); // reset to "all" on data reload
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
    updateCombinedAgeGroupButtons();
    renderCombinedLadder();
    el.blur();
}

// Reset combined ladder to show all age groups
function selectAllCombinedAgeGroups(el) {
    selectedCombinedAgeGroups = new Set();
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
function filterFixturesByAgeGroup(leagueId) {
    selectedFixtureLeague = leagueId;
    
    // Update button styles
    document.querySelectorAll('.fixture-age-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white', 'active');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    event.target.classList.remove('bg-gray-200', 'text-gray-700');
    event.target.classList.add('bg-blue-600', 'text-white', 'active');
    
    renderFixtures();
}

// Filter results by age group
function filterResultsByAgeGroup(leagueId) {
    selectedResultLeague = leagueId;
    
    // Update button styles
    document.querySelectorAll('.result-age-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white', 'active');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    event.target.classList.remove('bg-gray-200', 'text-gray-700');
    event.target.classList.add('bg-blue-600', 'text-white', 'active');
    
    renderResults();
}

// Calculate ladder for a specific age group
function calculateLadder(leagueName) {
    const teams = {};
    
    // Process results for this league
    resultsData
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
    // Remove U13, U14, U15, U16, U17, U18 suffixes
    return teamName.replace(/\s+(U13|U14|U15|U16|U17|U18)$/i, '').trim();
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
    
    // Create filter buttons (without "All Age Groups")
    let filterHtml = '';
    
    leaguesData.forEach((league, index) => {
        const isFirst = index === 0;
        filterHtml += `
            <button onclick="showAgeGroup('${league.id}')" class="px-4 py-2 ${isFirst ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} rounded hover:bg-blue-700 age-group-btn ${isFirst ? 'active' : ''}" data-league="${league.id}">
                ${league.name}
            </button>
        `;
    });
    
    filtersContainer.innerHTML = filterHtml;
    
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
    
    // Show only the first age group by default
    if (leaguesData.length > 0) {
        document.querySelectorAll('.age-group-ladder').forEach((el, index) => {
            el.style.display = index === 0 ? 'block' : 'none';
        });
    }
}

// Show specific age group
function showAgeGroup(leagueId) {
    document.querySelectorAll('.age-group-ladder').forEach(el => {
        el.style.display = el.dataset.league === leagueId ? 'block' : 'none';
    });
    document.querySelectorAll('.age-group-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white', 'active');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    event.target.classList.remove('bg-gray-200', 'text-gray-700');
    event.target.classList.add('bg-blue-600', 'text-white', 'active');
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
                <div class="p-6 hover:bg-blue-50 border-b border-gray-100 cursor-pointer"
                     onclick="navigateToMatch('${escAttr(fixture.hash_id)}', 'fixture')">
                    <div class="flex items-center gap-4">
                        <!-- Date and Time -->
                        <div class="text-sm text-gray-600 w-32">
                            <div class="font-medium">${escHtml(dateStr)}</div>
                            <div>${escHtml(timeStr)}</div>
                        </div>

                        <!-- Teams and Info -->
                        <div class="flex-1">
                            <div class="flex items-center justify-center gap-4 mb-2">
                                <div class="flex items-center gap-2 flex-1 justify-end">
                                    <span class="font-semibold text-right text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.home_team_name))}')">${escHtml(attrs.home_team_name)}</span>
                                    <img src="${escAttr(attrs.home_logo)}" alt="${escAttr(attrs.home_team_name)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                </div>
                                <span class="text-gray-400 font-bold px-2">-</span>
                                <div class="flex items-center gap-2 flex-1">
                                    <img src="${escAttr(attrs.away_logo)}" alt="${escAttr(attrs.away_team_name)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                    <span class="font-semibold text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.away_team_name))}')">${escHtml(attrs.away_team_name)}</span>
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-600 flex items-center justify-center gap-2">
                                <span>${escHtml(attrs.league_name)}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-500">${escHtml(attrs.ground_name)}</span>
                                ${attrs.field_name ? `<span class="text-gray-400">•</span><span class="text-gray-500">${escHtml(attrs.field_name)}</span>` : ''}
                            </div>
                        </div>

                        <!-- Round -->
                        <div class="text-sm text-right w-24">
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
                <div class="p-6 hover:bg-blue-50 border-b border-gray-100 cursor-pointer"
                     onclick="navigateToMatch('${escAttr(result.hash_id)}', 'result')">
                    <div class="flex items-center gap-4">
                        <!-- Date -->
                        <div class="text-sm text-gray-600 w-32">
                            <div class="font-medium">${escHtml(dateStr)}</div>
                        </div>

                        <!-- Teams with Scores and Info -->
                        <div class="flex-1">
                            <div class="flex items-center justify-center gap-4 mb-2">
                                <div class="flex items-center gap-2 flex-1 justify-end">
                                    <span class="font-semibold text-right text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.home_team_name))}')">${escHtml(attrs.home_team_name)}</span>
                                    <img src="${escAttr(attrs.home_logo)}" alt="${escAttr(attrs.home_team_name)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xl font-bold ${attrs.home_score > attrs.away_score ? 'text-green-600' : 'text-gray-600'}">${attrs.home_score}</span>
                                    <span class="text-gray-400 font-bold">-</span>
                                    <span class="text-xl font-bold ${attrs.away_score > attrs.home_score ? 'text-green-600' : 'text-gray-600'}">${attrs.away_score}</span>
                                </div>
                                <div class="flex items-center gap-2 flex-1">
                                    <img src="${escAttr(attrs.away_logo)}" alt="${escAttr(attrs.away_team_name)}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                                    <span class="font-semibold text-blue-700 hover:underline"
                                          onclick="event.stopPropagation(); navigateToTeam('${escAttr(getClubName(attrs.away_team_name))}')">${escHtml(attrs.away_team_name)}</span>
                                </div>
                            </div>
                            <div class="text-center text-xs text-gray-600 flex items-center justify-center gap-2">
                                <span>${escHtml(attrs.league_name)}</span>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-500">${escHtml(attrs.ground_name)}</span>
                            </div>
                        </div>

                        <!-- Round -->
                        <div class="text-sm text-right w-24">
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
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => loadData('boys', 'bgdMX6MDKE'));
} else {
    loadData('boys', 'bgdMX6MDKE');
}

window.addEventListener('hashchange', handleHashChange);
