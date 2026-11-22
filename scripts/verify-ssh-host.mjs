import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyHostKeys(scan, expected) {
  if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(expected || '')) throw new Error('A Zone-confirmed SHA256 server host fingerprint is required');
  const lines = scan.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  if (!lines.length) throw new Error('SSH server returned no host key; check the address, port and Zone IP access policy');
  for (const line of lines) {
    const fields = line.split(/\s+/);
    if (fields.length !== 3 || fields[1] !== 'ssh-ed25519' || !/^[A-Za-z0-9+/]+={0,2}$/.test(fields[2])) throw new Error('Expected an Ed25519 SSH host key');
    const hash = createHash('sha256').update(Buffer.from(fields[2], 'base64')).digest('base64').replace(/=+$/, '');
    if ('SHA256:' + hash !== expected) throw new Error('SSH server host fingerprint does not match the Zone-confirmed fingerprint; connection refused');
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const verified = verifyHostKeys(readFileSync(process.argv[2], 'utf8'), process.env.ZONE_HOST_FINGERPRINT);
    writeFileSync(process.argv[3], verified, { mode: 0o600 });
    console.log('SSH server host key matches the fingerprint confirmed in Zone.');
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}
