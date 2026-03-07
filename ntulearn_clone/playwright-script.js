const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080/study.html', { waitUntil: 'load' });
  const btn = await page.$('.ns-add-widget-btn');
  console.log('Button found?', !!btn);
  if (btn) {
    const box = await btn.boundingBox();
    console.log('Button BBox:', box);
    const visible = await btn.isVisible();
    console.log('Button visible?', visible);
  }
  const viewCoursesBox = await page.$eval('#view-courses', el => {
      const b = el.getBoundingClientRect();
      return b.width + 'x' + b.height;
  });
  console.log('view-courses size:', viewCoursesBox);
  
  await browser.close();
})();
