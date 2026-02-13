const https = require('https');
const fs = require('fs');

const leagues = {
    'U13': '6lNb5eGymx',
    'U14': 'bgdMnW1bmE',
    'U15': 'Bjma89RGdR',
    'U16': '3pmvkn5ENv',
    'U18': 'AnmY0vMDdz'
};

const baseParams = 'date_range=default&season=nPmrj2rmow&competition=bgdMX6MDKE&tenant=w8zdBWPmBX&timezone=Australia/Sydney';

let allFixtures = [];
let allResults = [];
let fixturesCompleted = 0;
let resultsCompleted = 0;

function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function fetchAllData() {
    console.log('Fetching fixtures for all age groups...');
    
    for (const [age, leagueId] of Object.entries(leagues)) {
        console.log(`Fetching ${age} fixtures...`);
        const fixturesUrl = `https://mc-api.dribl.com/api/fixtures?${baseParams}&league=${leagueId}`;
        const fixturesData = await fetchData(fixturesUrl);
        allFixtures = allFixtures.concat(fixturesData.data || []);
        
        console.log(`Fetching ${age} results...`);
        const resultsUrl = `https://mc-api.dribl.com/api/results?${baseParams}&league=${leagueId}`;
        const resultsData = await fetchData(resultsUrl);
        allResults = allResults.concat(resultsData.data || []);
    }
    
    console.log(`\nTotal fixtures: ${allFixtures.length}`);
    console.log(`Total results: ${allResults.length}`);
    
    // Save to files
    fs.writeFileSync('api-responses/fixtures-api.json', JSON.stringify({ data: allFixtures }, null, 2));
    fs.writeFileSync('api-responses/results-api.json', JSON.stringify({ data: allResults }, null, 2));
    
    console.log('\nFiles saved successfully!');
    console.log('- api-responses/fixtures-api.json');
    console.log('- api-responses/results-api.json');
}

fetchAllData().catch(console.error);
