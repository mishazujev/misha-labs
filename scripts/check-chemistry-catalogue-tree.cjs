const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
(async () => {
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.mjs'], { cwd: path.resolve(__dirname, '../.deploy'), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', LAB_DATA_DIR: mkdtempSync(path.join(tmpdir(), 'chem-nov22-')) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(Error('server timeout')), 10000); child.stdout.on('data', data => { if (String(data).includes('running')) { clearTimeout(timeout); resolve(); } }); child.once('exit', code => reject(Error('server exited ' + code))); });
    const base = `http://127.0.0.1:${port}`;
    const moduleResponse = await fetch(base + '/chemistry/lab3d/sample_transfer.mjs');
    assert.equal(moduleResponse.status, 200); assert.match(moduleResponse.headers.get('content-type'), /javascript/);
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { const schedule = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => schedule(t => { if (!window.__pauseLab) cb(t); }); });
    await page.goto(base + '/chemistry/lab3d/lab3d.html');
    await page.waitForFunction(() => !!window.__lab3d, null, { timeout: 60000 });
    await page.selectOption('#lang', 'en');



    await page.evaluate(()=>{window.__pauseLab=true;});
    await page.locator('#inspectorToggle').click();await page.locator('#card .procedure-actions button').first().click();
    const copper=page.locator('[data-lab-id="k117-copper"]'),salt=page.locator('[data-lab-id="k311"]');
    const paths=await page.locator('.labcard').evaluateAll(cards=>cards.map(card=>({id:card.dataset.labId,path:[...function*(node){for(let n=node.parentElement;n;n=n.parentElement)if(n.matches('.labtree-node'))yield n.dataset.treeKind+':'+n.dataset.treeValue;}(card)].reverse()})));
    assert.equal(new Set(paths.map(x=>x.id)).size,paths.length);assert.ok(paths.every(x=>x.path.length===3));assert.deepEqual(paths.find(x=>x.id==='k117-copper').path,['level:high','course:general','topic:ionreactions']);assert.deepEqual(paths.find(x=>x.id==='k311').path,['level:high','course:organic','topic:solubility']);
    const topic=copper.locator('xpath=ancestor::details[1]');await topic.locator(':scope > summary').click();assert.equal(await copper.isVisible(),false);await topic.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.equal(await copper.isVisible(),true);
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-catalogue-tree.png'),fullPage:true});
    await copper.locator('button.start').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.id),'k117-copper');
    for(const lang of ['et','ru','uk','en']){await page.selectOption('#lang',lang);await page.locator('#card .procedure-actions button').first().click();assert.equal(await page.locator('[data-lab-id="k117-copper"]').count(),1);assert.equal(await page.locator('[data-lab-id="k311"]').count(),1);assert.ok((await page.locator('[data-tree-value="solubility"] > summary').textContent()).length>3);await page.locator('#picker .invx').click();}
    await page.locator('#card .procedure-actions button').first().click();await page.setViewportSize({width:390,height:844});await salt.scrollIntoViewIfNeeded();const b=await salt.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390);await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-catalogue-tree-mobile.png'),fullPage:true});await salt.locator('button.start').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.id),'k311');assert.deepEqual(errors,[]);console.log('PASS every catalogue leaf has level/course/topic ancestors; native copper and solubility launches; keyboard collapse/expand; four languages; mobile bounds');
  }finally{if(browser)await browser.close();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
