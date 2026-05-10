# Skill — Session Start : {{PROJECT_NAME}}

> Projet : {{PROJECT_NAME}}  
> Type : {{PROJECT_TYPE}}

---

## Quand utiliser

Utiliser ce skill à chaque début de session de travail sur le projet **{{PROJECT_NAME}}**, qu'il s'agisse d'une session de développement, de stratégie, de review ou de planification.

---

## Inputs attendus

Avant de démarrer, l'agent doit disposer des informations suivantes :
- Durée approximative de la session
- Type de session (dev, design, stratégie, debug, etc.)
- Contraintes ou contexte spécifique (deadline, blocage, opportunité)

---

## Checklist de début de session

### 1. Relire la vision
- [ ] Ouvrir `docs/PICTURE.md`
- [ ] Vérifier que l'objectif de la session est aligné avec l'horizon {{HORIZON}}

### 2. Contrôler l'état d'avancement
- [ ] Ouvrir `progress.md`
- [ ] Identifier les chantiers en cours et leur statut
- [ ] Repérer les blocages ou risques mentionnés

### 3. Consulter la roadmap
- [ ] Ouvrir `roadmap.md`
- [ ] Vérifier le jalon en cours et les dépendances

### 4. Choisir 1 à 3 objectifs
- [ ] Définir l'objectif principal (doit être atteignable dans la durée de la session)
- [ ] Définir 1 ou 2 objectifs secondaires (optionnels)
- [ ] S'assurer que ces objectifs avancent la résolution de **{{KEY_PROBLEM}}** pour **{{TARGET_AUDIENCE}}**

---

## Output attendu

En sortie de ce skill, l'agent doit produire un résumé structuré :

```text
## Session Start — {{PROJECT_NAME}}
Date : AAAA-MM-JJ HH:MM

### Objectifs
1. [Objectif principal]
2. [Objectif secondaire 1]
3. [Objectif secondaire 2]

### Contexte
- Jalon actuel : [JXX]
- Chantier en cours : [CXX]
- Risques / Blocages identifiés : [Liste]

### Plan d'action
1. [Étape 1]
2. [Étape 2]
3. [Étape 3]
```
