#!/bin/bash

# OpenStrat — Script d'installation rapide
# Pour l'atelier IA du 20 mai 2026

set -e

# Helper pour lire depuis le TTY (robustesse curl | bash)
read_tty() {
    if [ -t 0 ]; then
        read -rp "$@" || true
    else
        return 0
    fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   🚀 OpenStrat Dashboard — Installation                  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. Vérifier Node.js
# ─────────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    echo "   Téléchargez-le sur : https://nodejs.org/ (version LTS recommandée)"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version >= 18 recommandée. Vous avez : $(node --version)"
    read_tty "Continuer quand même ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Node.js détecté : $(node --version)"
echo ""

# ─────────────────────────────────────────────────────────────
# 2. Détecter le dossier parent
# ─────────────────────────────────────────────────────────────
if [ -f "server.js" ]; then
    DEFAULT_PARENT_DIR=$(dirname "$PWD")
else
    DEFAULT_PARENT_DIR="$PWD"
fi

echo ""
echo "📁 Dossier racine"
echo "   Ce dossier contiendra openstrat/ ET vos futurs projets."
echo "   [défaut: $DEFAULT_PARENT_DIR]"
read_tty "" PARENT_DIR
PARENT_DIR=${PARENT_DIR:-$DEFAULT_PARENT_DIR}

if [ ! -d "$PARENT_DIR" ]; then
    echo "📁 Création du dossier $PARENT_DIR..."
    mkdir -p "$PARENT_DIR"
fi
# Normaliser en chemin absolu
PARENT_DIR=$(cd "$PARENT_DIR" && pwd)

echo "📁 Dossier de projets configuré : $PARENT_DIR"
echo ""

# ─────────────────────────────────────────────────────────────
# 3. Installer OpenStrat
# ─────────────────────────────────────────────────────────────
if [ -f "server.js" ]; then
    echo "📂 Mode local détecté (vous êtes déjà dans le repo openstrat)"
    INSTALL_DIR="$PWD"
    IS_LOCAL=true
else
    IS_LOCAL=false
    REPO_URL="https://github.com/benskls/openstrat.git"
    INSTALL_DIR="openstrat"
    
    if [ -d "$INSTALL_DIR" ]; then
        echo ""
        echo "⚠️  Le dossier 'openstrat' existe déjà."
        echo "   Le supprimer et recommencer ? (y/N)"
        read_tty "" -n 1 -r
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
fi

# Normaliser le chemin d'installation en absolu
INSTALL_DIR=$(cd "$INSTALL_DIR" && pwd)

cd "$INSTALL_DIR"

echo ""
echo "📦 Installation des dépendances..."
npm install

# ─────────────────────────────────────────────────────────────
# 4. Créer le fichier config.json
# ─────────────────────────────────────────────────────────────
echo ""
echo "⚙️  Création de la configuration..."
cat > "$INSTALL_DIR/config.json" <<EOF
{
  "parentDir": "$PARENT_DIR"
}
EOF
echo "✅ config.json créé avec parentDir : $PARENT_DIR"

# ─────────────────────────────────────────────────────────────
# 5. Créer l'alias shell
# ─────────────────────────────────────────────────────────────
echo ""
echo "🔧 Configuration de l'alias shell..."

SHELL_RC="$HOME/.bashrc"
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_RC="$HOME/.zshrc"
fi

ALIAS_LINE="alias openstrat='cd $INSTALL_DIR && npm start'"

if [ -f "$SHELL_RC" ] && grep -q "alias openstrat=" "$SHELL_RC"; then
    # Remplacer l'ancien alias
    sed -i '' "/alias openstrat=/c\\
$ALIAS_LINE" "$SHELL_RC" 2>/dev/null || \
    sed -i "/alias openstrat=/c\\
$ALIAS_LINE" "$SHELL_RC"
    echo "✅ Alias mis à jour dans $SHELL_RC"
    echo "   Pour l'utiliser immédiatement, exécutez : source $SHELL_RC"
else
    {
        echo ""
        echo "# OpenStrat Dashboard"
        echo "$ALIAS_LINE"
    } >> "$SHELL_RC"
    echo "✅ Alias ajouté dans $SHELL_RC"
    echo "   Pour l'utiliser immédiatement, exécutez : source $SHELL_RC"
fi

# ─────────────────────────────────────────────────────────────
# 6. Proposer de lancer immédiatement
# ─────────────────────────────────────────────────────────────
echo ""

# Vérifier si le port est déjà utilisé
if lsof -ti:3456 > /dev/null 2>&1; then
    echo "ℹ️  OpenStrat est déjà en cours d'exécution sur http://localhost:3456"
    echo "   Pour l'arrêter : lsof -ti:3456 | xargs kill"
    echo ""
else
    read_tty "🚀 Lancer le dashboard maintenant ? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo ""
        echo "🚀 Démarrage d'OpenStrat..."
        echo "   http://localhost:3456"
        echo "   (Ctrl+C pour arrêter)"
        echo ""
        npm start
    else
        echo ""
        echo "💡 Pour lancer plus tard : openstrat"
    fi
fi

# ─────────────────────────────────────────────────────────────
# 7. Instructions finales
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   ✅ OpenStrat est prêt !                                ║"
echo "║                                                          ║"
echo "║   Dashboard : http://localhost:3456                      ║"
echo "║   Dossier racine : $PARENT_DIR                           ║"
echo "║                                                          ║"
echo "║   Commandes utiles :                                     ║"
echo "║     openstrat              → relancer le dashboard       ║"
echo "║     lsof -ti:3456 | xargs kill  → arrêter le serveur     ║"
echo "║                                                          ║"
echo "║   Prochaines étapes :                                    ║"
echo "║   1. Créez un projet dans $PARENT_DIR :                  ║"
echo "║      mkdir $PARENT_DIR/mon-projet                        ║"
echo "║   2. Ouvrez http://localhost:3456                        ║"
echo "║   3. Cliquez sur 🔄 pour scanner                         ║"
echo "║   4. Sélectionnez votre projet et générez agents/skills  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo ""
echo "💡 Astuce : l'alias 'openstrat' est disponible dans un nouveau terminal"
