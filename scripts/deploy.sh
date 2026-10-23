#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  SYSTÈME DE PÉAGE AUTOMATISÉ - DÉPLOIEMENT VPS"
echo "=========================================================="

# Aller à la racine du projet
cd "$(dirname "$0")/.."

echo "==> Récupération des dernières modifications..."
git fetch origin main
git reset --hard origin/main

if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  echo "🐳 Déploiement avec Docker Compose..."
  docker compose up -d --build --remove-orphans
  docker image prune -f
elif command -v pm2 &> /dev/null; then
  echo "⚡ Déploiement avec Node.js & PM2..."
  npm ci
  npm run build:client
  pm2 restart peage || pm2 start npm --name "peage" -- start
  pm2 save
else
  echo "⚙️ Déploiement standard Node.js..."
  npm ci
  npm run build:client
  pkill -f "tsx server/src/index.ts" || true
  nohup npm start > peage.log 2>&1 &
fi

echo "=========================================================="
echo "✅ Déploiement terminé avec succès !"
echo "🌐 API & Interface accessibles sur : http://<IP_DU_VPS>:3001"
echo "=========================================================="
