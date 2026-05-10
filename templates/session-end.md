# Skill — Session End : {{PROJECT_NAME}}

> Projet : {{PROJECT_NAME}}  
> Type : {{PROJECT_TYPE}}

---

## Quand utiliser

Utiliser ce skill à chaque fin de session de travail sur le projet **{{PROJECT_NAME}}**, avant de fermer l'IDE ou de changer de contexte. Ce skill permet de capitaliser sur le travail effectué et de préparer la session suivante.

---

## Inputs attendus

- Résumé des actions réalisées pendant la session
- Livrables produits (fichiers, code, documents, décisions)
- Blocages rencontrés ou risques identifiés
- Énergie / morale de l'équipe (optionnel mais utile)

---

## Checklist de fin de session

### 1. Noter les livrables
- [ ] Lister tous les fichiers créés ou modifiés
- [ ] Décrire les décisions prises pendant la session
- [ ] Lier les commits Git associés (si applicable)

### 2. Mettre à jour Progress
- [ ] Ouvrir `progress.md`
- [ ] Déplacer les chantiers terminés dans la section "Chantiers terminés"
- [ ] Mettre à jour le statut des chantiers en cours
- [ ] Ajouter de nouveaux chantiers au backlog si découverts

### 3. Identifier les blocages
- [ ] Noter tout problème technique ou produit bloquant
- [ ] Évaluer la gravité et proposer une mitigation
- [ ] Décider si un escalade humaine est nécessaire

### 4. Définir les priorités suivantes
- [ ] Choisir le prochain chantier à attaquer
- [ ] Vérifier les dépendances et les prérequis
- [ ] Estimer la charge de travail restante

---

## Output attendu

En sortie de ce skill, l'agent doit produire un résumé structuré :

```text
## Session End — {{PROJECT_NAME}}
Date : AAAA-MM-JJ HH:MM
Durée : X heures

### Livrables
- [Livrable 1] : [Description]
- [Livrable 2] : [Description]

### Mise à jour Progress
- Chantiers terminés : [Liste]
- Chantiers en cours : [Liste avec nouveau statut]
- Nouveaux backlog : [Liste]

### Blocages & Risques
- [Blocage 1] : [Gravité] / [Mitigation proposée]

### Priorités suivantes
1. [Prochain chantier] — [Raison]
2. [Chantier suivant] — [Raison]

### Notes
[Libre]
```
