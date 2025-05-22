const fs = require('fs');
const path = require('path');

const inputFile = '../broken_links_report.txt';
const outputFile = '../broken_links_report.csv';

const lines = fs.readFileSync(inputFile, 'utf8').split('\n').filter(Boolean);

// CSV header
const rows = [['Page URL', 'Link Text', 'Broken Link']];

for (const line of lines) {
  // Match pattern: Page: [URL] | Link text: [text] | Broken link: [URL]
  const match = line.match(/Page:\s*(.+?)\s*\|\s*Link text:\s*(.*?)\s*\|\s*Broken link:\s*(.+?)(?:\s*\(|$)/);
  if (match) {
    const [, pageUrl, linkText, brokenLink] = match;
    rows.push([pageUrl.trim(), linkText.trim(), brokenLink.trim()]);
  }
}

// Convert to CSV format
const csvContent = rows.map(row =>
  row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
).join('\n');

// Save the CSV file
fs.writeFileSync(outputFile, csvContent, 'utf8');

console.log(`✅ CSV saved to ${path.resolve(outputFile)}`);
