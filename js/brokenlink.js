const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { URL } = require('url');

const sitemapFile = '../sitemap.txt';
const selector = '#unit-content';
const outputFile = '../broken_links_report.csv';
const failedPagesFile = '../failed_pages.txt';

const HEAD_TIMEOUT_MS = 8000;
const PAGE_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
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

    const brokenLinks = [['Page URL', 'Link Text', 'Broken Link']];
    const failedPages = [];

    for (let i = 0; i < urls.length; i++) {
        const pageUrl = urls[i];
        console.log(`(${i + 1}/${urls.length}) 🔍 Checking page: ${pageUrl}`);

        try {
            await Promise.race([
                page.goto(pageUrl, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Page load timeout')), PAGE_TIMEOUT_MS + 2000)
                )
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
                        console.log(`❌ 404 on ${pageUrl}: ${linkUrl} (text: "${text}")`);
                        brokenLinks.push([pageUrl, text, linkUrl]);
                    }
                } catch (err) {
                    console.warn(`⚠️ Error checking ${linkUrl} on ${pageUrl}: ${err.message}`);
                    brokenLinks.push([pageUrl, text, linkUrl]);
                }
            }
        } catch (err) {
            console.error(`🚫 Failed to process ${pageUrl}: ${err.message}`);
            failedPages.push(pageUrl);
        }
    }

    // Write CSV file
    const csvContent = brokenLinks.map(row =>
        row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    fs.writeFileSync(outputFile, csvContent, 'utf8');
    fs.writeFileSync(failedPagesFile, failedPages.join('\n'), 'utf8');

    console.log(`✅ Done! ${brokenLinks.length - 1} broken links saved to ${outputFile}`);
    console.log(`❗ ${failedPages.length} failed pages saved to ${failedPagesFile}`);

    await browser.close();
})();
