const puppeteer = require('puppeteer');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const sitemapFile = '../sitemap.txt';
const IMAGE_TIMEOUT_MS = 10000;

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const urls = fs.readFileSync(sitemapFile, 'utf8').split('\n').filter(Boolean);

    const brokenImages = [];

    for (const url of urls) {
        try {
            console.log(`🔍 Checking page: ${url}`);
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });

            // Extract all image src attributes from the page
            const images = await page.$$eval('img[src]', imgs =>
                imgs.map(img => ({
                    src: img.getAttribute('src'),
                    alt: img.getAttribute('alt') || '',
                }))
            );

            for (const { src, alt } of images) {
                // Convert relative URLs to absolute ones
                const fullSrc = new URL(src, url).href;

                try {
                    const res = await fetch(fullSrc, { method: 'HEAD', timeout: IMAGE_TIMEOUT_MS });
                    if (!res.ok) {
                        console.warn(`❌ Broken image: ${fullSrc} (Status: ${res.status})`);
                        brokenImages.push(`Page: ${url} | Image: ${fullSrc} | Status: ${res.status} | Alt: ${alt}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Error loading image ${fullSrc} on ${url}: ${err.message}`);
                    brokenImages.push(`Page: ${url} | Image: ${fullSrc} | Error: ${err.message} | Alt: ${alt}`);
                }
            }
        } catch (err) {
            console.error(`🚫 Failed to process ${url}: ${err.message}`);
        }
    }

    fs.writeFileSync('broken_images_report.txt', brokenImages.join('\n'), 'utf8');

    console.log(`✅ Done. Found ${brokenImages.length} broken images.`);
    console.log(`📄 Saved to broken_images_report.txt`);

    await browser.close();
})();
