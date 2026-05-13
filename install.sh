#!/bin/bash

# OpenStrat — Script d'installation rapide

set -e

# Helper pour lire interactivement depuis le terminal
# Fonctionne même quand le script est pipé (curl | bash)
read_tty() {
    read -rp "$@" < /dev/tty
}

# ─────────────────────────────────────────────────────────────
# Fonction : vérifier si une mise à jour est disponible
# ─────────────────────────────────────────────────────────────
check_for_updates() {
    local current_version="$1"
    local install_dir="$2"
    
    # Vérifier si curl est disponible
    if ! command -v curl &> /dev/null; then
        return 0
    fi
    
    # Récupérer la dernière release depuis GitHub
    local latest_tag
    latest_tag=$(curl -s "https://api.github.com/repos/benskls/openstrat/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$latest_tag" ]; then
        return 0
    fi
    
    # Comparer les versions (simple comparaison lexicographique des tags)
    if [ "$latest_tag" != "$current_version" ]; then
        echo ""
        echo "📢  Mise à jour disponible !"
        echo "    Version installée : $current_version"
        echo "    Dernière version  : $latest_tag"
        echo ""
        echo "    Pour mettre à jour :"
        echo "    cd $install_dir && git pull origin main"
        echo ""
    fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   🚀  OpenStrat Dashboard — Installation                  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. Vérifier Node.js
# ─────────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo "❌  Node.js n'est pas installé."
    echo "   Téléchargez-le sur : https://nodejs.org/ (version LTS recommandée)"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️   Node.js version >= 18 recommandée. Vous avez : $(node --version)"
    read_tty "Continuer quand même ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅  Node.js détecté : $(node --version)"
echo ""

# ─────────────────────────────────────────────────────────────
# 2. Détecter le dossier racine (parent)
# ─────────────────────────────────────────────────────────────
DEFAULT_PARENT_DIR=$(dirname "$PWD")

echo ""
echo "📁  Dossier racine (parent)"
echo "   [défaut: $DEFAULT_PARENT_DIR]"
read_tty "   Ce dossier contiendra le dossier d'installation openstrat/ ET vos futurs projets. Continuer ? (Y/n) " REPLY
echo

if [[ $REPLY =~ ^[Nn]$ ]]; then
    read_tty "   Indiquer le dossier parent souhaité : " PARENT_DIR
    echo
else
    PARENT_DIR=""
fi

PARENT_DIR=${PARENT_DIR:-$DEFAULT_PARENT_DIR}

if [ ! -d "$PARENT_DIR" ]; then
    echo "📁  Création du dossier $PARENT_DIR..."
    mkdir -p "$PARENT_DIR"
fi
# Normaliser en chemin absolu
PARENT_DIR=$(cd "$PARENT_DIR" && pwd)

echo "📁  Dossier racine configuré : $PARENT_DIR"
echo ""

# ─────────────────────────────────────────────────────────────
# 3. Installer OpenStrat
# ─────────────────────────────────────────────────────────────
if [ -f "server.js" ]; then
    echo "📂  Mode local détecté (vous êtes déjà dans le repo openstrat)"
    INSTALL_DIR="$PWD"
    IS_LOCAL=true
else
    IS_LOCAL=false
    REPO_URL="https://github.com/benskls/openstrat.git"
    INSTALL_DIR="openstrat"
    
    if [ -d "$INSTALL_DIR" ]; then
        echo ""
        echo "⚠️   Le dossier 'openstrat' existe déjà."
        echo "    Le supprimer et recommencer ? (y/N)"
        read_tty "" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            echo "Abandon."
            exit 0
        fi
    fi
    
    echo "📥  Clonage de OpenStrat..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Normaliser le chemin d'installation en absolu
INSTALL_DIR=$(cd "$INSTALL_DIR" && pwd)

cd "$INSTALL_DIR"

echo ""
echo "📦  Installation des dépendances..."
npm install

# ─────────────────────────────────────────────────────────────
# 4. Créer le fichier config.json
# ─────────────────────────────────────────────────────────────
echo ""
echo "⚙️   Création de la configuration..."
cat > "$INSTALL_DIR/config.json" <<EOF
{
  "parentDir": "$PARENT_DIR"
}
EOF
echo "✅  config.json créé avec parentDir : $PARENT_DIR"

# ─────────────────────────────────────────────────────────────
# 5. Créer le lanceur dynamique (fonction shell)
# ─────────────────────────────────────────────────────────────
echo ""
echo "🔧  Configuration du lanceur shell..."

SHELL_RC="$HOME/.bashrc"
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_RC="$HOME/.zshrc"
fi

# Nettoyer les anciennes configurations OpenStrat
if [ -f "$SHELL_RC" ]; then
    # Supprimer anciens alias et fonctions
    sed -i '' '/# OpenStrat/d' "$SHELL_RC" 2>/dev/null || sed -i '/# OpenStrat/d' "$SHELL_RC"
    sed -i '' '/alias openstrat=/d' "$SHELL_RC" 2>/dev/null || sed -i '/alias openstrat=/d' "$SHELL_RC"
    sed -i '' '/^openstrat()/,/^}/d' "$SHELL_RC" 2>/dev/null || sed -i '/^openstrat()/,/^}/d' "$SHELL_RC"
fi

# Créer le fichier de chemin
OPENSTRAT_PATH_FILE="$HOME/.openstrat-path"
echo "$INSTALL_DIR" > "$OPENSTRAT_PATH_FILE"

# Ajouter la fonction shell
cat >> "$SHELL_RC" <<'LAUNCHER_EOF'

# OpenStrat — Lanceur dynamique
# Ce lanceur lit le chemin d'installation depuis ~/.openstrat-path
# Pour mettre à jour : réinstallez OpenStrat ou modifiez ~/.openstrat-path
openstrat() {
    local install_dir
    if [ -f "$HOME/.openstrat-path" ]; then
        install_dir=$(cat "$HOME/.openstrat-path")
    fi
    
    if [ -z "$install_dir" ] || [ ! -f "$install_dir/server.js" ]; then
        echo "❌  OpenStrat introuvable à : $install_dir"
        echo "    Veuillez réinstaller OpenStrat ou mettre à jour ~/.openstrat-path"
        return 1
    fi
    
    # Vérifier les mises à jour (silencieux)
    if command -v curl &> /dev/null; then
        local latest_tag
        latest_tag=$(curl -s "https://api.github.com/repos/benskls/openstrat/releases/latest" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
        if [ -n "$latest_tag" ]; then
            local current_tag
            if [ -f "$install_dir/package.json" ]; then
                current_tag=$(grep '"version"' "$install_dir/package.json" | sed -E 's/.*"([^"]+)".*/\1/')
                if [ "$latest_tag" != "v$current_tag" ] && [ "$latest_tag" != "$current_tag" ]; then
                    echo "📢  Mise à jour disponible : $latest_tag (vous avez : $current_tag)"
                    echo "    Pour mettre à jour : cd $install_dir && git pull origin main"
                    echo ""
                fi
            fi
        fi
    fi
    
    cd "$install_dir" && npm start
}
LAUNCHER_EOF

echo "✅  Lanceur ajouté dans $SHELL_RC"
echo "   Chemin d'installation stocké dans : ~/.openstrat-path"
echo "   Pour l'utiliser immédiatement, exécutez : source $SHELL_RC"

# ─────────────────────────────────────────────────────────────
# 6. Vérifier les mises à jour
# ─────────────────────────────────────────────────────────────
CURRENT_VERSION=$(grep '"version"' package.json | sed -E 's/.*"([^"]+)".*/\1/')
check_for_updates "$CURRENT_VERSION" "$INSTALL_DIR"

# ─────────────────────────────────────────────────────────────
# 7. Proposer de lancer immédiatement
# ─────────────────────────────────────────────────────────────
echo ""

# Vérifier si le port est déjà utilisé
if lsof -ti:3456 > /dev/null 2>&1; then
    echo "ℹ️   OpenStrat est déjà en cours d'exécution sur http://localhost:3456"
    echo "    Pour l'arrêter : lsof -ti:3456 | xargs kill"
    echo ""
else
    read_tty "🚀  Lancer le dashboard maintenant ? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo ""
        echo "🚀  Démarrage d'OpenStrat..."
        echo "    http://localhost:3456"
        echo "    (Ctrl+C pour arrêter)"
        echo ""
        npm start
    else
        echo ""
        echo "💡  Pour lancer plus tard : openstrat"
    fi
fi

# ─────────────────────────────────────────────────────────────
# 8. Instructions finales
# ─────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   ✅  OpenStrat est prêt !                                ║"
echo "║                                                          ║"
echo "║   Dashboard : http://localhost:3456                      ║"
echo "║   Dossier racine : $PARENT_DIR                           ║"
echo "║   Installation : $INSTALL_DIR                            ║"
echo "║                                                          ║"
echo "║   Commandes utiles :                                     ║"
echo "║     openstrat              → relancer le dashboard       ║"
echo "║     lsof -ti:3456 | xargs kill  → arrêter le serveur     ║"
echo "║                                                          ║"
echo "║   Prochaines étapes :                                    ║"
echo "║   1. Créez un projet dans $PARENT_DIR :                  ║"
echo "║      mkdir $PARENT_DIR/mon-projet                        ║"
echo "║   2. Ouvrez http://localhost:3456                        ║"
echo "║   3. Cliquez sur 🔄  pour scanner                         ║"
echo "║   4. Sélectionnez votre projet et générez agents/skills  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo ""
echo "💡  Astuce : la fonction 'openstrat' est disponible dans un nouveau terminal"
