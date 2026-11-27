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



    await page.evaluate(()=>{window.__pauseLab=true;const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='k311'));l.setPPE('goggles');l.HOOD.fan=true;});
    if(await page.locator('#inspectorToggle').getAttribute('aria-expanded')!=='true')await page.locator('#inspectorToggle').click();
    assert.equal(await page.locator('.hydration').count(),0);
    await page.locator('#design-independent').selectOption('solvent');await page.locator('#design-controls').selectOption('volumeDoseTemperature');await page.getByRole('button',{name:'Save experiment plan',exact:true}).click();
    await page.locator('#k311Hypothesis').selectOption('hexane');await page.locator('#k311Reason').fill('I think hexane may be the better solvent.');
    await page.getByRole('button',{name:'Save prediction',exact:true}).click();
    const stored=await page.evaluate(()=>JSON.stringify(window.__lab3d.TASK.hypothesis));assert.ok(stored.includes('hexane'));
    assert.equal(await page.locator('#k311Reason').isDisabled(),true);
    for(const lang of ['et','ru','uk','en']){await page.selectOption('#lang',lang);assert.equal(await page.locator('#k311Hypothesis').inputValue(),'hexane');assert.equal(await page.evaluate(()=>JSON.stringify(window.__lab3d.TASK.hypothesis)),stored);}
    await page.getByRole('button',{name:'Record solvent blanks',exact:true}).click();
    await page.evaluate(()=>{const l=window.__lab3d;for(const L of ['A','B']){const v=l.vessels.find(q=>q.letter===L);l.GR.push({x:v.g.position.x,y:0,z:v.g.position.z,vy:0,m:.5,s:.001,v});}l.updateGrains(.1);for(let i=0;i<100;i++)for(const v of l.vessels.filter(q=>!q.stowed))l.updateVessel(v,.1,100+i*.1);});
    await page.getByRole('button',{name:'Record comparison',exact:true}).click();
    assert.ok((await page.locator('.hydration').textContent()).includes('differs from your prediction'));
    const baseline=await page.evaluate(()=>JSON.stringify(window.__lab3d.vessels.map(v=>v.chem)));
    for(const lang of ['et','ru','uk','en']){
      await page.selectOption('#lang',lang);
      for(const view of ['water','hexane','hbond']){await page.locator('#hydration-'+view).click();assert.equal(await page.locator('#hydration-'+view).getAttribute('aria-pressed'),'true');assert.ok((await page.locator('.hydration svg').getAttribute('aria-label')).length>20);}
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__lab3d.vessels.map(v=>v.chem))),baseline);
    await page.locator('#hydration-water').click();await page.locator('.hydration').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov26-hydration.png'),fullPage:true});
    await page.locator('#hydration-hbond').click();await page.locator('.hydration svg').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov26-hbond.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.locator('#hydration-hexane').click();await page.locator('.hydration svg').scrollIntoViewIfNeeded();
    const bounds=await page.locator('.hydration svg').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov26-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>{const l=window.__lab3d;l.addLiquid(l.vessels.find(v=>v.letter==='A'),l.compOf('water'),5);});await page.selectOption('#lang','et');
    assert.equal(await page.locator('.hydration').count(),0);await page.selectOption('#lang','en');
    // A late hypothesis cannot be backdated; reset restores the entry form.
    await page.evaluate(()=>{const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='k311'));const a=l.vessels.find(v=>v.letter==='A');l.GR.push({x:a.g.position.x,y:0,z:a.g.position.z,vy:0,m:.1,s:.001,v:a});l.updateGrains(.1);});
    await page.locator('#k311Hypothesis').selectOption('water');await page.locator('#k311Reason').fill('This prediction was entered too late.');await page.getByRole('button',{name:'Save prediction',exact:true}).click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.hypothesis),null);
    await page.evaluate(()=>{const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='k311'));});assert.equal(await page.locator('#k311Hypothesis').isDisabled(),false);assert.equal(await page.locator('#k311Reason').inputValue(),'');
    // Native sample addition and actual engine equilibrium drive copper visuals.
    const copper=await page.evaluate(()=>{
      const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='acidalkali'));
      const [a,b,c]=['A','B','C'].map(L=>l.vessels.find(v=>v.letter===L));
      for(const v of [a,b,c]){v.chem={V:0,tot:{},ind:{},solv:{},cap:250};v.temp=v.warmLogT=22;v.neutPrev=0;v.solid=0;v.stir=0;v.precipitates={};v.g.position.copy(v.base);}
      l.addLiquid(a,l.compOf('cuso4'),10);l.addLiquid(a,l.compOf('naoh'),4);
      l.addLiquid(b,l.compOf('cuso4'),10);l.addLiquid(b,l.compOf('hcl'),.4);
      l.addLiquid(c,l.compOf('agno3'),10);l.addLiquid(c,l.compOf('nacl'),10);l.addLiquid(c,l.compOf('cuso4'),10);l.addLiquid(c,l.compOf('naoh'),4);
      for(let i=0;i<450;i++)for(const v of [a,b,c])l.updateVessel(v,.1,300+i*.1);
      window.copperSamples={a,b,c};window.copperInventory=JSON.stringify(a.chem);
      const target=a.g.position.clone();target.y=.015;l.camera.position.copy(target).add({x:.05,y:.13,z:.18});l.camera.lookAt(target);l.camera.updateMatrixWorld();l.renderer.render(l.scene,l.camera);
      return{ppt:a.chem.eq.ppt.CuOH2,amount:a.precipitates.CuOH2.amount,settled:a.precipitates.CuOH2.settled,grains:a.phaseVisuals.copperGrains.count,bed:a.phaseVisuals.copperBed.visible,color:a.phaseVisuals.copperBed.material.color.getHexString(),control:b.phaseVisuals.copperGrains.count,mixed:[c.phaseVisuals.grains.count,c.phaseVisuals.copperGrains.count]};
    });
    assert.ok(copper.ppt>.99);assert.equal(copper.amount,copper.ppt);assert.ok(copper.settled>.99);assert.ok(copper.grains>0);assert.equal(copper.bed,true);assert.equal(copper.control,0);assert.ok(copper.mixed.every(n=>n>0));
    if(await page.locator('#inspectorToggle').getAttribute('aria-expanded')==='true')await page.locator('#inspectorClose').click();
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR||tmpdir(),'chemistry-nov26-copper.png'),fullPage:true});
    await page.locator('#inspectorToggle').click();await page.locator('#sampleSelect').selectOption('A');assert.ok((await page.locator('#sampleReport').textContent()).includes('settled blue precipitate'));
    for(const lang of ['et','ru','uk','en']){await page.selectOption('#lang',lang);await page.locator('#sampleSelect').selectOption('A');assert.ok((await page.locator('#sampleReport').textContent()).includes('Cu(OH)₂'));}
    await page.getByRole('button',{name:'Shake sample',exact:true}).click();
    const shake=await page.evaluate(()=>{const l=window.__lab3d,a=window.copperSamples.a;l.updateVessel(a,.1,500);return{settled:a.precipitates.CuOH2.settled,bed:a.phaseVisuals.copperBed.visible,same:JSON.stringify(a.chem)===window.copperInventory};});assert.equal(shake.settled,0);assert.equal(shake.bed,false);assert.equal(shake.same,true);
    const acid=await page.evaluate(()=>{const l=window.__lab3d,a=window.copperSamples.a;l.addLiquid(a,l.compOf('hcl'),8);l.doEq(a);for(let i=0;i<100;i++)l.updateVessel(a,.1,600+i*.1);l.renderer.render(l.scene,l.camera);return{ppt:a.precipitates.CuOH2.amount,grains:a.phaseVisuals.copperGrains.count,bed:a.phaseVisuals.copperBed.visible,Cu:a.chem.tot.Cu};});assert.ok(acid.ppt<1e-8);assert.equal(acid.grains,0);assert.equal(acid.bed,false);assert.equal(acid.Cu,1);
    await page.evaluate(()=>{const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='free'));for(const v of l.vessels)l.updateVessel(v,.1,800);});assert.equal(await page.evaluate(()=>window.__lab3d.vessels.every(v=>v.phaseVisuals.copperGrains.count===0&&!v.phaseVisuals.copperBed.visible)),true);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({copper,shake,acid,errors},null,2));
  } finally {if(browser)await browser.close();child.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
