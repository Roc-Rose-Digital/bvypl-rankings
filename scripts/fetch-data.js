const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SEASON = 'nPmrj2rmow';
const TENANT = 'w8zdBWPmBX';
const TIMEZONE = 'Australia%2FSydney';
const CURL_HEADERS = [
    '-H "Referer: https://fv.dribl.com/"',
    '-H "Origin: https://fv.dribl.com"',
    '-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"',
    '-H "Accept: application/json, text/plain, */*"',
    '-H "sec-fetch-site: same-site"',
    '-H "sec-fetch-mode: cors"',
    '-H "sec-fetch-dest: empty"',
].join(' ');

const divisionIds = [
    '1pN6pRypd0', 'k2KpR0XbmY',
    'LBdDxbvJdb', 'vbd91pPYd4', 'R1K3BpA9NQ',
    'wOmejBq1N0', 'A4KLxy81Kq',
    'bgdMX6MDKE', 'Bjma0zXAdR', 'AnmYznkyNz', '2PmjO2pANZ', '3pmvQvbDdv', 'XWdg6GGZKR',
    'gld4pXExdW', 'Bjma0p6VdR', 'vbd918ywd4', 'nPmrBVjAmo',
    'Rxm8RpZLKr', 'gld4pXoDdW', 'jJmXQb5WNn',
];

function curlGet(url) {
    const raw = execSync(`curl -s ${CURL_HEADERS} "${url}"`, { maxBuffer: 50 * 1024 * 1024 }).toString();
    return JSON.parse(raw);
}

function fetchAllPages(endpoint, divisionId) {
    const base = `https://mc-api.dribl.com/api/${endpoint}?season=${SEASON}&competition=${divisionId}&tenant=${TENANT}&timezone=${TIMEZONE}`;
    let allData = [];
    let cursor = null;
    while (true) {
        const url = base + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
        const json = curlGet(url);
        if (json.data && json.data.length > 0) allData = allData.concat(json.data);
        cursor = (json.meta || {}).next_cursor || null;
        if (!cursor) break;
    }
    return allData;
}

function fetchDivision(divisionId) {
    const leaguesJson = curlGet(`https://mc-api.dribl.com/api/list/leagues?season=${SEASON}&competition=${divisionId}&tenant=${TENANT}`);
    const leagues = leaguesJson.data || [];
    const fixtures = fetchAllPages('fixtures', divisionId);
    const results = fetchAllPages('results', divisionId);
    return { leagues, fixtures, results, fetchedAt: new Date().toISOString() };
}

function main() {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    for (const id of divisionIds) {
        process.stdout.write(`Fetching ${id}...`);
        try {
            const data = fetchDivision(id);
            fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(data));
            console.log(` ${data.leagues.length} leagues, ${data.fixtures.length} fixtures, ${data.results.length} results`);
        } catch (err) {
            console.error(` FAILED: ${err.message}`);
        }
    }

    // Build club → division index
    const clubIndex = {}; // clubName → [divisionId, ...]
    for (const id of divisionIds) {
        const dataPath = path.join(dataDir, `${id}.json`);
        if (!fs.existsSync(dataPath)) continue;
        const data = JSON.parse(fs.readFileSync(dataPath));
        const seen = new Set();
        [...(data.results || []), ...(data.fixtures || [])].forEach(item => {
            const a = item.attributes;
            [a.home_team_name, a.away_team_name].forEach(name => {
                if (!name) return;
                const club = name.replace(/\s+(U\d+|Seniors|Reserves)$/i, '').trim();
                if (!seen.has(club)) {
                    seen.add(club);
                    if (!clubIndex[club]) clubIndex[club] = [];
                    if (!clubIndex[club].includes(id)) clubIndex[club].push(id);
                }
            });
        });
    }
    fs.writeFileSync(path.join(dataDir, 'club-index.json'), JSON.stringify(clubIndex));
    console.log(`Club index: ${Object.keys(clubIndex).length} clubs`);

    fs.writeFileSync(
        path.join(dataDir, 'last-updated.json'),
        JSON.stringify({ updatedAt: new Date().toISOString() })
    );
    console.log('Done.');
}

main();
