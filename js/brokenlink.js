const puppeteer = require('puppeteer');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { URL } = require('url');

const sitemapFile = '../sitemap.txt';
const selector = '#unit-content';

const HEAD_TIMEOUT_MS = 8000; // 8s per link check
const PAGE_TIMEOUT_MS = 30000; // 30s per page load

// Fetch with timeout
async function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
        });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const urls = fs.readFileSync(sitemapFile, 'utf8').split('\n').filter(Boolean);
    const page = await browser.newPage();

    let brokenLinks = [];
    let failedPages = [];

    for (let i = 0; i < urls.length; i++) {
        const pageUrl = urls[i];
        console.log(`(${i + 1}/${urls.length}) 🔍 Checking page: ${pageUrl}`);

        try {
            await Promise.race([
                page.goto(pageUrl, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Page load timeout')), PAGE_TIMEOUT_MS + 2000))
            ]);

            const links = await page.$$eval(`${selector} a[href]`, (anchors) =>
                anchors
                    .map(a => ({
                        href: a.getAttribute('href'),
                        text: a.textContent.trim()
                    }))
                    .filter(link =>
                        link.href &&
                        !link.href.startsWith('mailto:') &&
                        !link.href.startsWith('tel:') &&
                        !link.href.startsWith('/events-filtered')
                    )
            );
            
            
            for (const { href, text } of links) {
                const linkUrl = new URL(href, pageUrl).href;
            
                try {
                    const res = await fetchWithTimeout(linkUrl, HEAD_TIMEOUT_MS);
                    if (res.status === 404) {
                        console.log(`❌ 404 link on ${pageUrl}: ${linkUrl} (text: "${text}")`);
                        brokenLinks.push(`Page: ${pageUrl} | Link text: ${text} | Broken link: ${linkUrl}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Error checking ${linkUrl} on ${pageUrl}: ${err.message}`);
                    brokenLinks.push(`Page: ${pageUrl} | Link text: ${text} | Broken link: ${linkUrl} (Fetch error)`);
                }
            }
            
        } catch (err) {
            console.error(`🚫 Failed to process ${pageUrl}: ${err.message}`);
            failedPages.push(pageUrl);
        }
    }

    fs.writeFileSync('../broken_links_report.txt', brokenLinks.join('\n'), 'utf8');
    fs.writeFileSync('../failed_pages.txt', failedPages.join('\n'), 'utf8');

    console.log(`✅ Done! Found ${brokenLinks.length} broken links.`);
    console.log(`❗ Skipped ${failedPages.length} failed pages. See failed_pages.txt.`);

    await browser.close();
})();
