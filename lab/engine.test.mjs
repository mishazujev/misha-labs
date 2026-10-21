import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./engine.js', import.meta.url), 'utf8');
const context = { module: { exports: {} } };
vm.createContext(context);
vm.runInContext(source, context);
const { indColor } = context.module.exports;

const anchors = [1, 3.5, 5.5, 7, 9, 11, 13.5];
assert.deepEqual(anchors.map(pH => indColor('univ', pH).key),
  ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet']);
assert.notDeepEqual(indColor('univ', 6.9).rgb, indColor('univ', 7.1).rgb,
  'universal-indicator colour must vary continuously around neutral pH');

console.log('chemistry_engine: seven universal-indicator colours passed');
