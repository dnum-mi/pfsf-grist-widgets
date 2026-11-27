# Widget Timeline — Vue chronologique & Gantt pour Grist

Widget personnalisé pour [Grist](https://grist.numerique.gouv.fr/) offrant une vue chronologique et diagramme de Gantt interactif avec glisser-déposer, redimensionnement direct, groupement hiérarchique, synchronisation des couleurs et persistance des réglages.

---

## Fonctionnalités

- 📅 **Visualisation temporelle dynamique** : Affichez vos tâches, projets et jalons sous forme de barres horizontales claires et ordonnées.
- 🖐️ **Glisser-déposer (Drag & Drop) & Redimensionnement** :
  - Déplacez une barre pour translater ses dates tout en conservant sa durée.
  - Étirez les poignées gauche ou droite pour ajuster les dates de début ou de fin en temps réel.
  - Sauvegarde immédiate dans votre document Grist (`grist.selectedTable.update`).
- 🔍 **4 niveaux de zoom** :
  - **Jour** : Granularité fine au jour le jour.
  - **Semaine** : Vue hebdomadaire équilibrée.
  - **Mois** (défaut) : Planification mensuelle.
  - **Trimestre** : Vision stratégique à moyen terme.
- 🔴 **Bouton & Indicateur "Aujourd'hui"** : Recentrage instantané avec repère vertical rouge sur la date courante.
- 🗂️ **Groupement hiérarchique** : Regroupez vos tâches par catégorie, responsable, équipe ou statut (colonnes Choice / ChoiceList).
- 🎨 **Palette de couleurs intelligente** :
  - Récupération et synchronisation directe des couleurs de choix configurées dans Grist.
  - Palette native intégrée (bleu, vert, orange, rose, violet, rouge, jaune, gris).
- 📋 **Champs supplémentaires & Modale d'édition** :
  - Colonnes supplémentaires dans le tableau de gauche avec redimensionnement persistant (`colWidths`).
  - Textes d'information contextuels incrustés sur les barres.
  - Modale d'édition détaillée au clic ou via le clavier (`Entrée` / `Espace`).
- ⌨️ **Accessibilité clavier complète** :
  - Déplacement d'un jour : Flèches gauche/droite.
  - Redimensionnement : `Shift` + Flèches (fin) ou `Alt` + Flèches (début).
- ➕ **Création rapide** : Double-cliquez sur une ligne pour insérer un nouvel enregistrement pré-rempli.

---

## Installation dans Grist

### Option 1 : URL hébergée (Recommandée)

1. Dans votre document Grist, ajoutez une vue : **Ajouter un widget → Personnalisé (Custom)**.
2. Dans le volet latéral droit, choisissez **Custom URL**.
3. Renseignez l'URL : `https://dnum-mi.github.io/pfsf-grist-widgets/timeline/dist/`
4. Définissez le niveau d'accès sur **Full document access** (nécessaire pour la lecture des couleurs de colonnes et la mise à jour des dates).
5. Configurez le mapping des colonnes.

### Option 2 : Installation autonome

Copiez l'intégralité du fichier autonome produit [`dist/index.html`](./dist/index.html) dans le *Custom Widget Builder* de Grist. Aucune dépendance externe requise.

---

## Configuration des colonnes (Mapping)

| Champ Grist | Type | Obligatoire | Description |
| :--- | :--- | :---: | :--- |
| **Start date** | Date, DateTime | **Oui** | Date de début de la tâche/événement |
| **End date** | Date, DateTime | **Oui** | Date de fin de la tâche/événement |
| **Colour by** | Choice, ChoiceList | Non | Colonne déterminant la couleur de la barre |
| **Group by** | Choice, ChoiceList | Non | Colonne déterminant les sections de regroupement |
| **Extra fields (list)** | Tous | Non | Colonnes affichées dans le tableau de gauche |
| **Extra fields (on bar)** | Tous | Non | Informations textuelles incrustées sur la barre |
| **Editable fields (popup)**| Tous | Non | Champs modifiables directement dans la modale |

---

## Architecture du widget

Ce widget est 100% autonome et découplé :

```text
timeline/
├── src/
│   ├── index.html       # Point d'entrée HTML
│   ├── style.css        # Styles CSS de la vue timeline
│   ├── widget-info.js   # Métadonnées, gestion de version et mode DEV
│   └── main.js          # Logique interactive, drag & drop, API Grist
├── dist/
│   └── index.html       # Bundle de production tout-en-un généré par le build
├── vite.config.js       # Configuration Vite (HTTP local port 5176 + plugin singlefile)
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
# -> http://localhost:5176/

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
3. Renseignez l'URL locale : `http://localhost:5176/`
4. Les modifications effectuées dans `src/` sont répercutées instantanément via HMR.

---

## Gestion des versions & Releases

Le versionnement suit la convention [SemVer](https://semver.org/) (`MAJOR.MINOR.PATCH`).

### Visibilité de la version

- **Métadonnées** :
  - Balise HTML `<meta name="widget-version" content="1.0.0" />`
  - Métadonnées Grist dans `package.json` (`grist.version`)
  - Objet runtime global `window.__WIDGET__.version`
- **En Production** : Affichée discrètement à côté du titre principal sous la forme `v1.0.0`.
- **En Développement (`npm run dev`)** :
  - Badge orange bien visible : `🛠️ DEV v1.0.0`
  - Titre de la page préfixé par `[DEV]`
  - Bannière d'information dans la console navigateur (`[Timeline] Running in DEVELOPMENT mode — v1.0.0`)

### Publier une nouvelle version

```bash
# 1. Incrémenter la version (met à jour package.json et grist.version automatiquement)
npm version patch   # 1.0.0 -> 1.0.1 (correctif)
npm version minor   # 1.0.0 -> 1.1.0 (nouvelle fonctionnalité)
npm version major   # 1.0.0 -> 2.0.0 (changement majeur)

# 2. Reconstruire le bundle autonome
npm run build

# 3. Pousser les commits et le tag vers GitHub
git push origin main --follow-tags
```
