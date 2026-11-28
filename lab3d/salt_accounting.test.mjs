import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {saltLanding,depositSalt,saltInventory}from './bench_state.mjs';import{dissolveSalt}from './phase_state.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const vessel=()=>({g:{position:{x:0,y:0,z:0}},Ri:.03,b:.003,tilt:0,solid:0,temp:22,stir:0,chem:{V:10,tot:{},ind:{},solv:{}}});
test('aggregate NaCl landing uses actual receiver geometry and accounts for missed/moved/held receivers',()=>{
 const v=vessel(),grain={x:0,y:.004,z:0,m:1};assert.equal(saltLanding(grain,[v]).v,v);
 for(const patch of [{held:true},{stowed:true},{tilt:40}]){Object.assign(v,patch);assert.equal(saltLanding(grain,[v]),null);Object.assign(v,{held:false,stowed:false,tilt:0});}
 v.g.position.x=1;grain.y=0;assert.equal(saltLanding(grain,[v]).kind,'bench');
 const sink={x0:.4,x1:.6,z0:-.1,z1:.1,depth:.12};grain.x=.5;grain.y=-.05;assert.equal(saltLanding(grain,[],sink),null);grain.y=-.13;assert.equal(saltLanding(grain,[],sink).kind,'sink');
});
test('finite source, dissolved receiver, in-flight grains, merged spills and collected waste preserve total NaCl',()=>{
 const source=vessel(),receiver=vessel(),spills=[],waste={collected:0,sink:0},grains=[{m:.5}];source.solid=1;receiver.solid=1;
 depositSalt(spills,.2,.2,.3);depositSalt(spills,.21,.2,.2);assert.equal(spills.length,1);near(saltInventory([source,receiver],grains,spills,waste).total,3);
 dissolveSalt(receiver,100);near(saltInventory([source,receiver],grains,spills,waste).total,3);
 waste.collected+=spills.reduce((n,s)=>n+s.mass,0);spills.length=0;near(saltInventory([source,receiver],grains,spills,waste).total,3);
 grains.length=0;waste.sink+=.5;near(saltInventory([source,receiver],grains,spills,waste).total,3);
 assert.equal(depositSalt(spills,0,0,-1),null);
});
test('the native aggregate pour removes exactly the mass it puts into falling grains for bench and sink targets',()=>{
 const source=fs.readFileSync(new URL('./main3d.js',import.meta.url),'utf8'),start=source.indexOf('const GRAVITY_SOLIDS ='),end=source.indexOf('\nfunction findTarget',start);
 for(const kind of ['bench','sink','vessel']){const GR=[],context=vm.createContext({GR,ELP:[],clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),logE(){},analyticsActivity(){}});vm.runInContext(source.slice(start,end)+';globalThis.transfer=GRAVITY_SOLIDS;',context);const v={solid:3,tilt:110,letter:'A',particles:[],spout:{x:.2,y:.2,z:.2}};context.transfer.update(v,{kind,v:{letter:'B'}},.1);near(v.solid+GR.reduce((n,g)=>n+g.m,0),3);assert.ok(GR.length>0);}
});
