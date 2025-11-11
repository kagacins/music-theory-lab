/**
 * Netlify Serverless Function for Google Custom Search API
 * This function hides the API key from the client-side code
 */

exports.handler = async (event, context) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Get query from query string
    const query = event.queryStringParameters?.query;
    if (!query) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Query parameter required' })
        };
    }

    // Get API credentials from environment variables
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !engineId) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'API credentials not configured' })
        };
    }

    // Build search query for chord progressions
    const searchQuery = `${query} chords site:ultimate-guitar.com OR site:chordify.net OR site:hooktheory.com`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(searchQuery)}&num=10`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Google Search API error: ${response.status}`);
        }
        
        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Allow CORS for client-side requests
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Search error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};

