import puppeteer from 'puppeteer-core';
import path from 'path';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: { width: 1300, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });

  // Wait a moment for animations
  await new Promise(r => setTimeout(r, 2000));

  // Find the histology fact element
  const element = await page.$('.home-histology-fact');
  if (element) {
    await element.screenshot({ path: path.resolve('bone_fact_screenshot.png') });
    console.log('Fact screenshot captured!');
  } else {
    await page.screenshot({ path: path.resolve('full_screenshot.png'), fullPage: true });
    console.log('Full page screenshot captured!');
  }

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
