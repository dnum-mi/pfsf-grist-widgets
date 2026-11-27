import './widget-info.js';

// Logique pure du widget « Vue groupée » : aucun accès au DOM ni à l'API Grist,
// pour que ces fonctions soient testables hors navigateur (voir test/).

const EMPTY_GROUP_KEY = '';

const DEFAULT_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1'
];

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/|www\.)[^\s]+$/i;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function safeColor(c, fallback = '#94a3b8') {
  return typeof c === 'string' && HEX_COLOR.test(c) ? c : fallback;
}

// Filtre les options stockées dans le document : seules des couleurs
// hexadécimales valides sont conservées, sur un objet sans prototype.
function sanitizeColors(raw) {
  const out = Object.create(null);
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_e) {
    return out;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && HEX_COLOR.test(v)) out[k] = v;
  }
  return out;
}

// Regroupe les enregistrements par la colonne groupBy, puis trie les groupes.
// Le groupe des valeurs vides est toujours placé en dernier, quel que soit le tri.
function groupRecords(records, groupBy, sortMode) {
  if (!groupBy) return [];
  const map = new Map();
  records.forEach((rec) => {
    const raw = rec[groupBy];
    const key = raw == null || raw === '' ? EMPTY_GROUP_KEY : String(raw);
    if (!map.has(key)) map.set(key, { key, label: raw, records: [] });
    map.get(key).records.push(rec);
  });
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    if (a.key === EMPTY_GROUP_KEY) return 1;
    if (b.key === EMPTY_GROUP_KEY) return -1;
    if (sortMode === 'alpha-asc') return String(a.label).localeCompare(String(b.label), 'fr');
    if (sortMode === 'alpha-desc') return String(b.label).localeCompare(String(a.label), 'fr');
    if (sortMode === 'count-desc') return b.records.length - a.records.length;
    if (sortMode === 'count-asc') return a.records.length - b.records.length;
    return 0;
  });
  return groups;
}

// Complète colColors : chaque groupe sans couleur reçoit une couleur de la palette.
// Modifie colColors sur place et le renvoie.
function assignDefaultColors(groups, colColors, palette = DEFAULT_PALETTE) {
  groups.forEach((g, i) => {
    if (!colColors[g.key]) colColors[g.key] = palette[i % palette.length];
  });
  return colColors;
}

// ── 1. Internationalisation (en premier — tout dépend de T) ──
const LANG = navigator.language.startsWith('fr') ? 'fr' : 'en';

const I18N = {
  fr: {
    groupBy: 'Grouper par',
    sortBy: 'Tri',
    expandAll: 'Tout déplier',
    collapseAll: 'Tout plier',
    settingsLabel: 'Réglages d’affichage',
    chooseCol: '— choisir —',
    sortAlphaAsc: 'A → Z',
    sortAlphaDesc: 'Z → A',
    sortCountDesc: 'Nb ↓',
    sortCountAsc: 'Nb ↑',
    sectionColors: 'Couleurs des groupes',
    sectionMaxH: 'Hauteur max par groupe',
    sectionBool: 'Affichage vrai / faux',
    reset: 'Réinitialiser',
    noGroups: 'Aucun groupe — choisis une colonne de groupement.',
    emptyTitle: 'Aucune colonne sélectionnée',
    emptySub: 'Choisis une colonne dans la barre ci-dessus<br>pour grouper les enregistrements.',
    emptyTitleNoRec: 'Aucun enregistrement',
    emptySubNoRec: 'La table sélectionnée ne contient aucun enregistrement.',
    groups: 'groupes',
    records: 'enregistrements',
    record: 'enregistrement',
    noOtherCol: 'Aucune autre colonne à afficher.',
    groupCaption: 'Groupe :',
    emptyGroup: '(vide)',
    colorLabel: 'Couleur du groupe',
    resetColorLabel: 'Réinitialiser la couleur du groupe',
    resetMaxH: 'Réinitialiser la hauteur maximale',
    boolFormatLabel: 'Format booléen :',
    ariaToolbar: 'Options de groupement',
    ariaSettings: 'Réglages d’affichage',
    ariaContent: 'Groupes d’enregistrements',
    ariaGroupRegion: 'Enregistrements — ',
    cellEmpty: 'valeur vide',
    boolTrue: ['✓ vrai', 'Oui', 'True', 'vrai', '1'],
    boolFalse: ['✗ faux', 'Non', 'False', 'faux', '0'],
    boolLabels: ['✓ / ✗', 'Oui / Non', 'True / False', '● badge', '1 / 0']
  },
  en: {
    groupBy: 'Group by',
    sortBy: 'Sort',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    settingsLabel: 'Display settings',
    chooseCol: '— choose —',
    sortAlphaAsc: 'A → Z',
    sortAlphaDesc: 'Z → A',
    sortCountDesc: 'Count ↓',
    sortCountAsc: 'Count ↑',
    sectionColors: 'Group colors',
    sectionMaxH: 'Max height per group',
    sectionBool: 'True / false display',
    reset: 'Reset',
    noGroups: 'No groups — choose a grouping column.',
    emptyTitle: 'No column selected',
    emptySub: 'Choose a column in the toolbar above<br>to group records.',
    emptyTitleNoRec: 'No records',
    emptySubNoRec: 'The selected table contains no records.',
    groups: 'groups',
    records: 'records',
    record: 'record',
    noOtherCol: 'No other column to display.',
    groupCaption: 'Group:',
    emptyGroup: '(empty)',
    colorLabel: 'Color of group',
    resetColorLabel: 'Reset color of group',
    resetMaxH: 'Reset maximum height',
    boolFormatLabel: 'Boolean format:',
    ariaToolbar: 'Grouping options',
    ariaSettings: 'Display settings',
    ariaContent: 'Record groups',
    ariaGroupRegion: 'Records — ',
    cellEmpty: 'empty value',
    boolTrue: ['✓ true', 'Yes', 'True', 'true', '1'],
    boolFalse: ['✗ false', 'No', 'False', 'false', '0'],
    boolLabels: ['✓ / ✗', 'Yes / No', 'True / False', '● badge', '1 / 0']
  }
};
const T = I18N[LANG];
document.documentElement.lang = LANG;

// ── 2. Constantes (utilisent T) ──────────────────────────

function makeBoolFormats() {
  return [
    {
      key: 'check',
      label: T.boolLabels[0],
      t: `<span style="color:#15803d;font-weight:500">${T.boolTrue[0]}</span>`,
      f: `<span style="color:#dc2626">${T.boolFalse[0]}</span>`
    },
    {
      key: 'oui',
      label: T.boolLabels[1],
      t: `<span style="color:#15803d;font-weight:500">${T.boolTrue[1]}</span>`,
      f: `<span style="color:#dc2626">${T.boolFalse[1]}</span>`
    },
    {
      key: 'tf',
      label: T.boolLabels[2],
      t: `<span style="color:#15803d;font-weight:500">${T.boolTrue[2]}</span>`,
      f: `<span style="color:#dc2626">${T.boolFalse[2]}</span>`
    },
    {
      key: 'badge',
      label: T.boolLabels[3],
      t: `<span style="display:inline-block;padding:1px 7px;border-radius:9px;background:#dcfce7;color:#166534;font-size:10px;font-weight:600">${T.boolTrue[3]}</span>`,
      f: `<span style="display:inline-block;padding:1px 7px;border-radius:9px;background:#fee2e2;color:#991b1b;font-size:10px;font-weight:600">${T.boolFalse[3]}</span>`
    },
    {
      key: 'num',
      label: T.boolLabels[4],
      t: '<span class="cell-num">1</span>',
      f: '<span class="cell-num cell-null">0</span>'
    }
  ];
}
const BOOL_FORMATS = makeBoolFormats();

// ── 3. État ───────────────────────────────────────────────
let allRecords = [];
let allColumns = [];
let groupBy = '';
let sortMode = 'alpha-asc';
let collapsed = new Set();
// Object.create(null) : pas de prototype, donc pas de clé héritée
// (un groupe nommé "constructor" ou "toString" renverrait sinon une fonction native)
let colColors = Object.create(null);
let boolFmtKey = 'check';
let maxGroupH = 500;
let selectedRowId = null;
let colSettings = Object.create(null);
let ruleValuesByRowId = new Map();

// ── 4. Refs DOM ───────────────────────────────────────────
const groupSelect = document.getElementById('group-select');
const sortSelect = document.getElementById('sort-select');
const content = document.getElementById('content');
const statsbar = document.getElementById('statsbar');
const emptyState = document.getElementById('empty-state');
const settingsPanel = document.getElementById('settings-panel');
const btnSettings = document.getElementById('btn-settings');
const colorGrid = document.getElementById('color-grid');
const boolRow = document.getElementById('bool-row');
let statGroups = document.getElementById('stat-groups');
let statRecords = document.getElementById('stat-records');

// ── 5. Appliquer i18n au DOM statique ─────────────────────
function applyI18nToDOM() {
  document.querySelector('label[for="group-select"]').textContent = T.groupBy;
  document.querySelector('label[for="sort-select"]').textContent = T.sortBy;
  document.getElementById('btn-expand').textContent = T.expandAll;
  document.getElementById('btn-collapse').textContent = T.collapseAll;
  document.getElementById('btn-settings').setAttribute('aria-label', T.settingsLabel);
  document.querySelector('#group-select option').textContent = T.chooseCol;
  const sortOpts = document.querySelectorAll('#sort-select option');
  sortOpts[0].textContent = T.sortAlphaAsc;
  sortOpts[1].textContent = T.sortAlphaDesc;
  sortOpts[2].textContent = T.sortCountDesc;
  sortOpts[3].textContent = T.sortCountAsc;
  document.getElementById('lbl-colors').textContent = T.sectionColors;
  document.getElementById('lbl-maxh').textContent = T.sectionMaxH;
  document.getElementById('lbl-bool').textContent = T.sectionBool;
  document.getElementById('btn-reset-maxh').textContent = T.reset;
  document.getElementById('btn-reset-maxh').setAttribute('aria-label', T.resetMaxH);
  document.querySelector('.toolbar').setAttribute('aria-label', T.ariaToolbar);
  document.getElementById('settings-panel').setAttribute('aria-label', T.ariaSettings);
  document.getElementById('content').setAttribute('aria-label', T.ariaContent);
  // Réécriture des spans de stats (preserve les ids)
  const statSpans = document.getElementById('statsbar').querySelectorAll(':scope > span');
  statSpans[0].innerHTML = '<span class="stat-val" id="stat-groups">0</span> ' + T.groups;
  statSpans[2].innerHTML = '<span class="stat-val" id="stat-records">0</span> ' + T.records;
  document.querySelector('.empty-title').textContent = T.emptyTitle;
  document.querySelector('.empty-sub').innerHTML = T.emptySub;
}
applyI18nToDOM();
statGroups = document.getElementById('stat-groups');
statRecords = document.getElementById('stat-records');

// ── 6. Utilitaires ────────────────────────────────────────
function hasBoolCol() {
  return allColumns
    .filter((c) => c !== groupBy)
    .some((c) => allRecords.some((r) => typeof r[c] === 'boolean'));
}

function refreshBoolSection() {
  const s = document.getElementById('bool-section');
  if (s) s.style.display = hasBoolCol() ? '' : 'none';
}

function applyMaxGroupH() {
  document.getElementById('app').style.setProperty('--max-group-h', maxGroupH + 'px');
}

function _updateStickyTop() {
  // No-op (layout is now fixed, kept for compatibility)
}

function saveColors() {
  grist.setOption('colColors', JSON.stringify(colColors));
}

// ── 7. Panneau de réglages — bouton ─────────────────────────
btnSettings.addEventListener('click', () => {
  const isOpen = settingsPanel.classList.toggle('open');
  btnSettings.classList.toggle('active', isOpen);
  btnSettings.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) {
    refreshColorGrid();
    refreshBoolSection();
  }
});

// ── 8. Formats booléens ────────────────────────────────────
function buildBoolButtons() {
  boolRow.innerHTML = '';
  BOOL_FORMATS.forEach((fmt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bool-btn' + (fmt.key === boolFmtKey ? ' selected' : '');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(fmt.key === boolFmtKey));
    btn.setAttribute('aria-label', T.boolFormatLabel + ' ' + fmt.label);
    btn.textContent = fmt.label;
    btn.addEventListener('click', () => {
      boolFmtKey = fmt.key;
      boolRow.querySelectorAll('.bool-btn').forEach((b) => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      grist.setOption('boolFmtKey', boolFmtKey);
      console.log('buildBoolButtons render');
      render();
    });
    boolRow.appendChild(btn);
  });
}

// ── 9. Grille de couleurs ─────────────────────────────────
function refreshColorGrid() {
  colorGrid.innerHTML = '';
  const groups = getGroups();
  if (groups.length === 0) {
    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:11px;color:var(--muted);font-style:italic';
    msg.textContent = T.noGroups;
    colorGrid.appendChild(msg);
    return;
  }
  groups.forEach((group, i) => {
    const isEmpty = group.key === EMPTY_GROUP_KEY;
    const label = isEmpty ? T.emptyGroup : String(group.label);
    const color = safeColor(colColors[group.key], DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]);

    const row = document.createElement('div');
    row.className = 'color-row';

    const wrap = document.createElement('div');
    wrap.className = 'color-input-wrap';

    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.background = color;
    swatch.setAttribute('aria-hidden', 'true');

    const input = document.createElement('input');
    input.type = 'color';
    input.value = color;
    input.setAttribute('aria-label', T.colorLabel + ' ' + label);
    input.addEventListener('input', () => {
      swatch.style.background = input.value;
    });
    input.addEventListener('change', () => {
      colColors[group.key] = input.value;
      swatch.style.background = input.value;
      saveColors();
      console.log('refreshcolorgrid onchange render');
      render();
    });

    wrap.appendChild(swatch);
    wrap.appendChild(input);

    const lbl = document.createElement('span');
    lbl.className = 'color-row-label' + (isEmpty ? ' is-empty' : '');
    lbl.textContent = label;

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn-reset-color';
    resetBtn.textContent = T.reset;
    resetBtn.setAttribute('aria-label', T.resetColorLabel + ' ' + label);
    resetBtn.addEventListener('click', () => {
      const def = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
      colColors[group.key] = def;
      input.value = def;
      swatch.style.background = def;
      saveColors();
      console.log('refreshcolorgrid onclick render');
      render();
    });

    row.appendChild(wrap);
    row.appendChild(lbl);
    row.appendChild(resetBtn);
    colorGrid.appendChild(row);
  });
}

// ── 10. Curseur hauteur max ───────────────────────────────
function initMaxHSlider() {
  const range = document.getElementById('maxh-range');
  const valSpan = document.getElementById('maxh-val');
  if (!range) return;
  range.value = maxGroupH;
  valSpan.textContent = maxGroupH + 'px';
  range.addEventListener('input', () => {
    valSpan.textContent = range.value + 'px';
  });
  range.addEventListener('change', () => {
    maxGroupH = parseInt(range.value);
    applyMaxGroupH();
    grist.setOption('maxGroupH', maxGroupH);
  });
  document.getElementById('btn-reset-maxh').addEventListener('click', () => {
    maxGroupH = 500;
    range.value = 500;
    valSpan.textContent = '500px';
    applyMaxGroupH();
    grist.setOption('maxGroupH', maxGroupH);
  });
  applyMaxGroupH();
}

// ── 11. Grist ────────────────────────────────────────────
grist.ready({
  requiredAccess: 'full',
  allowSelectBy: true,
  includeColumns: 'all',
  columns: [{ name: 'visibleCols', title: 'Champs visibles', allowMultiple: true, optional: true }]
});

grist.onRecord((record) => {
  selectedRowId = record ? record.id : null;
  document.querySelectorAll('.rec-table tbody tr').forEach((tr) => {
    tr.classList.toggle('selected', Number(tr.dataset.rowId) === selectedRowId);
  });
});

grist.onOptions((opts) => {
  console.log('grist option', opts);
  if (opts) {
    if (opts.groupBy) {
      groupBy = opts.groupBy;
      groupSelect.value = groupBy;
    }
    if (opts.sortMode) {
      sortMode = opts.sortMode;
      sortSelect.value = sortMode;
    }
    if (opts.boolFmtKey && BOOL_FORMATS.find((f) => f.key === opts.boolFmtKey))
      boolFmtKey = opts.boolFmtKey;
    if (opts.maxGroupH) {
      // bornes identiques à celles du curseur
      maxGroupH = Math.min(600, Math.max(80, parseInt(opts.maxGroupH) || 500));
      applyMaxGroupH(); /*  */
    }
    if (opts.colColors) colColors = sanitizeColors(opts.colColors);
  }
  buildBoolButtons();
  loadColumnSettings();
  console.log('render onOption');
  render();
});

grist.onRecords((records, mappings) => {
  allRecords = records || [];
  if (allRecords.length > 0) {
    if (mappings && Array.isArray(mappings.visibleCols) && mappings.visibleCols.length > 0) {
      allColumns = mappings.visibleCols;
    } else {
      allColumns = Object.keys(allRecords[0]).filter(
        (k) => k !== 'id' && k !== 'manualSort' && !k.startsWith('gristHelper_')
      );
    }
    rebuildColumnSelect();
    loadColumnSettings();
  }
  console.log('render onRecords');
  render();
});

content.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-row-id]');
  if (!tr) return;
  const rowId = Number(tr.dataset.rowId);
  selectedRowId = rowId;
  document.querySelectorAll('.rec-table tbody tr').forEach((row) => {
    row.classList.toggle('selected', row === tr);
  });
  grist.setCursorPos({ rowId });
});

buildBoolButtons();
initMaxHSlider();

// ── 12. Sélecteur de colonne ──────────────────────────────
function rebuildColumnSelect() {
  const prev = groupSelect.value;
  groupSelect.innerHTML = `<option value="">${T.chooseCol}</option>`;
  allColumns.forEach((col) => {
    const opt = document.createElement('option');
    opt.value = col;
    opt.textContent = col;
    groupSelect.appendChild(opt);
  });
  const target = groupBy || prev;
  if (target && allColumns.includes(target)) groupSelect.value = target;
}

groupSelect.addEventListener('change', () => {
  groupBy = groupSelect.value;
  collapsed.clear();
  grist.setOption('groupBy', groupBy);
  render();
  if (settingsPanel.classList.contains('open')) refreshColorGrid();
});

sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value;
  grist.setOption('sortMode', sortMode);
  render();
});

document.getElementById('btn-expand').addEventListener('click', () => {
  collapsed.clear();
  document.querySelectorAll('.group.collapsed').forEach((el) => {
    el.classList.remove('collapsed');
    el.querySelector('.group-header').setAttribute('aria-expanded', 'true');
  });
});

document.getElementById('btn-collapse').addEventListener('click', () => {
  getGroups().forEach((g) => collapsed.add(g.key));
  document.querySelectorAll('.group:not(.collapsed)').forEach((el) => {
    el.classList.add('collapsed');
    el.querySelector('.group-header').setAttribute('aria-expanded', 'false');
  });
});

// ── 13. Groupement ────────────────────────────────────────
function getGroups() {
  const groups = groupRecords(allRecords, groupBy, sortMode);
  assignDefaultColors(groups, colColors, DEFAULT_PALETTE);
  return groups;
}

function computeColGroup(cols, records) {
  const widths = cols.map((c) => {
    let maxLen = String(c).length;
    for (let i = 0; i < records.length; i++) {
      const t = cellTitle(records[i][c]);
      if (t.length > maxLen) maxLen = t.length;
    }
    return Math.min(280, Math.max(65, Math.round(maxLen * 7.5)));
  });
  return `<colgroup>${widths.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>`;
}

// ── 14. Rendu ─────────────────────────────────────────────
function render() {
  console.log('trigger render', render, groupBy);
  Array.from(content.children).forEach((c) => {
    if (c.id !== 'empty-state') c.remove();
  });

  if (!groupBy || allRecords.length === 0) {
    emptyState.style.display = '';
    emptyState.querySelector('.empty-title').textContent = !groupBy
      ? T.emptyTitle
      : T.emptyTitleNoRec;
    emptyState.querySelector('.empty-sub').innerHTML = !groupBy ? T.emptySub : T.emptySubNoRec;
    statsbar.classList.remove('visible');
    return;
  }

  emptyState.style.display = 'none';
  const groups = getGroups();
  const displayCols = allColumns.filter((c) => c !== groupBy);
  const colGroupHtml = displayCols.length > 0 ? computeColGroup(displayCols, allRecords) : '';

  statsbar.classList.add('visible');
  statGroups.textContent = groups.length;
  statRecords.textContent = allRecords.length;

  groups.forEach((group, i) => {
    const isCollapsed = collapsed.has(group.key);
    const isEmpty = group.key === EMPTY_GROUP_KEY;
    const dotColor = safeColor(colColors[group.key]);
    // labelRaw : texte brut, pour setAttribute() et buildTable() qui échappent eux-mêmes
    // labelTxt : version échappée, pour l'insertion en innerHTML
    const labelRaw = isEmpty ? T.emptyGroup : String(group.label);
    const labelTxt = esc(labelRaw);
    const labelCls = isEmpty ? 'group-label is-empty' : 'group-label';
    const bodyId = 'grp-' + i;

    const card = document.createElement('article');
    card.className = 'group' + (isCollapsed ? ' collapsed' : '');

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'group-header';
    header.setAttribute('aria-expanded', String(!isCollapsed));
    header.setAttribute('aria-controls', bodyId);
    header.innerHTML = `
        <svg class="chevron" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true" focusable="false">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span class="group-dot" style="background:${dotColor}" aria-hidden="true"></span>
        <span class="${labelCls}">${labelTxt}</span>
        <span class="group-badge"
              aria-label="${group.records.length}&nbsp;${group.records.length > 1 ? T.records : T.record}"
        >${group.records.length}</span>`;

    header.addEventListener('click', () => {
      if (collapsed.has(group.key)) {
        collapsed.delete(group.key);
        card.classList.remove('collapsed');
        header.setAttribute('aria-expanded', 'true');
      } else {
        collapsed.add(group.key);
        card.classList.add('collapsed');
        header.setAttribute('aria-expanded', 'false');
      }
    });

    const body = document.createElement('div');
    body.className = 'group-body';
    body.id = bodyId;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', T.ariaGroupRegion + labelRaw);

    const inner = document.createElement('div');
    inner.className = 'group-body-inner';
    inner.innerHTML =
      displayCols.length === 0
        ? `<p class="only-group-col">${T.noOtherCol}</p>`
        : buildTable(displayCols, group.records, labelRaw, colGroupHtml);

    body.appendChild(inner);
    card.appendChild(header);
    card.appendChild(body);
    content.appendChild(card);
  });
  refreshBoolSection();
}

function getCellStyle(rec, col) {
  const st = colSettings[col];
  if (!st) return '';

  let bg = st.fillColor;
  let fg = st.textColor;

  // Couleur d'une colonne Choix
  const val = rec[col];
  if (val && typeof val === 'string' && st.choiceOptions && st.choiceOptions[val]) {
    if (st.choiceOptions[val].fillColor) bg = st.choiceOptions[val].fillColor;
    if (st.choiceOptions[val].textColor) fg = st.choiceOptions[val].textColor;
  }

  // Règles conditionnelles (lues depuis le cache persistant par rowId)
  const rowRules = ruleValuesByRowId.get(rec.id) || rec;
  for (let i = 0; i < st.ruleColNames.length; i++) {
    if (rowRules[st.ruleColNames[i]] === true && st.rulesOptions[i]) {
      if (st.rulesOptions[i].fillColor) bg = st.rulesOptions[i].fillColor;
      if (st.rulesOptions[i].textColor) fg = st.rulesOptions[i].textColor;
    }
  }

  const css = [];
  if (st.alignment && st.alignment !== 'left') css.push(`text-align:${st.alignment}`);
  // if (rowRules["gristHelper_ConditionalRule3"])
  //   console.log("cell style:", bg, fg);
  if (bg) css.push(`background:${safeColor(bg, bg)}`);
  if (fg) css.push(`color:${safeColor(fg, fg)}`);

  return css.length ? ` style="${css.join(';')}"` : '';
}

function buildTable(cols, records, groupLabel, colGroupHtml = '') {
  const thead = cols.map((c) => `<th scope="col" title="${esc(c)}">${esc(c)}</th>`).join('');
  const tbody = records
    .map((rec) => {
      const isSel = rec.id === selectedRowId ? ' class="selected"' : '';
      return `<tr data-row-id="${rec.id}"${isSel}>${cols
        .map((c) => {
          const t = cellTitle(rec[c]);
          const st = getCellStyle(rec, c);
          return `<td${st}${t ? ` title="${esc(t)}"` : ''}>${renderCell(rec[c])}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('');
  return `<div class="scroll-inner" tabindex="0">
    <table class="rec-table">
      <caption>${T.groupCaption} ${esc(groupLabel)}</caption>
      ${colGroupHtml}
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table></div>`;
}

// Texte brut de la cellule, pour l'attribut title (valeurs tronquées à l'écran)
function cellTitle(val) {
  if (val == null || val === '' || val === true || val === false) return '';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

function renderCell(val) {
  if (val == null || val === '')
    return `<span class="cell-null" aria-label="${T.cellEmpty}">—</span>`;
  if (val === true || val === false) {
    const fmt = BOOL_FORMATS.find((f) => f.key === boolFmtKey) || BOOL_FORMATS[0];
    return val ? fmt.t : fmt.f;
  }
  if (typeof val === 'number') {
    const isYearLike = Number.isInteger(val) && val >= 1000 && val <= 9999;
    return `<span class="cell-num">${isYearLike ? val : val.toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US')}</span>`;
  }
  if (Array.isArray(val)) return esc(val.join(', '));

  const str = String(val).trim();

  if (EMAIL_RE.test(str)) {
    const safeEmail = esc(str);
    return `<a class="cell-link" href="mailto:${safeEmail}" onclick="event.stopPropagation()">${safeEmail}</a>`;
  }

  if (URL_RE.test(str)) {
    const href = /^https?:\/\//i.test(str) ? str : 'https://' + str;
    return `<a class="cell-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${esc(str)}</a>`;
  }

  return esc(str);
}

async function loadColumnSettings() {
  console.log('loadColumnSettings');
  try {
    const tableId = await grist.getSelectedTableId();
    if (!tableId) return;

    const tables = await grist.docApi.fetchTable('_grist_Tables');
    const tIdx = tables.tableId.indexOf(tableId);
    if (tIdx === -1) return;
    const tableRef = tables.id[tIdx];

    const cols = await grist.docApi.fetchTable('_grist_Tables_column');
    const fields = await grist.docApi.fetchTable('_grist_Views_section_field');

    const idToColId = Object.create(null);
    for (let i = 0; i < cols.id.length; i++) {
      idToColId[cols.id[i]] = cols.colId[i];
    }

    const map = Object.create(null);
    for (let i = 0; i < cols.id.length; i++) {
      if (cols.parentId[i] !== tableRef) continue;
      const colRef = cols.id[i];
      const colId = cols.colId[i];

      let opts = {};
      try {
        opts = JSON.parse(cols.widgetOptions[i] || '{}');
      } catch (_e) {
        /* ignore */
      }
      let ruleIds = Array.isArray(cols.rules[i]) ? cols.rules[i].slice(1) : [];

      // Si aucune règle au niveau de la table, chercher au niveau des vues (_grist_Views_section_field)
      if (ruleIds.length === 0) {
        for (let f = 0; f < fields.id.length; f++) {
          if (
            fields.colRef[f] === colRef &&
            Array.isArray(fields.rules[f]) &&
            fields.rules[f].length > 1
          ) {
            ruleIds = fields.rules[f].slice(1);
            try {
              const fOpts = JSON.parse(fields.widgetOptions[f] || '{}');
              if (fOpts.rulesOptions) opts.rulesOptions = fOpts.rulesOptions;
            } catch (_e) {
              /* ignore */
            }
            break;
          }
        }
      }

      map[colId] = {
        label: cols.label[i] || colId,
        alignment: opts.alignment || 'left',
        fillColor: opts.fillColor || '',
        textColor: opts.textColor || '',
        choiceOptions: opts.choiceOptions || null,
        rulesOptions: Array.isArray(opts.rulesOptions) ? opts.rulesOptions : [],
        ruleColNames: ruleIds.map((id) => idToColId[id]).filter(Boolean)
      };
    }

    // Stocke les valeurs des règles dans une Map persistante par rowId
    const fullTable = await grist.docApi.fetchTable(tableId);
    const ruleKeys = Object.keys(fullTable).filter((k) =>
      k.startsWith('gristHelper_ConditionalRule')
    );
    const nextRules = new Map();
    for (let r = 0; r < fullTable.id.length; r++) {
      const rowId = fullTable.id[r];
      const vals = {};
      ruleKeys.forEach((rk) => {
        vals[rk] = fullTable[rk][r];
      });
      nextRules.set(rowId, vals);
    }

    ruleValuesByRowId = nextRules;
    colSettings = map;
    console.log('map', ruleValuesByRowId, map);
    render();
  } catch (err) {
    console.error('Erreur chargement réglages colonnes:', err);
  }
}
