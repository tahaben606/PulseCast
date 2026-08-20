const https = require('https');

async function testSpotifyScrape() {
  const url = 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M';
  const html = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }).then(r => r.text());

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
  if (nextDataMatch) {
    const data = JSON.parse(nextDataMatch[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    console.log('Entity Name:', entity?.name);
    console.log('Entity Type:', entity?.type);
    const trackList = entity?.trackList || [];
    console.log('Total tracks found:', trackList.length);
    if (trackList.length > 0) {
      console.log('First track:', trackList[0]);
    }
  } else {
    // Check for initial-state or other script tags
    console.log('__NEXT_DATA__ not found. Checking other script tags...');
    const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    console.log('Total script tags:', scripts?.length);
  }
}

testSpotifyScrape().catch(console.error);
