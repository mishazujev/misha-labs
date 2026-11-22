# Automated deployment to Zone

The Labs site follows the same deployment pattern as `classroom.mishazujev.com`: a push to the `main` branch triggers GitHub Actions, which tests the application, uploads the production files over SSH, restarts PM2, and verifies the public routes.

The workflow deliberately does not use `rsync --delete`. The private `.data/lab-analytics.sqlite` database on Zone is therefore never uploaded, deleted, or replaced.

## Deployment access — 22 November 2026

The seven production variables below and `ZONE_SSH_PRIVATE_KEY` are configured in the GitHub `production` environment. A dedicated Labs key was created with the owner's approval; its private half is stored only in GitHub. The public half must be authorized for `virt71341` in Zone. The owner supplied the server's Ed25519 SHA256 fingerprint from Zone's SSH panel.

The workflow scans the server's public Ed25519 key and verifies its SHA256 digest against `ZONE_HOST_FINGERPRINT` before installing a trusted host record or using the private key. `ZONE_KNOWN_HOSTS` is no longer required. It will refuse a changed or unverified server key. The preflight also checks required settings and the dedicated remote target path before connecting.

The previous failed run had empty configuration. Restoring configuration is not evidence of a successful deployment: inspect the latest Actions run and public routes. If the SSH scan times out, check the server address, port and Zone SSH IP access policy. Do not disable host verification to bypass a connection failure.

## One-time GitHub setup

Create a separate GitHub repository named `misha-labs`, push this project to its `main` branch, and create a protected GitHub environment named `production`.

Environment secrets:

- `ZONE_SSH_PRIVATE_KEY` — private half of the dedicated Labs deployment key.
- No known-hosts secret is needed; the trusted server fingerprint is a production variable.

Environment variables:

- `ZONE_HOST_FINGERPRINT=SHA256:SCSz5G+d4bt7xE/N/aB+M/sDEJ0kc1gHdfocXIoFfBY` (confirmed in Zone by the owner)
- `PRODUCTION_URL=https://labs.mishazujev.com`
- `ZONE_HOST=217.146.69.31` (or the SSH hostname shown by Zone)
- `ZONE_PORT=22`
- `ZONE_USERNAME=virt71341`
- `ZONE_TARGET_PATH=/data02/virt71341/domeenid/www.mishazujev.com/labs`

This is the application directory verified over SSH. Do not use
`/data02/virt71341/domeenid/www.labs.mishazujev.com/htdocs`: despite appearing in
the Zone PM2 form, that directory does not exist in the SSH filesystem.
- `ZONE_PM2_APP=misha-labs`

## One-time Zone setup

1. In Zone, add the public deployment key under SSH access for `virt71341`.
2. Keep the subdomain's `mod_proxy` backend port set to `4173`.
3. Keep the existing PM2 application named `misha-labs` pointed at `zone-start.mjs`.
4. Do not delete `.data/`; it contains private teacher analytics and remains server-managed.

## Normal updates

After the one-time setup, changes deploy with:

```sh
git add .
git commit -m "Describe the update"
git push origin main
```

GitHub shows progress under **Actions → Deploy to Zone**. The workflow tests, uploads, restarts PM2, and checks the hub, Chemistry page, and a hub image.

## Rollback

Revert the faulty commit and push the revert to `main`. The standard deployment workflow will restore the previous version without rewriting Git history or touching the analytics database.

## Troubleshooting

- `503 Service Unavailable`: inspect PM2 logs, confirm `HOST=127.1.61.189`, and confirm mod_proxy port `4173`.
- SSH failure: confirm the public deployment key is still authorized in Zone and update `ZONE_HOST_FINGERPRINT` only after confirming a legitimate server host-key change in Zone.
- Upload failure: confirm `ZONE_TARGET_PATH` is `/data02/virt71341/domeenid/www.mishazujev.com/labs` and `ZONE_USERNAME` is `virt71341`.
