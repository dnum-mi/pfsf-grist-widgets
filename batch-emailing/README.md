# Grist Batch Email Widget

A custom widget for Grist that enables batch email composition with BCC recipients management. This widget allows you to easily compose emails to multiple recipients while maintaining privacy through BCC, with additional features for managing your recipient list.

[🔗 Try it here](https://docs.getgrist.com/6wF1LMEkA2J6/Custom-Widget-Portfolio/p/1)

---

## Features

- 📧 Compose emails to multiple recipients using BCC
- ✂️ Remove/restore recipients from the mailing list
- ➕ Manually add additional recipients
- 🔄 Real-time recipient count updates
- 👥 Combined recipients list for table contacts and manually added contacts (with a visual "Manual" badge)
- 📝 Full email composition (reply-to, subject, content)
- 📄 Auto-fill subject & content from table column (optional) — Use `[Subject]` at the beginning of your content
- 🌐 Multi-language support — Switch between English and French
- 📨 Opens in your default email client for final review and sending

---

## Installation

### Option 1: Direct Repository Link (Recommended)

1. Create a new custom URL widget in your Grist document
2. Use this URL as the widget source: `https://dnum-mi.github.io/pfsf-grist-widgets/batch-emailing/dist/` (or `https://dnum-mi.github.io/pfsf-grist-widgets/batch-emailing/`)
3. Set access to **Read table**
4. Configure the widget to connect to your table columns

### Option 2: Standalone Installation

1. Create a new custom widget in your Grist document using the Custom Widget Builder
2. Copy the content of the pre-built [`dist/index.html`](./dist/index.html) file into the widget builder. It bundles all HTML, CSS, and JS into a single self-contained file with no external dependencies required.

---

## Setup & Column Mapping

- **Email Column** (required): Map your email column in the widget configuration
- **Content Column** (optional): Map a column containing email content to auto-fill the message
- The widget will automatically load emails from the mapped column and split comma-separated emails

---

## Usage

### 1. Content and Subject Auto-Fill

- **Simple Content**: Just write your email content in the Content Column
- **With Auto Subject**: Start your content with `[Your Subject Here]` followed by your message
  ```
  [Meeting Reminder] Don't forget about our meeting tomorrow at 2 PM.
  ```
- The widget will automatically extract the subject from brackets and fill both fields

### 2. Managing Recipients

- Remove recipients by clicking the × button
- Restore removed recipients from the "Removed Recipients" section
- Add additional recipients manually using the input field
- Multiple emails per cell: Use comma-separated format like `email1@domain.com, email2@domain.com`

### 3. Multi-Language Support

- Click the language flag in the top-right corner to switch between English and French
- Your language preference is automatically saved in `localStorage`

### 4. Filtering Recipients

- Apply filters to your table view to filter the recipient list
- The widget will update automatically to reflect the filtered data

---

## Architecture

This widget is completely autonomous and decoupled:

```text
batch-emailing/
├── src/
│   ├── index.html       # HTML entry point
│   ├── style.css        # Widget styling
│   ├── widget-info.js   # Metadata, version handling and DEV mode
│   └── script.js        # Core widget logic (DOM, email handling, i18n)
├── dist/
│   └── index.html       # Self-contained bundled production file
├── vite.config.js       # Vite config (local HTTP port 5175 + singlefile plugin)
├── package.json         # Local dependencies, scripts and Grist metadata
└── README.md
```

> **Note**: Linting ([`eslint.config.js`](../eslint.config.js)) and formatting ([`.prettierrc`](../.prettierrc)) configurations are shared at the repository root.

---

## Local Development

```bash
# 1. Install widget dependencies
npm install

# 2. Start local dev server with HTTP
npm run dev
# -> http://localhost:5175/

# 3. Run linter
npm run lint
npm run lint:fix

# 4. Format code with Prettier
npm run format

# 5. Build for production (outputs single-file dist/index.html)
npm run build

# 6. Preview production build
npm run preview
```

---

## Versioning & Releases

This widget follows the [SemVer](https://semver.org/) specification (`MAJOR.MINOR.PATCH`).

### Version Visibility

- **Metadata**:
  - HTML tag `<meta name="widget-version" content="1.1.0" />`
  - Grist metadata in `package.json` (`grist.version`)
  - Global runtime object `window.__WIDGET__.version`
- **In Production**: Discreetly shown at the bottom-left of the footer as `v1.1.0`.
- **In Development (`npm run dev`)**:
  - Prominent orange badge in the header: `🛠️ DEV v1.1.0`
  - Page title prefixed with `[DEV]`
  - Console banner in browser DevTools

### Releasing a New Version

```bash
# 1. Bump version (automatically updates package.json and grist.version)
npm version patch   # 1.1.0 -> 1.1.1 (bug fixes)
npm version minor   # 1.1.0 -> 1.2.0 (new features)
npm version major   # 1.1.0 -> 2.0.0 (breaking changes)

# 2. Rebuild the standalone production bundle
npm run build

# 3. Push commits and tags to GitHub
git push origin main --follow-tags
```

---

## Crédits

Ce widget est basé sur le travail d'[amandinedug](https://github.com/amandinedug) issu du dépôt [grist-custom-widgets (batch-emailing)](https://github.com/amandinedug/grist-custom-widgets/tree/main/batch-emailing).
