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



    assert.equal((await fetch(base+'/chemistry/lab3d/investigation_models.mjs')).status,200);
    const analytics=[];page.on('response',r=>{if(r.url().includes('/api/analytics/flush'))analytics.push(r.status());});
    await page.evaluate(()=>{window.__pauseLab=true;});
    // Launch the NEW lab from its native catalogue card, not setupTask alone.
    if(await page.locator('#inspectorToggle').getAttribute('aria-expanded')!=='true')await page.locator('#inspectorToggle').click();
    await page.locator('#card .procedure-actions button').first().click();
    const card=page.locator('.labcard').filter({hasText:'K1-17 · Copper precipitate and acid recovery'});assert.equal(await card.count(),1);
    await card.locator('button.start').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.id),'k117-copper');
    await page.locator('#copper-baseline').click();assert.deepEqual(await page.evaluate(()=>window.__lab3d.TASK.copperEvidence),{});
    await page.evaluate(()=>{const l=window.__lab3d;l.setPPE('goggles');l.setPPE('gloves');window.doseCopper=(id,L,amount)=>{const v=l.vessels.find(v=>v.letter===L),b=l.bottles.find(b=>b.id===id),p=l.pipettes.find(p=>p.big);b.open=true;for(let left=amount;left>.0001;){const n=Math.min(10,left);l.pipTake(p,{kind:'bottle',b},n);l.pipGive(p,{kind:'vessel',v},n);left-=n;}l.doEq(v);for(let i=0;i<30;i++)l.updateVessel(v,.1,100+i*.1);};for(const v of l.vessels)v.g.position.copy(v.base);});
    // Incorrect setup: base in the control must fail, then reset/retry.
    await page.locator('#copper-baseline').click();await page.evaluate(()=>window.doseCopper('naoh','B',10));await page.locator('#copper-positive').click();assert.equal(await page.evaluate(()=>!!window.__lab3d.TASK.copperEvidence.positive),false);
    await page.locator('#reset').click();assert.deepEqual(await page.evaluate(()=>window.__lab3d.TASK.copperEvidence),{});assert.equal(await page.evaluate(()=>window.__lab3d.vessels.find(v=>v.letter==='B').chem.V),20);
    for(const lang of ['et','ru','uk','en']){await page.selectOption('#lang',lang);assert.ok((await page.locator('#card').textContent()).includes('K1-17'));assert.equal(await page.locator('#copper-baseline').count(),1);}
    // Answers alone cannot finish before the staged evidence exists.
    await page.locator('.ans select').nth(0).selectOption('precipCorrect');await page.locator('.ans select').nth(1).selectOption('acidCorrect');await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);
    await page.locator('#copper-baseline').click();await page.evaluate(()=>{window.doseCopper('water','B',10);window.doseCopper('naoh','A',10);});await page.locator('#copper-positive').click();
    const positive=await page.evaluate(()=>window.__lab3d.TASK.copperEvidence.positive);assert.ok(positive[0].precipitate>1.99);assert.ok(positive[1].precipitate<1e-7);assert.equal(positive[0].volume,positive[1].volume);
    await page.evaluate(()=>{window.doseCopper('water','B',12);window.doseCopper('hcl','A',12);});await page.locator('#copper-dissolved').click();
    const final=await page.evaluate(()=>window.__lab3d.TASK.copperEvidence.dissolved);assert.ok(final[0].precipitate<1e-7);assert.equal(final[0].volume,42);assert.equal(final[1].volume,42);assert.equal(final[0].copper+final[1].copper,4);
    await page.locator('.ans select').nth(0).selectOption('precipWrong');await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);
    await page.locator('.ans select').nth(0).selectOption('precipCorrect');await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),true);
    const copperDownload=page.waitForEvent('download');await page.locator('#report-json').click();const copperReport=JSON.parse(readFileSync(await(await copperDownload).path(),'utf8'));assert.deepEqual(copperReport.skillIds,['K1-17','K1-18']);assert.equal(copperReport.status,'complete');assert.equal(copperReport.observations.dissolved[0].copper,2);assert.equal(copperReport.path.length,4);
    await page.locator('.ans').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov27-copper-cycle.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.locator('.ans').scrollIntoViewIfNeeded();const answerBounds=await page.locator('.ans').boundingBox();assert.ok(answerBounds.x>=0&&answerBounds.x+answerBounds.width<=390);await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov27-copper-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
    await page.locator('#reset').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);assert.deepEqual(await page.evaluate(()=>window.__lab3d.TASK.copperEvidence),{});
    // K3-11 controls and retained repeat investigation.
    await page.evaluate(()=>{const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='k311'));l.HOOD.fan=true;});
    assert.equal(await page.locator('#startSolubilityRepeat').isDisabled(),true);
    await page.locator('#design-independent').selectOption('dose');await page.locator('#design-controls').selectOption('volumeOnly');await page.getByRole('button',{name:'Save experiment plan',exact:true}).click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.design),null);
    async function runSolubility(dose,prediction){
      await page.locator('#design-independent').selectOption('solvent');await page.locator('#design-controls').selectOption('volumeDoseTemperature');await page.getByRole('button',{name:'Save experiment plan',exact:true}).click();assert.equal(await page.locator('#design-independent').isDisabled(),true);
      await page.locator('#k311Hypothesis').selectOption(prediction);await page.locator('#k311Reason').fill('My prediction for this independently recorded trial.');await page.getByRole('button',{name:'Save prediction',exact:true}).click();await page.getByRole('button',{name:'Record solvent blanks',exact:true}).click();
      await page.evaluate(dose=>{const l=window.__lab3d;for(const L of ['A','B']){const v=l.vessels.find(v=>v.letter===L);v.g.position.copy(v.base);l.GR.push({x:v.g.position.x,y:0,z:v.g.position.z,vy:0,m:dose,s:.001,v});}l.updateGrains(.1);for(let i=0;i<100;i++)for(const v of l.vessels.filter(v=>!v.stowed))l.updateVessel(v,.1,300+i*.1);},dose);
      await page.getByRole('button',{name:'Record comparison',exact:true}).click();await page.locator('.ans select').selectOption('water');await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),true);
    }
    await runSolubility(.5,'hexane');await page.locator('#startSolubilityRepeat').click();
    assert.equal(await page.evaluate(()=>window.__lab3d.HOOD.fan),true);
    const archived=await page.evaluate(()=>JSON.stringify(window.__lab3d.TASK.trials));assert.ok(archived.includes('hexane'));assert.equal(await page.evaluate(()=>window.__lab3d.TASK.trials.length),1);assert.equal(await page.evaluate(()=>window.__lab3d.TASK.hypothesis),null);assert.equal(await page.locator('.trial-history tbody tr').count(),2);
    await runSolubility(.48,'water');assert.equal(await page.locator('.trial-history tbody tr').count(),4);assert.equal(await page.evaluate(()=>JSON.stringify(window.__lab3d.TASK.trials)),archived);
    const inventory=await page.evaluate(()=>JSON.stringify(window.__lab3d.vessels.map(v=>v.chem)));const dataDownload=page.waitForEvent('download');await page.locator('#report-json').click();const trialReport=JSON.parse(readFileSync(await(await dataDownload).path(),'utf8'));assert.deepEqual(trialReport.skillIds,['K3-11']);assert.equal(trialReport.retainedTrials.length,1);assert.equal(trialReport.retainedTrials[0].measurements[0].dose,.5);assert.equal(trialReport.currentTrial.measurements[0].dose,.48);const markdownDownload=page.waitForEvent('download');await page.locator('#report-md').click();const markdown=readFileSync(await(await markdownDownload).path(),'utf8');assert.ok(markdown.includes('K3-11')&&markdown.includes('0.48')&&markdown.includes('Trial 2'));assert.equal(await page.evaluate(()=>JSON.stringify(window.__lab3d.vessels.map(v=>v.chem))),inventory);
    const times=await page.evaluate(()=>window.__lab3d.NB.log.map(e=>e.t));assert.ok(times.every((t,i)=>i===0||t>=times[i-1]));
    for(const lang of ['et','ru','uk','en']){await page.selectOption('#lang',lang);assert.equal(await page.locator('.trial-history tbody tr').count(),4);}
    await page.setViewportSize({width:390,height:844});await page.locator('.trial-history').scrollIntoViewIfNeeded();const bounds=await page.locator('.trial-scroll').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);assert.equal(await page.locator('.trial-history tbody tr').count(),4);await page.locator('.trial-scroll').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.trial-scroll').scrollLeft>0,null,{polling:50});await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov27-repeats-mobile.png'),fullPage:true});
    await page.locator('#reset').click();assert.deepEqual(await page.evaluate(()=>window.__lab3d.TASK.trials),[]);assert.equal(await page.locator('.trial-history').count(),0);
    assert.deepEqual(errors,[]);assert.ok(analytics.every(s=>s===204));console.log(JSON.stringify({positive,final,repeatRows:4,analytics,errors},null,2));
  } finally {if(browser)await browser.close();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
