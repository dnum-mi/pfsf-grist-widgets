# Widget Accordillon — Vue groupée pour Grist

Widget personnalisé pour Grist offrant une vue groupée et pliable (accordéon) des enregistrements d'une table avec tri dynamique, personnalisation des couleurs et synchronisation du curseur.

---

## Fonctionnalités

- 📂 **Groupement dynamique** : Sélectionnez n'importe quelle colonne pour regrouper instantanément vos lignes.
- ↕️ **Tri flexible** : Tri alphabétique (A→Z, Z→A) ou par fréquence (Nb ↓, Nb ↑).
- 🎨 **Palette de couleurs intelligente** :
  - Palette par défaut ou sélection personnalisée par groupe.
  - Récupération et synchronisation avec les couleurs de colonnes configurées dans Grist.
- 🔘 **Formatage des booléens** : Choix du mode d'affichage pour les colonnes booléennes (badges ✔/✖, Oui/Non, pastilles colorées).
- 📏 **Hauteur maximale ajustable** : Contrôle de la hauteur maximale des groupes avec défilement interne.
- 🎯 **Synchronisation bidirectionnelle du curseur** : Cliquer sur une ligne dans le widget sélectionne automatiquement la ligne correspondante dans Grist (`grist.setCursorPos`).
- 💾 **Persistance** : Tous les réglages (colonne de groupement, tri, couleurs, format booléen, hauteur) sont sauvegardés par document via `grist.setOption`.

---

## Installation dans Grist

### Option 1 : URL hébergée (Recommandée)

1. Dans votre document Grist, ajoutez une vue personnalisée : **Ajouter un widget → Personnalisé (Custom)**.
2. Dans le panneau latéral, choisissez **Custom URL**.
3. Renseignez l'URL : `https://dnum-mi.github.io/pfsf-grist-widgets/accordillon/dist/`
4. Définissez l'accès sur **Full document access** (pour permettre la lecture des couleurs de colonnes Grist) ou **Read table**.
5. Liez le widget à la table de données de votre choix.

### Option 2 : Installation autonome

Copiez l'intégralité du fichier produit [`dist/index.html`](./dist/index.html) dans le _Custom Widget Builder_ de Grist. Aucune dépendance externe n'est requise.

---

## Architecture du widget

Ce widget est 100% autonome et découplé :

```text
accordillon/
├── src/
│   ├── index.html       # Point d'entrée HTML
│   ├── style.css        # Styles CSS
│   ├── widget-info.js   # Métadonnées, gestion de version et mode DEV
│   └── main.js          # Logique applicative JavaScript
├── dist/
│   └── index.html       # Fichier de production tout-en-un généré par build
├── vite.config.js       # Configuration Vite (HTTP local port 5174 + singlefile)
├── package.json         # Dépendances locales, métadonnées Grist et scripts npm
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
# -> http://localhost:5174/

# 3. Linter le code des sources
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
3. Renseignez l'URL locale : `http://localhost:5174/`
4. Les modifications effectuées dans `src/` sont répercutées instantanément via HMR.

---

## Gestion des versions & Releases

Le versionnement suit la convention [SemVer](https://semver.org/) (`MAJOR.MINOR.PATCH`).

### Visibilité de la version

- **Métadonnées** :
  - Balise HTML `<meta name="widget-version" content="1.1.0" />`
  - Métadonnées Grist dans `package.json` (`grist.version`)
  - Objet global `window.__WIDGET__.version`
- **En Production** : Affichée discrètement au bas du panneau de réglages (icône ⚙️) sous la forme `v1.1.0`.
- **En Développement (`npm run dev`)** :
  - Badge orange bien visible dans la barre d'outils : `🛠️ DEV v1.1.0`
  - Titre de la page préfixé par `[DEV]`
  - Bannière d'information dans la console navigateur

### Publier une nouvelle version

```bash
# 1. Incrémenter la version (met à jour package.json et grist.version automatiquement)
npm version patch   # 1.1.0 -> 1.1.1 (correctif)
npm version minor   # 1.1.0 -> 1.2.0 (nouvelle fonctionnalité)
npm version major   # 1.1.0 -> 2.0.0 (changement majeur)

# 2. Reconstruire le bundle autonome
npm run build

# 3. Pousser les commits et le tag vers GitHub
git push origin main --follow-tags
```
