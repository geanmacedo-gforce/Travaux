#!/bin/bash
set -euo pipefail

echo "🚀 Iniciando deploy Travaux..."

REPO_DIR="/home/travaux/app/Travaux"
INTERFACE_DIR="$REPO_DIR/Travaux/Interface"
DEPLOY_DIR="$REPO_DIR/deploy/ubuntu"
TRAVAUX_UNIT_SRC="$DEPLOY_DIR/travaux.service"
BOT_UNIT_SRC="$DEPLOY_DIR/bot-whatsapp.service"
TRAVAUX_UNIT_DST="/etc/systemd/system/travaux.service"
BOT_UNIT_DST="/etc/systemd/system/bot-whatsapp.service"
BOT_AUTH_DIR="/home/travaux/.travaux/bot/auth_info_baileys"

echo "📥 Puxando alterações..."
cd "$REPO_DIR"
git pull origin main

echo "🔨 Fazendo build..."
cd "$INTERFACE_DIR"
npm run build

echo "🧩 Atualizando units do systemd..."
sudo cp "$TRAVAUX_UNIT_SRC" "$TRAVAUX_UNIT_DST"
sudo cp "$BOT_UNIT_SRC" "$BOT_UNIT_DST"
sudo systemctl daemon-reload

echo "🧹 Limpando sessão antiga do WhatsApp para forçar QR novo..."
sudo rm -rf "$BOT_AUTH_DIR"

echo "🔄 Reiniciando serviços..."
sudo systemctl restart travaux.service
sudo systemctl stop bot-whatsapp.service
sudo rm -rf "$BOT_AUTH_DIR"
sudo systemctl restart bot-whatsapp.service

echo "✅ Deploy concluído para a aplicação web."
echo "🔎 Status da aplicação web:"
sudo systemctl status travaux.service --no-pager

echo "🔎 Log do bot WhatsApp (Ctrl+C para sair depois de ler o QR):"
sudo journalctl -u bot-whatsapp.service -f --no-pager