# Deploy Ubuntu

This folder keeps the production deployment contract for both apps.

Recommended layout on the server:

- `/home/travaux/app/Travaux` -> git clone of this repository
- `/home/travaux/.travaux/travaux.env` -> Travaux runtime env file
- `/home/travaux/.travaux/bot.env` -> Bot runtime env file
- `/home/travaux/.travaux/bot/auth_info_baileys` -> Baileys session data

Use explicit file paths only. Do not rely on directory scanning for secrets.

When running `deploy-travaux`, the bot service should be restarted with a fresh Baileys session and its journal followed so the QR code appears in the deployment output.

## Files

- `travaux.service` starts the Travaux app
- `bot-whatsapp.service` starts the WhatsApp bot
- `travaux.env.example` documents the required env vars for Travaux
- `bot.env.example` documents the required env vars for the bot

## Security rules

- Keep env files outside the repository.
- Never commit `auth_info_baileys` or any `.env` file.
- Use `BOT_AUTH_DIR` and `TRAVAUX_ENV_FILE` to point to exact files/directories.
- Restrict filesystem permissions to the `travaux` user only.