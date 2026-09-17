import {chromium} from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://localhost:3000');
  await page.getByLabel('Tuoteryhmä').selectOption('Housut');
  await page.locator('.product-card').first().click();
  await page.waitForFunction(() => document.querySelector('.export-area .primary:not(:disabled)'));
  await page.locator('input[type=file]').first().setInputFiles({name:'NORTH.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="150" y="75" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="70" fill="white">NORTH</text></svg>')});
  await page.getByRole('toolbar',{name:'Valitun logon pikatoiminnot'}).waitFor();
  await page.locator('.toast button').click();
  await page.screenshot({path:'test-results/expanded-catalog.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/expanded-mobile.png',fullPage:true});
  const catalog=await (await page.request.get('http://localhost:3000/api/products')).json();
  console.log(JSON.stringify({availableProducts:catalog.length,categories:[...new Set(catalog.map(p=>p.category))]}));
} finally {await browser.close();}
