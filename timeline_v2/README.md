# Widget Timeline Grist Native — Vue chronologique avancée pour Grist (TypeScript)

Widget personnalisé moderne pour [Grist](https://grist.numerique.gouv.fr/) offrant une vue chronologique et de planification hautement réactive, développé en **TypeScript**, s'appuyant sur les composants **Shoelace**, le moteur **vis-timeline**, et une gestion d'état réactive avec **GrainJS** et **RxJS**.

---

## Fonctionnalités

- 📅 **Visualisation temporelle dynamique & réactive** :
  - Moteur vis-timeline performant capable d'afficher de gros volumes de données.
  - Échelle de temps configurable à la volée (*jour, semaine, mois, année*).
- 🎨 **Composants d'interface modernes (Shoelace)** :
  - Tiroir latéral d'informations (*sl-drawer*) pour inspecter les détails de chaque élément.
  - Interrupteurs interactifs (*sl-switch*) :
    - **Edit card** : Édition rapide directe des cartes.
    - **Confirm changes** : Confirmation avant sauvegarde.
    - **Focus on select** : Recentrage automatique de la timeline lors de la sélection d'un élément.
  - Boutons d'action (*sl-icon-button*) : Réglages d'ajustement global (`fit`) et repliement/dépliement des groupes.
  - Retours visuels avec alertes animées (*sl-alert*) et indicateurs de chargement (*sl-spinner*).
- 🗂️ **Gestion avancée des groupes & en-têtes redimensionnables** :
  - En-tête de colonnes synchronisé avec le volet gauche.
  - Possibilité de replier ou déployer les groupes avec animation fluide.
  - Bouton d'ajout rapide direct dans le groupe.
- 🎯 **Curseur temporel interactif** :
  - Surlignage au survol de la zone temporelle et du groupe correspondant.
  - Double-clic pour création rapide avec retour visuel immédiat.
- ⌨️ **Menu contextuel & Raccourcis** :
  - Menu contextuel personnalisé clic droit (`vanilla-context-menu`).
- ⚡ **100% Autonome & Single-File** :
  - Bundle unique `dist/index.html` compilé par Vite.
  - Icônes Shoelace vectorielles directement encapsulées en Data URIs, sans aucun asset externe à charger.

---

## Installation dans Grist

### Option 1 : URL hébergée (Recommandée)

1. Dans votre document Grist, ajoutez une vue : **Ajouter un widget → Personnalisé (Custom)**.
2. Dans le volet latéral droit, choisissez **Custom URL**.
3. Renseignez l'URL : `https://dnum-mi.github.io/pfsf-grist-widgets/timeline_v2/dist/`
4. Définissez le niveau d'accès sur **Full document access** (nécessaire pour l'inspection des schémas de table et les écritures dans Grist).
5. Configurez le mapping des colonnes selon vos besoins.

### Option 2 : Installation autonome

Copiez l'intégralité du fichier autonome produit [`dist/index.html`](./dist/index.html) dans le *Custom Widget Builder* de Grist. Aucune dépendance externe requise.

---

## 📋 Configuration des colonnes (Mapping Grist)

Le widget gère nativement les colonnes de type **Date** et **DateTime** de Grist sans nécessiter de conversion artificielle :

| Champ dans le widget | Type Grist attendu | Requis | Description & Comportement |
| -------------------- | ------------------ | ------ | -------------------------- |
| **From / Start Date** | `Date` ou `DateTime` | **Oui** | Date de début. Si le type est `Date`, démarre automatiquement à 00:00:00. |
| **To / End Date** | `Date` ou `DateTime` | Non | Date de fin. Si non renseigné, prend automatiquement la fin du jour de début (23:59:59) pour former un jour plein. |
| **Group by** | Tout type (multiple) | Non | Colonne(s) de groupement (ex: Projet, Équipe, Statut). Si non configuré, tous les éléments apparaissent dans une ligne par défaut. |
| **Title / Label** | `Text`, etc. (multiple) | Non | Titre affiché sur la barre chronologique. |
| **Readonly** | `Bool` | Non | Si vrai, verrouille l'élément en lecture seule (interdit le drag & drop). |
| **Group Info** | Tout type (multiple) | Non | Métadonnées supplémentaires affichées dans le tiroir de groupe. |
| **Item Info** | Tout type (multiple) | Non | Métadonnées supplémentaires affichées dans le tiroir de l'élément sélectionné. |

---

## Architecture du widget

Le widget est intégralement typé en TypeScript, modularisé et autonome :

```text
timeline_v2/
├── src/
│   ├── index.html       # Point d'entrée HTML
│   ├── index.ts         # Point d'entrée TypeScript & initialisation Grist
│   ├── widget-info.ts   # Métadonnées, gestion de version et mode DEV
│   ├── vendor.ts        # Intégration Shoelace & inlining des icônes SVG
│   ├── cursor.ts        # Gestion du curseur interactif et surlignage temporel
│   ├── header.ts        # Surveillance et rendu adaptatif des en-têtes de colonnes
│   ├── lib.ts           # Utilitaires de données, observables GrainJS et API Grist
│   ├── style.css        # Point d'entrée CSS principal
│   ├── pre.css          # Styles initiaux & état de chargement
│   ├── post.css         # Styles de surcharge du moteur vis-timeline & grille
│   ├── vite-env.d.ts    # Déclarations de types Vite & imports SVG bruts
│   └── icons/           # Icônes SVG Shoelace inlinées (Data URIs)
├── dist/
│   └── index.html       # Bundle de production tout-en-un généré par le build
├── tsconfig.json        # Configuration TypeScript (Bundler / ESNext)
├── vite.config.js       # Configuration Vite (HTTP local port 5177 + plugin singlefile)
├── package.json         # Dépendances, métadonnées Grist et scripts npm
└── README.md
```

> **Note** : Les configurations de linting ([`eslint.config.js`](../eslint.config.js)) et de formatage ([`.prettierrc`](../.prettierrc)) sont partagées à la racine du dépôt.

---

## Développement local

```bash
# 1. Installer les dépendances du widget
npm install

# 2. Démarrer le serveur de dev en HTTP
npm run dev
# -> http://localhost:5177/

# 3. Linter le code TypeScript et les styles
npm run lint
npm run lint:fix

# 4. Formater le code avec Prettier
npm run format

# 5. Compiler pour la production (génère dist/index.html 100% autonome)
npm run build

# 6. Prévisualiser le build de production
npm run preview
```

### Tester dans Grist en local

1. Lancez `npm run dev`
2. Dans votre document Grist en ligne ou local, ajoutez un widget personnalisé (*Custom URL*)
3. Renseignez l'URL locale : `http://localhost:5177/`
4. Les modifications effectuées dans `src/` sont répercutées instantanément via HMR.

---

## Gestion des versions & Releases

Le versionnement suit la convention [SemVer](https://semver.org/) (`MAJOR.MINOR.PATCH`).

### Visibilité de la version

- **Métadonnées** :
  - Balise HTML `<meta name="widget-version" content="0.1.0" />`
  - Métadonnées Grist dans `package.json` (`grist.version`)
  - Objet runtime global `window.__WIDGET__.version`
- **En Production** : Affichée discrètement dans la barre de statut sous la forme `v0.1.0`.
- **En Développement (`npm run dev`)** :
  - Badge orange bien visible : `🛠️ DEV v0.1.0`
  - Titre de la page préfixé par `[DEV]`
  - Bannière d'information dans la console navigateur (`[Timeline Grist Native] Running in DEVELOPMENT mode — 0.1.0`)

### Publier une nouvelle version

```bash
# 1. Incrémenter la version (met à jour package.json et grist.version automatiquement)
npm version patch   # 0.1.0 -> 0.1.1 (correctif)
npm version minor   # 0.1.0 -> 0.2.0 (nouvelle fonctionnalité)
npm version major   # 0.1.0 -> 1.0.0 (changement majeur)

# 2. Reconstruire le bundle autonome
npm run build

# 3. Pousser les commits et le tag vers GitHub
git push origin main --follow-tags
```
