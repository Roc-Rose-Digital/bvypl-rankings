$leagues = @{
    'U13' = '6lNb5eGymx'
    'U14' = 'bgdMnW1bmE'
    'U15' = 'Bjma89RGdR'
    'U16' = '3pmvkn5ENv'
    'U18' = 'AnmY0vMDdz'
}

$baseParams = 'date_range=default&season=nPmrj2rmow&competition=bgdMX6MDKE&tenant=w8zdBWPmBX&timezone=Australia/Sydney'

$allFixtures = @()
$allResults = @()

foreach ($age in $leagues.Keys) {
    $leagueId = $leagues[$age]
    
    Write-Host "Fetching $age fixtures..."
    $fixturesUrl = "https://mc-api.dribl.com/api/fixtures?$baseParams&league=$leagueId"
    $fixturesData = Invoke-RestMethod -Uri $fixturesUrl -Method Get
    $allFixtures += $fixturesData.data
    
    Write-Host "Fetching $age results..."
    $resultsUrl = "https://mc-api.dribl.com/api/results?$baseParams&league=$leagueId"
    $resultsData = Invoke-RestMethod -Uri $resultsUrl -Method Get
    $allResults += $resultsData.data
}

Write-Host "`nTotal fixtures: $($allFixtures.Count)"
Write-Host "Total results: $($allResults.Count)"

# Save to files
$fixturesJson = @{ data = $allFixtures } | ConvertTo-Json -Depth 10
$resultsJson = @{ data = $allResults } | ConvertTo-Json -Depth 10

$fixturesJson | Out-File -FilePath "api-responses\fixtures-api.json" -Encoding UTF8
$resultsJson | Out-File -FilePath "api-responses\results-api.json" -Encoding UTF8

Write-Host "`nFiles saved successfully!"
Write-Host "- api-responses\fixtures-api.json"
Write-Host "- api-responses\results-api.json"
