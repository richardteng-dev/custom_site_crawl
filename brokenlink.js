const puppeteer = require('puppeteer');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { URL } = require('url');

const sitemapFile = 'sitemap.txt';
const selector = '#unit-content';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const urls = fs.readFileSync(sitemapFile, 'utf8').split('\n').filter(url => url.trim() !== '');

    let brokenLinks = [];

    for (const pageUrl of urls) {
        try {
            console.log(`🔍 Checking page: ${pageUrl}`);
            await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });

            const links = await page.$$eval(`${selector} a[href]`, (anchors) =>
                anchors.map(a => a.getAttribute('href')).filter(href => href && !href.startsWith('mailto:') && !href.startsWith('tel:'))
            );

            for (let href of links) {
                // Convert relative to absolute
                const link = new URL(href, pageUrl).href;

                try {
                    const response = await fetch(link, { method: 'HEAD' });
                    if (response.status === 404) {
                        console.log(`❌ 404 link found on ${pageUrl}: ${link}`);
                        brokenLinks.push(`Page: ${pageUrl} | Broken link: ${link}`);
                    }
                } catch (err) {
                    console.error(`⚠️ Error checking link ${link} on ${pageUrl}: ${err.message}`);
                    brokenLinks.push(`Page: ${pageUrl} | Broken link: ${link} (Fetch error)`);
                }
            }
        } catch (err) {
            console.error(`🚫 Failed to process ${pageUrl}: ${err.message}`);
        }
    }

    fs.writeFileSync('broken_links_report.txt', brokenLinks.join('\n'), 'utf8');

    console.log(`✅ Done! Found ${brokenLinks.length} broken links. Report saved to broken_links_report.txt`);

    await browser.close();
})();
