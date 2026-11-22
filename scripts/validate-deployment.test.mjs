import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentErrors } from './validate-deployment.mjs';

const valid = { PRODUCTION_URL: 'https://labs.mishazujev.com', ZONE_HOST: '217.146.69.31', ZONE_PORT: '22', ZONE_USERNAME: 'virt71341', ZONE_TARGET_PATH: '/data02/virt71341/domeenid/www.mishazujev.com/labs', ZONE_PM2_APP: 'misha-labs', ZONE_SSH_PRIVATE_KEY: 'test-private-key', ZONE_KNOWN_HOSTS: 'test-host-key' };
test('preflight accepts the documented dedicated Labs target', () => assert.deepEqual(deploymentErrors(valid), []));
test('all missing settings are reported together without secret values', () => {
  assert.equal(deploymentErrors({}).length, 8);
  const report = deploymentErrors({ ...valid, ZONE_PORT: '0', ZONE_USERNAME: "bad'user" }).join('\n');
  assert.match(report, /ZONE_PORT/); assert.match(report, /ZONE_USERNAME/);
  assert.ok(!report.includes(valid.ZONE_SSH_PRIVATE_KEY));
});
test('preflight rejects broad, traversing and quoted remote targets', () => {
  for (const target of ['/', '/data02/virt71341/domeenid/', '/data02/virt71341/domeenid/site/../other', "/data02/virt71341/domeenid/site/'labs"]) assert.ok(deploymentErrors({ ...valid, ZONE_TARGET_PATH: target }).some(x => x.startsWith('ZONE_TARGET_PATH')));
});
test('public route verification requires an HTTPS origin without credentials', () => {
  for (const url of ['http://labs.mishazujev.com', 'https://user:password@labs.mishazujev.com', 'https://labs.mishazujev.com/path']) assert.ok(deploymentErrors({ ...valid, PRODUCTION_URL: url }).some(x => x.startsWith('PRODUCTION_URL')));
});
