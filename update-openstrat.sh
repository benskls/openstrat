#!/bin/bash

# OpenStrat — Script de mise à jour automatique
# 
# Ce script met à jour le dashboard OpenStrat vers la dernière version
# SANS toucher aux projets personnels (agents, skills, picture, etc.)
#
# Usage : curl -fsSL https://raw.githubusercontent.com/benskls/openstrat/main/update-openstrat.sh | bash
# Ou    : bash update-openstrat.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   🚀  OpenStrat — Mise à jour automatique                 ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────
# 0. Accepter le chemin en argument (optionnel)
# ─────────────────────────────────────────────────────────────

if [ -n "$1" ]; then
    USER_ARG_PATH="$1"
    # Enlever les éventuels guillemets
    USER_ARG_PATH=$(echo "$USER_ARG_PATH" | sed 's/^["'"'"']*//;s/["'"'"']*$//')
    if [ -f "$USER_ARG_PATH/server.js" ]; then
        OPENSTRAT_DIR="$USER_ARG_PATH"
        echo "📁  Chemin fourni en argument : $OPENSTRAT_DIR"
    elif [ -f "$USER_ARG_PATH/openstrat/server.js" ]; then
        OPENSTRAT_DIR="$USER_ARG_PATH/openstrat"
        echo "📁  Chemin détecté (avec sous-dossier openstrat) : $OPENSTRAT_DIR"
    fi
fi

# ─────────────────────────────────────────────────────────────
# 1. Détecter le dossier openstrat (si pas fourni en argument)
# ─────────────────────────────────────────────────────────────

if [ -z "$OPENSTRAT_DIR" ]; then
    echo "🔍  Détection de l'installation OpenStrat..."
fi

# Méthode 1 : via ~/.openstrat-path (créé par la nouvelle version)
OPENSTRAT_DIR=${OPENSTRAT_DIR:-""}
if [ -f "$HOME/.openstrat-path" ]; then
    OPENSTRAT_DIR=$(cat "$HOME/.openstrat-path")
fi

# Méthode 2 : via l'alias dans le shell
if [ -z "$OPENSTRAT_DIR" ] || [ ! -d "$OPENSTRAT_DIR" ]; then
    # Chercher dans .zshrc ou .bashrc
    for RC_FILE in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
        if [ -f "$RC_FILE" ]; then
            # Extraire le chemin de l'alias (gère les espaces et guillemets simples/doubles)
            ALIAS_LINE=$(grep 'alias openstrat=' "$RC_FILE" 2>/dev/null | head -1)
            if [ -n "$ALIAS_LINE" ]; then
                # Extraire le chemin entre cd et &&
                ALIAS_PATH=$(echo "$ALIAS_LINE" | sed -n 's/.*cd "\(.*\)" *&&.*/\1/p')
                if [ -z "$ALIAS_PATH" ]; then
                    ALIAS_PATH=$(echo "$ALIAS_LINE" | sed -n "s/.*cd '\(.*\)' *&&.*/\1/p")
                fi
                if [ -n "$ALIAS_PATH" ] && [ -d "$ALIAS_PATH" ] && [ -f "$ALIAS_PATH/server.js" ]; then
                    OPENSTRAT_DIR="$ALIAS_PATH"
                    echo "    ✅ Trouvé via l'alias ($RC_FILE)"
                    break
                fi
            fi
        fi
    done
fi

# Méthode 3 : chercher dans les dossiers courants
if [ -z "$OPENSTRAT_DIR" ] || [ ! -d "$OPENSTRAT_DIR" ]; then
    COMMON_DIRS=(
        "$HOME/openstrat"
        "$HOME/Desktop/openstrat"
        "$HOME/Documents/openstrat"
        "$HOME/Projects/openstrat"
        "$HOME/Dev/openstrat"
    )
    
    # Chercher aussi dans le dossier parent de config.json si trouvé
    if [ -f "$HOME/.openstrat-path" ]; then
        PARENT_DIR=$(dirname "$(cat "$HOME/.openstrat-path")")
        if [ -d "$PARENT_DIR/openstrat" ]; then
            COMMON_DIRS+=("$PARENT_DIR/openstrat")
        fi
    fi
    
    for DIR in "${COMMON_DIRS[@]}"; do
        if [ -d "$DIR" ] && [ -f "$DIR/server.js" ]; then
            OPENSTRAT_DIR="$DIR"
            echo "    ✅ Trouvé à : $OPENSTRAT_DIR"
            break
        fi
    done
fi

if [ -z "$OPENSTRAT_DIR" ] || [ ! -d "$OPENSTRAT_DIR" ]; then
    echo ""
    echo "❌  OpenStrat introuvable automatiquement."
    echo ""
    echo "    Où est installé OpenStrat sur votre ordinateur ?"
    echo "    (le dossier qui contient server.js, public/, etc.)"
    echo ""
    echo "    💡 Astuce : vous pouvez copier le dossier depuis Finder"
    echo "       Clic droit → Option → Copier le chemin d'accès"
    echo ""
    read -rp "    Collez le chemin complet ici : " MANUAL_PATH
    
    # Enlever les éventuels guillemets ou espaces en début/fin
    MANUAL_PATH=$(echo "$MANUAL_PATH" | sed 's/^["'"'"']*//;s/["'"'"']*$//' | sed 's/^ *//;s/ *$//')
    
    if [ -z "$MANUAL_PATH" ] || [ ! -f "$MANUAL_PATH/server.js" ]; then
        echo ""
        echo "❌  Chemin invalide ou server.js non trouvé."
        echo "    Chemin testé : '$MANUAL_PATH'"
        echo ""
        echo "    Vérifiez que le chemin contient bien les fichiers :"
        echo "    - server.js"
        echo "    - public/"
        echo "    - package.json"
        echo ""
        echo "    Exemple de chemin valide :"
        echo "    /Users/votrenom/Desktop/Mes projets IA/Listabiere/openstrat"
        echo ""
        echo "    Abandon."
        exit 1
    fi
    
    OPENSTRAT_DIR="$MANUAL_PATH"
fi

# Normaliser en chemin absolu
OPENSTRAT_DIR=$(cd "$OPENSTRAT_DIR" && pwd)

echo ""
echo "📁  Dossier OpenStrat détecté : $OPENSTRAT_DIR"
echo ""

# ─────────────────────────────────────────────────────────────
# 2. Vérifier que c'est bien un repo git
# ─────────────────────────────────────────────────────────────

if [ ! -d "$OPENSTRAT_DIR/.git" ]; then
    echo "❌  Ce dossier ne semble pas être un repository git."
    echo "    Impossible de faire la mise à jour automatique."
    echo ""
    echo "    Solution : réinstallez OpenStrat avec :"
    echo "    curl -fsSL https://raw.githubusercontent.com/benskls/openstrat/main/install.sh | bash"
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# 3. Sauvegarder la configuration actuelle
# ─────────────────────────────────────────────────────────────

echo "💾  Sauvegarde de la configuration..."

BACKUP_DIR="$HOME/.openstrat-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Sauvegarder config.json
if [ -f "$OPENSTRAT_DIR/config.json" ]; then
    cp "$OPENSTRAT_DIR/config.json" "$BACKUP_DIR/"
    echo "    ✅ config.json sauvegardé"
fi

# Sauvegarder les modifs locales non commitées
if [ -n "$(cd "$OPENSTRAT_DIR" && git status --porcelain 2>/dev/null)" ]; then
    (cd "$OPENSTRAT_DIR" && git stash push -m "auto-backup-before-update-$(date +%Y%m%d)")
    echo "    ✅ Modifications locales sauvegardées (git stash)"
fi

echo "    📂 Backup dans : $BACKUP_DIR"
echo ""

# ─────────────────────────────────────────────────────────────
# 4. Mettre à jour via git
# ─────────────────────────────────────────────────────────────

echo "📥  Téléchargement de la dernière version..."

cd "$OPENSTRAT_DIR"

# Stocker la branche actuelle
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

# Récupérer les dernières modifications
git fetch origin

# Vérifier s'il y a des conflits potentiels
LOCAL_COMMITS=$(git rev-list HEAD...origin/main --count 2>/dev/null || echo "0")
if [ "$LOCAL_COMMITS" != "0" ]; then
    echo ""
    echo "⚠️   Vous avez des modifications locales qui pourraient entrer en conflit."
    echo "    Les modifications ont été sauvegardées dans le stash."
    echo ""
fi

# Pull la dernière version
git pull origin main

echo ""
echo "✅  Code mis à jour !"
echo ""

# ─────────────────────────────────────────────────────────────
# 5. Réinstaller les dépendances
# ─────────────────────────────────────────────────────────────

echo "📦  Mise à jour des dépendances..."
npm install

echo ""
echo "✅  Dépendances à jour !"
echo ""

# ─────────────────────────────────────────────────────────────
# 6. Mettre à jour ~/.openstrat-path
# ─────────────────────────────────────────────────────────────

echo "$OPENSTRAT_DIR" > "$HOME/.openstrat-path"
echo "📝  Chemin d'installation mis à jour dans ~/.openstrat-path"
echo ""

# ─────────────────────────────────────────────────────────────
# 7. Mettre à jour l'alias shell (si ancien format détecté)
# ─────────────────────────────────────────────────────────────

echo "🔧  Vérification de l'alias shell..."

SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_RC="$HOME/.bash_profile"
fi

if [ -n "$SHELL_RC" ]; then
    # Vérifier si l'alias existe encore (ancien format)
    if grep -q 'alias openstrat=' "$SHELL_RC" 2>/dev/null; then
        # Supprimer l'ancien alias
        sed -i '' '/# OpenStrat/d' "$SHELL_RC" 2>/dev/null || sed -i '/# OpenStrat/d' "$SHELL_RC"
        sed -i '' '/alias openstrat=/d' "$SHELL_RC" 2>/dev/null || sed -i '/alias openstrat=/d' "$SHELL_RC"
        
        # Ajouter la nouvelle fonction (si pas déjà présente)
        if ! grep -q '^openstrat()' "$SHELL_RC" 2>/dev/null; then
            cat >> "$SHELL_RC" <<'LAUNCHER_EOF'

# OpenStrat — Lanceur dynamique
openstrat() {
    local install_dir
    if [ -f "$HOME/.openstrat-path" ]; then
        install_dir=$(cat "$HOME/.openstrat-path")
    fi
    if [ -z "$install_dir" ] || [ ! -f "$install_dir/server.js" ]; then
        echo "❌ OpenStrat introuvable. Réinstallez ou mettez à jour ~/.openstrat-path"
        return 1
    fi
    cd "$install_dir" && npm start
}
LAUNCHER_EOF
            echo "    ✅ Alias mis à jour en fonction dynamique dans $SHELL_RC"
        fi
    elif ! grep -q '^openstrat()' "$SHELL_RC" 2>/dev/null; then
        # Pas d'alias ni de fonction — ajouter la fonction
        cat >> "$SHELL_RC" <<'LAUNCHER_EOF'

# OpenStrat — Lanceur dynamique
openstrat() {
    local install_dir
    if [ -f "$HOME/.openstrat-path" ]; then
        install_dir=$(cat "$HOME/.openstrat-path")
    fi
    if [ -z "$install_dir" ] || [ ! -f "$install_dir/server.js" ]; then
        echo "❌ OpenStrat introuvable. Réinstallez ou mettez à jour ~/.openstrat-path"
        return 1
    fi
    cd "$install_dir" && npm start
}
LAUNCHER_EOF
        echo "    ✅ Fonction de lancement ajoutée dans $SHELL_RC"
    else
        echo "    ✅ Lanceur déjà à jour"
    fi
else
    echo "    ⚠️  Fichier de config shell non trouvé (.zshrc / .bashrc)"
    echo "       Vous devrez peut-être recréer l'alias manuellement."
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 8. Vérifier la configuration parentDir
# ─────────────────────────────────────────────────────────────

if [ -f "$OPENSTRAT_DIR/config.json" ]; then
    PARENT_DIR=$(grep '"parentDir"' "$OPENSTRAT_DIR/config.json" | sed -E 's/.*"parentDir"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
    if [ -n "$PARENT_DIR" ] && [ -d "$PARENT_DIR" ]; then
        echo "📁  Dossier racine configuré : $PARENT_DIR"
        echo "    (vos projets sont ici, rien n'a été modifié)"
    fi
fi

echo ""

# ─────────────────────────────────────────────────────────────
# 9. Instructions finales
# ─────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║   ✅  Mise à jour terminée !                              ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📝  Prochaines étapes :"
echo ""
echo "    1. Rechargez votre terminal ou exécutez :"
echo "       source $SHELL_RC"
echo ""
echo "    2. Lancez OpenStrat :"
echo "       openstrat"
echo ""
echo "    3. Videz le cache de votre navigateur :"
echo "       Cmd + Shift + R  (Mac)"
echo "       Ctrl + Shift + R (Windows)"
echo ""
echo "    4. Vous devriez voir :"
echo "       • L'onglet 'Config' dans la sidebar"
echo "       • La détection de mises à jour"
echo "       • Les nouvelles fonctionnalités"
echo ""
echo "💾  Backup créé dans : $BACKUP_DIR"
echo "    (au cas où vous voudriez restaurer quelque chose)"
echo ""
echo "🆘  En cas de problème :"
echo "    - Restaurez le backup : cp \"$BACKUP_DIR/config.json\" \"$OPENSTRAT_DIR/\""
echo "    - Signalez un bug : https://github.com/benskls/openstrat/issues"
echo ""
