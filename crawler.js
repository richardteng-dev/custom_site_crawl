const puppeteer = require('puppeteer');
const fs = require('fs');

const sitemapFile = 'sitemap.txt'; 
const errorIconSelector = 'img[src="/core/misc/icons/e32700/error.svg"]';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const urls = fs.readFileSync(sitemapFile, 'utf8').split('\n').filter(url => url.trim() !== '');

    let brokenImagePages = [];

    for (const url of urls) {
        try {
            console.log(`Checking: ${url}`);
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });

            // Check if the error icon exists
            const errorIconExists = await page.$(errorIconSelector);
            
            if (errorIconExists) {
                console.log(`❌ Broken image found on: ${url}`);
                brokenImagePages.push(url);
            } else {
                console.log(`✅ No broken images on: ${url}`);
            }
        } catch (error) {
            console.error(`Error visiting ${url}: ${error.message}`);
        }
    }

    // Save results
    fs.writeFileSync('broken_images_pages.txt', brokenImagePages.join('\n'), 'utf8');

    console.log(`✅ Completed! Found ${brokenImagePages.length} pages with broken images.`);
    console.log(`Results saved in broken_images_pages.txt`);

    await browser.close();
})();
