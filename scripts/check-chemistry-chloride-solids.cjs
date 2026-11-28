const { readFileSync } = require('node:fs');
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




    assert.equal((await fetch(base+'/chemistry/lab3d/investigation_reports.mjs')).status,200);
    await page.evaluate(()=>{window.__pauseLab=true;});await page.locator('#inspectorToggle').click();await page.locator('#card .procedure-actions button').first().click();
    const leaf=page.locator('[data-lab-id="k117-chloride"]');assert.equal(await leaf.count(),1);const pathValues=await leaf.evaluate(e=>{const a=[];for(let n=e.parentElement;n;n=n.parentElement)if(n.matches('.labtree-node'))a.unshift(n.dataset.treeValue);return a;});assert.deepEqual(pathValues,['high','general','ionreactions']);await leaf.locator('button.start').click();
    await page.evaluate(()=>{const l=window.__lab3d;l.setPPE('goggles');l.setPPE('gloves');for(const v of l.vessels){v.g.position.copy(v.base);v.g.updateMatrixWorld();for(let i=0;i<20;i++)l.updateVessel(v,.1,100+i*.1);}
      window.doseSilver=(letters)=>{const d=l.droppers.find(d=>d.id==='agno3');if(!d)throw Error('missing native dropper');for(const L of letters){const v=l.vessels.find(v=>v.letter===L);d.parked=v;d.g.position.set(v.g.position.x,v.g.position.y+v.H+.025,v.g.position.z);for(let i=0;i<4;i++)d.tap();for(let i=0;i<10;i++)l.updateDrops(.05,200+i*.05);l.doEq(v);for(let i=0;i<30;i++)l.updateVessel(v,.1,300+i*.1);}d.parked=null;};});
    await page.locator('#sampleSelect').selectOption('A');assert.ok((await page.locator('#sampleReport').textContent()).includes('identities are hidden'));assert.ok(!(await page.locator('#sampleReport').textContent()).includes('Na:'));
    for(const lang of ['et','ru','uk','en']){await page.selectOption('#lang',lang);assert.equal(await page.locator('#chloride-baseline').count(),1);assert.ok((await page.locator('#card').textContent()).includes('K1-17'));}
    await page.locator('#chloride-baseline').click();await page.evaluate(()=>window.doseSilver(['A','B','C']));await page.locator('#chloride-tested').click();assert.equal(await page.evaluate(()=>!!window.__lab3d.TASK.chlorideEvidence.tested),false);
    await page.locator('#reset').click();assert.deepEqual(await page.evaluate(()=>window.__lab3d.TASK.chlorideEvidence),{});await page.evaluate(()=>{const l=window.__lab3d;for(const v of l.vessels){v.g.position.copy(v.base);for(let i=0;i<20;i++)l.updateVessel(v,.1,500+i*.1);}});
    await page.locator('.ans select').nth(0).selectOption('chloride');await page.locator('.ans select').nth(1).selectOption('nitrate');await page.locator('.ans select').nth(2).selectOption('agclCorrect');await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);
    await page.locator('#chloride-baseline').click();await page.evaluate(()=>window.doseSilver(['A','B','C','D']));await page.locator('#chloride-tested').click();
    const observed=await page.evaluate(()=>window.__lab3d.TASK.chlorideEvidence.tested);assert.equal(observed.length,4);assert.ok(observed.find(x=>x.vessel==='C').precipitate>.019);assert.equal(observed.find(x=>x.vessel==='D').precipitate,0);assert.ok(observed.every(x=>Math.abs(x.volume-20.2)<1e-8));
    const answers=Object.fromEntries(observed.filter(x=>['A','B'].includes(x.vessel)).map(x=>[x.vessel,x.appearance==='precipitate'?'chloride':'nitrate']));await page.locator('.ans select').nth(0).selectOption(answers.A==='chloride'?'nitrate':'chloride');await page.locator('.ans select').nth(1).selectOption(answers.B);await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);await page.locator('.ans select').nth(0).selectOption(answers.A);await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),true);
    await page.locator('#sampleSelect').selectOption('A');assert.ok((await page.locator('#sampleReport').textContent()).includes('Na:'));
    await page.locator('.ans').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov28-chloride.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.locator('.ans').scrollIntoViewIfNeeded();const b=await page.locator('.ans').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390);await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov28-chloride-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.locator('#reset').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);assert.deepEqual(await page.evaluate(()=>window.__lab3d.TASK.chlorideEvidence),{});
    const accounting=await page.evaluate(()=>{
      const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='free'));for(const L of ['A','B'])l.takeItem(l.ITEMS.find(x=>x.key==='beaker:'+L));
      const a=l.vessels.find(v=>v.letter==='A'),b=l.vessels.find(v=>v.letter==='B');a.g.position.set(-.25,0,.15);b.g.position.set(.15,0,.15);a.solid=3;b.chem.V=10;a.tilt=110;b.tilt=0;a.held=true;a.g.quaternion.identity();b.g.quaternion.identity();a.g.updateMatrixWorld();b.g.updateMatrixWorld();l.ptr.set(-.1,0,.15);if(l.findTarget(a)?.kind!=='bench')throw Error('native dry-NaCl bench target missing');
      const states=[],record=()=>{const s=l.saltInventory([a,b],l.GR,l.solidSpills,l.solidWaste);if(Math.abs(s.total-3)>1e-8)throw Error('salt mass changed '+JSON.stringify(s));states.push(s);};record();
      a.spout.set(.15,.15,.15);l.GRAVITY_SOLIDS.update(a,{kind:'vessel',v:b},.1);record();l.updateGrains(.2);record();const first=b.solid;
      l.GRAVITY_SOLIDS.update(a,{kind:'vessel',v:b},.1);b.g.position.x=.4;l.updateGrains(.2);if(b.solid!==first)throw Error('moving receiver captured missed grains');record();
      a.spout.set(-.1,.15,.15);l.GRAVITY_SOLIDS.update(a,{kind:'bench'},.1);l.updateGrains(.2);record();a.spout.set(.55,.15,0);l.GRAVITY_SOLIDS.update(a,{kind:'sink'},10);l.updateGrains(.2);record();l.dissolveSalt(b,100);record();l.updateBenchStatus();l.renderer.render(l.scene,l.camera);window.saltPair={a,b};return {states,bench:l.solidSpills.reduce((n,s)=>n+s.mass,0),sink:l.solidWaste.sink};
    });assert.ok(accounting.bench>0&&accounting.sink>0);await page.getByRole('button',{name:'Collect spilled NaCl',exact:true}).click();const after=await page.evaluate(()=>{const l=window.__lab3d;return l.saltInventory([window.saltPair.a,window.saltPair.b],l.GR,l.solidSpills,l.solidWaste);});assert.equal(after.bench,0);assert.ok(after.collected>0);assert.ok(Math.abs(after.total-3)<1e-8);await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov28-solid-ledger.png'),fullPage:true});await page.locator('#reset').click();assert.equal(await page.evaluate(()=>window.__lab3d.solidSpills.length+window.__lab3d.solidWaste.collected+window.__lab3d.solidWaste.sink),0);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({observed,accounting,after,errors},null,2));
  }finally{if(browser)await browser.close();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
