# Automated deployment to Zone

The Labs site follows the same deployment pattern as `classroom.mishazujev.com`: a push to the `main` branch triggers GitHub Actions, which tests the application, uploads the production files over SSH, restarts PM2, and verifies the public routes.

The workflow deliberately does not use `rsync --delete`. The private `.data/lab-analytics.sqlite` database on Zone is therefore never uploaded, deleted, or replaced.

## One-time GitHub setup

Create a separate GitHub repository named `misha-labs`, push this project to its `main` branch, and create a protected GitHub environment named `production`.

Environment secrets:

- `ZONE_SSH_PRIVATE_KEY` — private half of the dedicated Labs deployment key.
- `ZONE_KNOWN_HOSTS` — trusted SSH host-key line for the Zone server.

Environment variables:

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
- SSH failure: confirm the public deployment key is still authorized in Zone and refresh `ZONE_KNOWN_HOSTS` only after verifying a legitimate host-key change.
- Upload failure: confirm `ZONE_TARGET_PATH` is `/data02/virt71341/domeenid/www.mishazujev.com/labs` and `ZONE_USERNAME` is `virt71341`.
