import { pathToFileURL } from 'node:url';

export function deploymentErrors(env) {
  const required = ['PRODUCTION_URL', 'ZONE_HOST', 'ZONE_PORT', 'ZONE_USERNAME', 'ZONE_TARGET_PATH', 'ZONE_PM2_APP', 'ZONE_SSH_PRIVATE_KEY', 'ZONE_HOST_FINGERPRINT'];
  const errors = required.filter(key => !env[key]?.trim()).map(key => `Missing ${key}`);
  if (env.ZONE_HOST_FINGERPRINT && !/^SHA256:[A-Za-z0-9+/]{43}$/.test(env.ZONE_HOST_FINGERPRINT)) errors.push('ZONE_HOST_FINGERPRINT must be the SHA256 server host fingerprint confirmed in Zone');
  const path = env.ZONE_TARGET_PATH;
  if (path && (!/^\/data[^/]*\/virt[^/]*\/domeenid\/[A-Za-z0-9_./-]+$/.test(path) || path.split('/').includes('..'))) {
    errors.push('ZONE_TARGET_PATH must be a dedicated Labs directory below /data*/virt*/domeenid/ without parent traversal');
  }
  if (env.ZONE_PORT && (!/^\d+$/.test(env.ZONE_PORT) || +env.ZONE_PORT < 1 || +env.ZONE_PORT > 65535)) errors.push('ZONE_PORT must be an integer from 1 to 65535');
  if (env.ZONE_HOST && !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(env.ZONE_HOST)) errors.push('ZONE_HOST must be an SSH hostname or IPv4 address');
  for (const key of ['ZONE_USERNAME', 'ZONE_PM2_APP']) if (env[key] && !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(env[key])) errors.push(`${key} contains unsupported characters`);
  if (env.PRODUCTION_URL) {
    try {
      const url = new URL(env.PRODUCTION_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    } catch { errors.push('PRODUCTION_URL must be an HTTPS origin, such as https://labs.mishazujev.com'); }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = deploymentErrors(process.env);
  if (errors.length) {
    // Print names and guidance only; never print configuration/secret values.
    console.error(errors.join('\n') + '\nConfigure the production environment as described in DEPLOYMENT.md.');
    process.exitCode = 1;
  } else console.log('Deployment configuration passed preflight checks.');
}
