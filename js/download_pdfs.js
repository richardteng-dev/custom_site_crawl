const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const sitemapFile = '../sitemap.txt';
const downloadDir = path.resolve(__dirname, '../pdf_downloads');

if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const urls = fs.readFileSync(sitemapFile, 'utf8').split('\n').filter(url => url.trim() !== '');

    for (const url of urls) {
        try {
            console.log(`Downloading: ${url}`);

            const fileName = path.basename(new URL(url).pathname);
            const filePath = path.join(downloadDir, fileName);

            if (fs.existsSync(filePath)) {
                console.log(`⚠️ Skipping ${fileName}, already exists.`);
                continue;
            }

            await downloadFile(url, filePath);
            console.log(`✅ Downloaded: ${fileName}`);
        } catch (error) {
            console.error(`❌ Error downloading ${url}: ${error.message}`);
        }
    }

    console.log(`✅ Completed! All PDFs downloaded to ${downloadDir}`);
    await browser.close();
})();

function downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(filePath);

        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(filePath, () => {}); // Delete file if download fails
                return reject(new Error(`Failed to download, status code: ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete file on error
            reject(err);
        });
    });
}
