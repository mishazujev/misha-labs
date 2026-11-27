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


    await page.evaluate(() => { window.__pauseLab=true; const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='k311'));l.setPPE('goggles');l.HOOD.fan=true; });
    if(await page.locator('#inspectorToggle').getAttribute('aria-expanded')!=='true') await page.locator('#inspectorToggle').click();
    const titles={en:'Salt in water and hexane',et:'Sool vees ja heksaanis',ru:'Соль в воде и гексане',uk:'Сіль у воді та гексані'};
    for(const lang of ['et','ru','uk','en']){await page.selectOption('#lang',lang);assert.ok((await page.locator('#card').textContent()).includes(titles[lang]));}
    await page.locator('#card .procedure-actions button').first().click();
    assert.ok((await page.locator('#picker').textContent()).includes('K3-11'));
    await page.locator('#picker .invx').click();
    await page.locator('.ans select').selectOption('water');
    await page.locator('.ans button').click();
    assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);
    await page.getByRole('button',{name:'Record comparison',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__lab3d.TASK.comparison),null);
    await page.getByRole('button',{name:'Save prediction',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__lab3d.TASK.hypothesis),null);
    await page.locator('#design-independent').selectOption('solvent');await page.locator('#design-controls').selectOption('volumeDoseTemperature');await page.getByRole('button',{name:'Save experiment plan',exact:true}).click();
    await page.locator('#k311Hypothesis').selectOption('hexane');
    await page.locator('#k311Reason').fill('I think the nonpolar solvent may dissolve more salt.');
    await page.getByRole('button',{name:'Save prediction',exact:true}).click();
    assert.equal(await page.locator('#k311Hypothesis').isDisabled(),true);
    assert.equal(await page.evaluate(()=>window.__lab3d.TASK.hypothesis.prediction),'hexane');
    await page.getByRole('button',{name:'Record solvent blanks',exact:true}).click();
    assert.ok(await page.evaluate(()=>window.__lab3d.TASK.blank));
    const trial=await page.evaluate(()=>{
      const l=window.__lab3d;
      for(const L of ['A','B']) {const v=l.vessels.find(v=>v.letter===L);l.GR.push({x:v.g.position.x,y:0,z:v.g.position.z,vy:0,m:.5,s:.001,v});}
      l.updateGrains(.1);
      const samples=['A','B'].map(L=>l.vessels.find(v=>v.letter===L));
      for(let i=0;i<100;i++) for(const v of samples) l.updateVessel(v,.1,100+i*.1);
      l.renderer.render(l.scene,l.camera);
      return {doses:l.TASK.doses,rows:l.solubilityTrial(samples,l.TASK.doses)};
    });
    assert.deepEqual(trial.doses,{A:.5,B:.5});assert.ok(trial.rows);assert.ok(trial.rows[0].dissolved>.49);assert.equal(trial.rows[1].residue,.5);
    await page.getByRole('button',{name:'Record comparison',exact:true}).click();
    assert.ok((await page.locator('.hydration').textContent()).includes('differs from your prediction'));
    const answer=page.locator('.ans select'); await answer.selectOption('hexane');
    await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);
    await answer.selectOption('water');await page.locator('.ans button').click();assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),true);
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR || tmpdir(), 'chemistry-nov25-k311.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.locator('.ans').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR || tmpdir(), 'chemistry-nov25-mobile.png'),fullPage:true});
    const bounds=await page.locator('.ans select').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
    assert.ok(await page.locator('.ans').isVisible());
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>{const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='k311'));});
    assert.equal(await page.evaluate(()=>window.__lab3d.TASK.reached),false);assert.equal(await page.evaluate(()=>window.__lab3d.TASK.blank),null);
    assert.deepEqual(await page.evaluate(()=>window.__lab3d.TASK.doses),{});

    const inlet=await page.evaluate(()=>{
      const l=window.__lab3d;l.setupTask(l.TASKS.find(t=>t.id==='acidalkali'));
      const d=l.DECOR_PICK.find(d=>d.info?.it.k==='sep'&&d.info.ranges);if(!d||!l.takeProp(d))throw Error('separator unavailable');
      const S=window.sf=d.info.taken;S.fly=null;S.area='bench';S.home.set(.1,0,.3);S.g.position.copy(S.home);S.g.quaternion.identity();
      for(const v of l.vessels){v.chem={V:0,tot:{},ind:{},solv:{},cap:250};v.solid=0;v.temp=v.warmLogT=22;v.neutPrev=0;v.held=false;v.stowed=false;}
      const inlet=S.separator,tg={kind:'vessel',v:inlet};
      l.ptr.copy(S.g.position);const target=l.findTarget(l.bottles.find(b=>b.id==='water'));if(target?.v!==inlet)throw Error('native inlet target must precede beaker below');
      l.deliver(tg,l.compOf('nacl'),40,S.g.position.clone().add({x:0,y:.39,z:0}),2);
      l.deliver(tg,l.chemOfProp({f:'C₆H₁₄',form:'bottle',c:''}).comp,20,S.g.position.clone().add({x:0,y:.39,z:0}),2);
      l.updateSeparator(S,0);const before=inlet.chem.V;l.updateSeparator(S,10);if(inlet.chem.V!==before)throw Error('closed valve leaked');l.placeSeparatorReceiver(S,l.vessels.find(v=>v.letter==='A'));
      l.toggleSeparator(S);const early=inlet.open;
      for(let i=0;i<300;i++)l.updateSeparator(S,.1);
      l.renderer.render(l.scene,l.camera);
      return {early,V:inlet.chem.V,liquids:inlet.liquids.length,phases:l.liquidLayers(inlet.chem).layers.map(x=>x.id),cap:inlet.chem.cap};
    });
    assert.equal(inlet.early,false);assert.equal(inlet.V,60);assert.equal(inlet.liquids,2);assert.deepEqual(inlet.phases,['water','hexane']);
    // Click the actual 3D stopcock via its projected visible lever.
    await page.locator('#inspectorClose').click();
    const valvePoint=await page.evaluate(()=>{
      const l=window.__lab3d,S=window.sf;
      const t=S.g.position.clone().add({x:-.02,y:.24,z:0});l.camera.position.copy(t).add({x:.12,y:.08,z:.48});l.camera.lookAt(t);l.camera.updateMatrixWorld();l.renderer.render(l.scene,l.camera);
      const p=S.separator.valve.getWorldPosition(S.g.position.clone());p.z+=.03;p.project(l.camera);
      const r=l.renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
    });
    await page.screenshot({path:path.join(process.env.LAB_SCREENSHOT_DIR || tmpdir(), 'chemistry-nov25-separator.png'),fullPage:true});
    assert.equal(await page.evaluate(p=>window.__lab3d.pickAt({clientX:p.x,clientY:p.y,pointerType:'mouse'})?.object.userData.obj.name,valvePoint),'separator-valve');
    await page.mouse.click(valvePoint.x,valvePoint.y);
    assert.equal(await page.evaluate(()=>window.sf.separator.open),true,'actual valve click must open stopcock');
    const first=await page.evaluate(()=>{
      const l=window.__lab3d,S=window.sf,c=S.separator.chem,a=l.vessels.find(v=>v.letter==='A');
      const before={Na:c.tot.Na,Cl:c.tot.Cl}; l.updateSeparator(S,1000);l.updateVessel(a,.1,500);
      return{open:S.separator.open,remaining:c.V,hexane:c.solv.hexane,sourceNa:c.tot.Na||0,received:a.chem.V,Na:a.chem.tot.Na,Cl:a.chem.tot.Cl,before};
    });
    assert.equal(first.open,false);assert.equal(first.remaining,20);assert.equal(first.received,40);assert.equal(first.hexane,20);assert.equal(first.sourceNa,0);assert.equal(first.Na,first.before.Na);assert.equal(first.Cl,first.before.Cl);
    const second=await page.evaluate(()=>{
      const l=window.__lab3d,S=window.sf,a=l.vessels.find(v=>v.letter==='A'),b=l.vessels.find(v=>v.letter==='B');l.placeSeparatorReceiver(S,b);
      const receiver=l.separatorReceiver(S).letter,dist=a.g.position.distanceTo(b.g.position);l.toggleSeparator(S);l.updateSeparator(S,1000);
      return{receiver,dist,empty:S.separator.chem.V,V:b.chem.V,hexane:b.chem.solv.hexane,Na:b.chem.tot.Na||0,A:a.chem.V};
    });
    assert.equal(second.receiver,'B');assert.ok(second.dist>.07);assert.equal(second.empty,0);assert.equal(second.V,20);assert.equal(second.hexane,20);assert.equal(second.Na,0);assert.equal(second.A,40);
    const reverse=await page.evaluate(()=>{
      const l=window.__lab3d,S=window.sf,c=l.vessels.find(v=>v.letter==='C');
      l.addLiquid(S.separator,l.compOf('nacl'),40);l.addLiquid(S.separator,l.chemOfProp({f:'CH₂Cl₂',form:'bottle',c:''}).comp,20);
      for(let i=0;i<300;i++)l.updateSeparator(S,.1);
      l.placeSeparatorReceiver(S,c);l.toggleSeparator(S);l.updateSeparator(S,1000);
      return{phase:c.chem.solv.dcm,ions:c.chem.tot.Na||0,left:S.separator.chem.V,sourceNa:S.separator.chem.tot.Na};
    });
    assert.equal(reverse.phase,20);assert.equal(reverse.ions,0);assert.equal(reverse.left,40);assert.ok(reverse.sourceNa>0);
    const overflow=await page.evaluate(()=>{
      const l=window.__lab3d,S=window.sf,d=l.vessels.find(v=>v.letter==='D');d.chem.V=249;
      l.placeSeparatorReceiver(S,d);l.toggleSeparator(S);l.updateSeparator(S,1000);
      const spilled=l.liquidSpills.reduce((n,x)=>n+x.chem.V,0);
      return{V:d.chem.V,spilled,empty:S.separator.chem.V};
    });
    assert.equal(overflow.V,250);assert.equal(overflow.spilled,39);assert.equal(overflow.empty,0);
    const unsupported=await page.evaluate(()=>{
      const l=window.__lab3d,S=window.sf;l.addLiquid(S.separator,l.compOf('acetic01'),10);l.toggleSeparator(S);
      const result={open:S.separator.open,V:S.separator.chem.V};l.returnProp(S);result.retained=l.PROPS.includes(S);const before=l.cleanedLiquid.V;l.discardSeparator(S);result.recovered=l.cleanedLiquid.V-before;result.empty=S.separator.chem.V===0;
      l.setupTask(l.TASKS.find(t=>t.id==='free'));result.cleared=l.PROPS.length===0&&l.liquidSpills.length===0;
      return result;
    });
    assert.equal(unsupported.open,false);assert.equal(unsupported.V,10);assert.equal(unsupported.retained,true);assert.equal(unsupported.recovered,10);assert.equal(unsupported.empty,true);assert.equal(unsupported.cleared,true);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({trial,inlet,first,second,reverse,overflow,unsupported,errors},null,2));
  } finally { if(browser)await browser.close();child.kill(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
