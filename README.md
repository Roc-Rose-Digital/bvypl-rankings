# VPL Rankings 2026

A web application displaying Football Victoria Junior Boys Competition data for the 2026 season.

## Features

- **Combined Club Ladder**: Aggregated standings across all age groups
- **Age Group Ladders**: Individual standings for U13, U14, U15, U16, and U18
- **Fixtures**: Upcoming matches with venue and time details
- **Results**: Completed matches with scores
- **Multi-Division Support**: YPL1, YPL2, BVYSL North-West, and BVYSL South-East
- **Real-time Data**: Refresh button to fetch latest data from the API

## Divisions

- **Boys Victorian Youth Premier League 1** (YPL1)
- **Boys Victorian Youth Premier League 2** (YPL2)
- **Boys Victorian Youth State League North-West**
- **Boys Victorian Youth State League South-East**

## Technology

- Pure HTML, CSS (TailwindCSS), and JavaScript
- Client-side data fetching from Dribl API
- No backend required

## Data Source

Data from Dribl API - Data from Football Victoria API | 2026 Season

## Usage

Simply open `index.html` in a web browser or host on any static web server (GitHub Pages, Netlify, etc.).

### GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to Settings → Pages
3. Select your branch (usually `main`)
4. Click Save
5. Your site will be available at `https://yourusername.github.io/vpl-rankings/`

**Note**: The app fetches data directly from the Football Victoria API. If you encounter CORS issues when hosted, the API may need to whitelist your domain.

## Development

No build process required. All files are static and can be edited directly.

## License

This project displays public data from Football Victoria.
