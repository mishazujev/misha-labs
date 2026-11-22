import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { verifyHostKeys } from './verify-ssh-host.mjs';

// Independent fixture: ssh-ed25519 type followed by 32 public-key bytes.
const blob = Buffer.concat([Buffer.from([0, 0, 0, 11]), Buffer.from('ssh-ed25519'), Buffer.from([0, 0, 0, 32]), Buffer.alloc(32, 7)]);
const record = '217.146.69.31 ssh-ed25519 ' + blob.toString('base64');
const pinned = 'SHA256:' + createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
test('a host key is accepted only when its computed fingerprint matches the trusted pin', () => {
  assert.equal(verifyHostKeys('# banner\r\n' + record + '\r\n', pinned), record + '\n');
});
test('untrusted and additional nonmatching keys are rejected', () => {
  const other = Buffer.from(blob); other[other.length - 1] = 8;
  const changed = '217.146.69.31 ssh-ed25519 ' + other.toString('base64');
  assert.throws(() => verifyHostKeys(changed, pinned), /does not match/);
  assert.throws(() => verifyHostKeys(record + '\n' + changed, pinned), /does not match/);
});
test('empty scans, wrong algorithms and missing pins cannot create trusted records', () => {
  assert.throws(() => verifyHostKeys('# only comments', pinned), /no host key/);
  assert.throws(() => verifyHostKeys(record.replace('ssh-ed25519', 'ssh-rsa'), pinned), /Ed25519/);
  assert.throws(() => verifyHostKeys(record, ''), /Zone-confirmed/);
});
