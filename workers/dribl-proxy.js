export default {
    async fetch(request) {
        const url = new URL(request.url);
        const target = 'https://mc-api.dribl.com' + url.pathname + url.search;

        const response = await fetch(target, {
            headers: {
                'Referer': 'https://fv.dribl.com/',
                'Origin': 'https://fv.dribl.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-AU,en-GB;q=0.9,en;q=0.8',
            },
        });

        const body = await response.arrayBuffer();
        return new Response(body, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    },
};
