const fs = require('fs');
const path = require('path');
const readline = require('readline');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const inputFile = '../broken_links_report.csv';
const stillBrokenFile = '../still_broken_links.csv';
const nowWorkingFile = '../now_working_links.csv';

const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

(async () => {
  const rl = readline.createInterface({
    input: fs.createReadStream(inputFile),
    crlfDelay: Infinity,
  });

  const stillBroken = [['Page URL', 'Link Text', 'Broken Link']];
  const nowWorking = [['Page URL', 'Link Text', 'Broken Link']];

  let lineIndex = 0;
  for await (const line of rl) {
    lineIndex++;
    if (lineIndex === 1) continue; // Skip header

    const [pageUrl, linkText, brokenUrl] = line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim());
    if (!brokenUrl) continue;

    console.log(`🔍 Rechecking: ${brokenUrl}`);

    try {
      const res = await fetchWithTimeout(brokenUrl, TIMEOUT_MS);
      if (res.status === 404) {
        console.log(`❌ Still broken: ${brokenUrl}`);
        stillBroken.push([pageUrl, linkText, brokenUrl]);
      } else {
        console.log(`✅ Now working: ${brokenUrl}`);
        nowWorking.push([pageUrl, linkText, brokenUrl]);
      }
    } catch (err) {
      console.warn(`⚠️ Error checking ${brokenUrl}: ${err.message}`);
      stillBroken.push([pageUrl, linkText, brokenUrl]);
    }
  }

  const toCSV = rows => rows.map(row =>
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  fs.writeFileSync(stillBrokenFile, toCSV(stillBroken), 'utf8');
  fs.writeFileSync(nowWorkingFile, toCSV(nowWorking), 'utf8');

  console.log(`\n✅ Done. Still broken: ${stillBroken.length - 1}, Now working: ${nowWorking.length - 1}`);
  console.log(`📄 Saved: ${stillBrokenFile}, ${nowWorkingFile}`);
})();
