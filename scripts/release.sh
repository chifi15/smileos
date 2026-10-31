#!/bin/bash
# release.sh — Lanza la versión actual de develop a producción (master)
set -e

echo "🚀 Iniciando release develop → master..."

# Asegurarse de estar en develop y al día
git checkout develop
git pull origin develop

# Cambiar a master, traer cambios y hacer merge
git checkout master
git pull origin master
git merge develop --no-ff -m "release: merge develop into master $(date '+%Y-%m-%d')"
git push origin master

# Volver a develop para seguir trabajando
git checkout develop

echo "✅ Release completado. Render y Vercel desplegando producción..."
echo "   Producción: https://smileos-six.vercel.app"
echo "   Staging:    https://smileos-staging.vercel.app"
