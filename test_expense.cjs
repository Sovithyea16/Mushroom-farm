const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('payload')) console.log('CONSOLE:', msg.text());
  });
  
  // Intercept network requests to see the payload
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().includes('script.google.com')) {
      const postData = req.postData();
      if (postData) {
        const data = JSON.parse(postData);
        console.log('--- PAYLOAD TO GOOGLE SHEETS ---');
        console.log('Expenses:', data.expenses.slice(0, 1));
        console.log('Number of expenses:', data.expenses.length);
      }
      req.continue();
    } else {
      req.continue();
    }
  });

  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 1000));
  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', '1234');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 1000));
  
  // click Expenses (4th button usually in DataPanel, wait no, sidebar)
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.side-nav button');
    const b = Array.from(btns).find(b => b.textContent.includes('?????'));
    if (b) b.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  // click add expense
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('???????????'));
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  // fill form
  await page.evaluate(() => {
    const amtInput = document.querySelector('input[type="number"]');
    if (amtInput) {
       amtInput.value = '500';
       amtInput.dispatchEvent(new Event('input'));
    }
    const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('????????'));
    if (saveBtn) saveBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 3000)); // wait for network
  
  await browser.close();
})();
