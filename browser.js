const puppeteer = require('puppeteer');
const { VIEWPORT } = require('./config');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/122.0.0.0 Safari/537.36';

async function setupPage(page) {
  await page.setViewport(VIEWPORT);
  await page.setUserAgent(USER_AGENT);
}

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  await setupPage(page);

  return { browser, page };
}

module.exports = { launchBrowser, setupPage };
