#!/bin/bash

# OpenStrat — Script d'installation rapide
# Pour l'atelier IA du 20 mai 2026

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   🚀 OpenStrat Dashboard — Installation                  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    echo "   Téléchargez-le sur : https://nodejs.org/ (version LTS recommandée)"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version >= 18 recommandée. Vous avez : $(node --version)"
    read -p "Continuer quand même ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Node.js détecté : $(node --version)"
echo ""

# Cloner le repo
REPO_URL="https://github.com/benskls/openstrat.git"
INSTALL_DIR="openstrat"

if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  Le dossier 'openstrat' existe déjà."
    read -p "Le supprimer et recommencer ? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "Abandon."
        exit 0
    fi
fi

echo "📥 Clonage de OpenStrat..."
git clone "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo ""
echo "📦 Installation des dépendances..."
npm install

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   ✅ Installation terminée !                             ║"
echo "║                                                          ║"
echo "║   Pour lancer le dashboard :                             ║"
echo "║                                                          ║"
echo "║      cd openstrat                                        ║"
echo "║      npm start                                           ║"
echo "║                                                          ║"
echo "║   Puis ouvrez http://localhost:3456 dans votre navigateur ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Proposer de lancer immédiatement
read -p "🚀 Lancer le dashboard maintenant ? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    npm start
fi
