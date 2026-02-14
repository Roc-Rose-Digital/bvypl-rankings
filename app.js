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
        zonesEl.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 bg-green-200 border border-green-300"></div>
                <span>Promotion Zone (Top 2 stay in BVYPL1)</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 bg-red-200 border border-red-300"></div>
                <span>Relegation Zone (Bottom 2 to BVYPL2)</span>
            </div>
        `;
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
}

// Tab switching
function showTab(tabName) {
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
    
    // Process each age group
    leaguesData.forEach(league => {
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
        
        // Highlight promotion/relegation zones (assuming 16 teams)
        if (position <= 2) {
            rowClass += ' promoted';
        } else if (position >= 15) {
            rowClass += ' relegated';
        }
        
        html += `
            <tr class="${rowClass}">
                <td class="px-4 py-3 font-semibold">${position}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <img src="${club.logo}" alt="${club.name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                        <span class="font-medium">${club.name}</span>
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
            laddersHtml += `
                <tr class="ladder-row">
                    <td class="px-4 py-3 font-semibold">${index + 1}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                            <img src="${team.logo}" alt="${team.name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'">
                            <span class="font-medium">${team.name}</span>
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
            
            // Display matchup header
            html += `
                <div class="p-4 bg-gray-50">
                    <h4 class="font-semibold text-gray-700">${matchupKey}</h4>
                </div>
            `;
            
            // Display all age group fixtures for this matchup
            matchupFixtures.forEach(fixture => {
            const attrs = fixture.attributes;
            const date = new Date(attrs.date);
            const dateStr = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
            
            html += `
                <div class="p-4 hover:bg-gray-50 border-b border-gray-100">
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
            
            // Display matchup header
            html += `
                <div class="p-4 bg-gray-50">
                    <h4 class="font-semibold text-gray-700">${matchupKey}</h4>
                </div>
            `;
            
            // Display all age group results for this matchup
            matchupResults.forEach(result => {
            const attrs = result.attributes;
            const date = new Date(attrs.date);
            const dateStr = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            
            html += `
                <div class="p-4 hover:bg-gray-50 border-b border-gray-100">
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
            });
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load data when page loads
window.addEventListener('DOMContentLoaded', () => {
    loadData('boys', 'bgdMX6MDKE');
});
