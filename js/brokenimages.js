const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const sitemapFile = '../sitemap.txt';
const outputFile = '../broken_images_report.csv';
const IMAGE_TIMEOUT_MS = 10000;

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const urls = fs.readFileSync(sitemapFile, 'utf8').split('\n').filter(Boolean);

    // CSV header
    const brokenImages = [['Page URL', 'Image URL', 'Status/Error', 'Alt Text']];

    for (const url of urls) {
        try {
            console.log(`🔍 Checking page: ${url}`);
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });

            const images = await page.$$eval('img[src]', imgs =>
                imgs.map(img => ({
                    src: img.getAttribute('src'),
                    alt: img.getAttribute('alt') || '',
                }))
            );

            for (const { src, alt } of images) {
                const fullSrc = new URL(src, url).href;

                try {
                    const res = await fetch(fullSrc, { method: 'HEAD', timeout: IMAGE_TIMEOUT_MS });
                    if (!res.ok) {
                        console.warn(`❌ Broken image: ${fullSrc} (Status: ${res.status})`);
                        brokenImages.push([url, fullSrc, `Status: ${res.status}`, alt]);
                    }
                } catch (err) {
                    console.warn(`⚠️ Error loading image ${fullSrc} on ${url}: ${err.message}`);
                    brokenImages.push([url, fullSrc, `Error: ${err.message}`, alt]);
                }
            }
        } catch (err) {
            console.error(`🚫 Failed to process ${url}: ${err.message}`);
        }
    }

    // Convert to CSV
    const csvContent = brokenImages.map(row =>
        row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    fs.writeFileSync(outputFile, csvContent, 'utf8');

    console.log(`✅ Done. Found ${brokenImages.length - 1} broken images.`);
    console.log(`📄 CSV saved to: ${path.resolve(outputFile)}`);

    await browser.close();
})();
