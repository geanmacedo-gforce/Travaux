# Travaux Monorepo

Estrutura alvo:

- `Bot` -> bot de WhatsApp
- `Interface/travaux` -> aplicação web Travaux

Use os arquivos de ambiente fora do repositório:

- `/home/travaux/.travaux/travaux.env`
- `/home/travaux/.travaux/bot.env`
- `/home/travaux/.travaux/bot/auth_info_baileys`

Os serviços systemd em `deploy/ubuntu` já apontam para essa estrutura.