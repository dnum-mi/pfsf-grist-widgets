import './widget-info.js';

('use strict');

/* No manual configuration needed — the table is auto-detected by matching
   which table contains all the mapped columns, used to pull real Grist
   choice colours and column labels for the extra-field table headers. */

/* ---------- security helpers (per Grist widget security guide) ---------- */

function logSecurity(level, action, details) {
  var ts = new Date().toISOString();
  var msg = '[' + ts + '] [' + level + '] ' + action;
  if (level === 'ERROR') {
    console.error(msg, details || '');
  } else if (level === 'WARN') {
    console.warn(msg, details || '');
  } else {
    console.log(msg, details || '');
  }
}

function validateNumber(value, min, max, fallback) {
  var n = parseFloat(value);
  if (isNaN(n) || !isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

var errorBanner = document.getElementById('error-banner');
var errorText = document.getElementById('error-text');
function showError(userMessage, realError) {
  if (realError)
    logSecurity(
      'ERROR',
      'widget-error',
      realError && realError.message ? realError.message : realError
    );
  errorText.textContent = userMessage;
  errorBanner.classList.add('visible');
}
document.getElementById('error-dismiss').addEventListener('click', function () {
  errorBanner.classList.remove('visible');
});

function hideLoader() {
  var loader = document.getElementById('loader');
  if (loader) {
    void loader.offsetHeight; // force reflow before removing, avoids Grist iframe repaint bug
    loader.classList.add('hidden');
  }
}

/* ---------- helpers ---------- */

function toRows(t) {
  var ids = (t && t.id) || [],
    keys = Object.keys(t || {});
  return ids.map(function (_, i) {
    var r = {};
    keys.forEach(function (k) {
      r[k] = t[k][i];
    });
    return r;
  });
}
function val(v) {
  return v === null || v === undefined ? '' : String(v);
}

function choiceListToArray(v) {
  if (Array.isArray(v) && v[0] === 'L') return v.slice(1);
  if (Array.isArray(v)) return v;
  if (v) return [v];
  return [];
}
function firstChoice(v) {
  var arr = choiceListToArray(v);
  return arr.length ? val(arr[0]) : '';
}
function cellDisplay(v) {
  if (Array.isArray(v)) return choiceListToArray(v).join(', ');
  return val(v);
}

/* ---------- date helpers (Grist dates = Unix seconds, UTC) ---------- */

var DAY_MS = 86400000;

function secToDate(sec) {
  if (sec === null || sec === undefined || sec === '') return null;
  var d = typeof sec === 'number' ? new Date(sec * 1000) : new Date(sec); // number = Unix seconds, string = ISO (fetchSelectedTable serialises dates differently to docApi.fetchTable)
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1990 || y > 2100) return null; // guards against a mis-mapped column producing a garbage date
  return d;
}
function dateToSec(date) {
  return Math.floor(date.getTime() / 1000);
}
function utcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function addDays(date, n) {
  return new Date(date.getTime() + n * DAY_MS);
}
function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}
function fmtShort(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
function fmtMonthYear(date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function startOfMonth(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d, n) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function startOfQuarter(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));
}
function fmtQuarter(d) {
  return 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1) + ' ' + d.getUTCFullYear();
}

/* ---------- colour: real Grist choice colours, with a palette fallback ---------- */

var STATUS_PALETTE = [
  { bg: 'var(--prop-gray-bg)', solid: 'var(--prop-gray-solid)', text: 'var(--prop-gray-text)' },
  { bg: 'var(--prop-blue-bg)', solid: 'var(--prop-blue-solid)', text: 'var(--prop-blue-text)' },
  {
    bg: 'var(--prop-orange-bg)',
    solid: 'var(--prop-orange-solid)',
    text: 'var(--prop-orange-text)'
  },
  { bg: 'var(--prop-red-bg)', solid: 'var(--prop-red-solid)', text: 'var(--prop-red-text)' },
  { bg: 'var(--prop-green-bg)', solid: 'var(--prop-green-solid)', text: 'var(--prop-green-text)' },
  {
    bg: 'var(--prop-yellow-bg)',
    solid: 'var(--prop-yellow-solid)',
    text: 'var(--prop-yellow-text)'
  },
  {
    bg: 'var(--prop-purple-bg)',
    solid: 'var(--prop-purple-solid)',
    text: 'var(--prop-purple-text)'
  },
  { bg: 'var(--prop-pink-bg)', solid: 'var(--prop-pink-solid)', text: 'var(--prop-pink-text)' },
  { bg: 'var(--prop-brown-bg)', solid: 'var(--prop-brown-solid)', text: 'var(--prop-brown-text)' }
];
function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
function fallbackColor(value) {
  if (!value) return STATUS_PALETTE[0];
  return STATUS_PALETTE[hashStr(String(value)) % STATUS_PALETTE.length];
}

var choiceColors = {}; // populated from Grist's own column colours
var columnLabels = {}; // colId -> display label, for the extra-field table headers
var columnMeta = {}; // colId -> {type, choices}, for building the right input widget per field

function loadSchema(mappings) {
  if (!mappings) return Promise.resolve();
  return grist.docApi
    .fetchTable('_grist_Tables_column')
    .then(function (table) {
      var cols = toRows(table);

      columnLabels = {};
      columnMeta = {};
      cols.forEach(function (c) {
        if (!(c.colId in columnLabels)) columnLabels[c.colId] = c.label || c.colId;
        if (!(c.colId in columnMeta)) {
          var opts = {};
          try {
            opts = JSON.parse(c.widgetOptions || '{}');
          } catch (_e) {
            /* not JSON, ignore */
          }
          columnMeta[c.colId] = { type: val(c.type), choices: opts.choices || [] };
        }
      });

      choiceColors = {};
      if (!mappings.color) return;

      var byTable = {};
      cols.forEach(function (c) {
        (byTable[c.parentId] = byTable[c.parentId] || []).push(c);
      });

      var matchCols = null;
      var needed = [mappings.start, mappings.end, mappings.color].filter(Boolean);
      Object.keys(byTable).forEach(function (tid) {
        var ids = byTable[tid].map(function (c) {
          return c.colId;
        });
        if (
          needed.every(function (n) {
            return ids.indexOf(n) !== -1;
          })
        )
          matchCols = byTable[tid];
      });

      var colorCol =
        matchCols &&
        matchCols.filter(function (c) {
          return c.colId === mappings.color;
        })[0];
      if (!colorCol) return;
      try {
        choiceColors = JSON.parse(colorCol.widgetOptions || '{}').choiceOptions || {};
      } catch (_e) {
        /* not JSON, ignore */
      }
    })
    .catch(function (e) {
      logSecurity('WARN', 'Load schema', e.message);
      choiceColors = {};
      columnLabels = {};
    });
}
function resolveColor(value) {
  var opt = choiceColors[value];
  if (opt && (opt.fillColor || opt.textColor)) {
    return {
      bg: opt.fillColor || 'var(--prop-gray-bg)',
      solid: opt.textColor || 'var(--prop-gray-solid)',
      text: opt.textColor || 'var(--prop-gray-text)'
    };
  }
  return fallbackColor(value);
}

/* ---------- editable field widgets ---------- */
/* Builds the right kind of input for a column's type: a <select> for
   Choice, a date picker for Date/DateTime, a checkbox for Bool, a number
   field for Numeric/Int, plain text otherwise (including ChoiceList,
   which isn't safely editable as a single value here). */

/* short field types get a half-width cell in the popup grid; everything
   else (text, etc.) spans the full row */
function isShortField(type) {
  return (
    type.indexOf('Date') === 0 ||
    type === 'Choice' ||
    type === 'ChoiceList' ||
    type === 'Numeric' ||
    type === 'Int' ||
    type === 'Bool'
  );
}

function buildFieldInput(colId, rawValue) {
  var meta = columnMeta[colId] || { type: 'Text', choices: [] };
  var wrap = document.createElement('div');
  wrap.className = 'field-input-wrap';
  var input;

  if (meta.type === 'Choice') {
    input = document.createElement('select');
    var blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '\u2014';
    input.appendChild(blank);
    meta.choices.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === rawValue) opt.selected = true;
      input.appendChild(opt);
    });
  } else if (meta.type.indexOf('Date') === 0) {
    input = document.createElement('input');
    input.type = 'date';
    var d = secToDate(rawValue);
    if (d) input.value = d.toISOString().slice(0, 10);
  } else if (meta.type === 'Bool') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!rawValue;
  } else if (meta.type === 'Numeric' || meta.type === 'Int') {
    input = document.createElement('input');
    input.type = 'number';
    input.value = rawValue === null || rawValue === undefined ? '' : rawValue;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = cellDisplay(rawValue);
  }

  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-label', columnLabels[colId] || colId);
  input.dataset.colId = colId;
  input.dataset.type = meta.type;
  wrap.appendChild(input);
  return wrap;
}

function readFieldInput(input) {
  var type = input.dataset.type || 'Text';
  if (type === 'Bool') return input.checked;
  if (type.indexOf('Date') === 0) {
    if (!input.value) return null;
    var parts = input.value.split('-').map(Number);
    return dateToSec(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
  }
  if (type === 'Numeric' || type === 'Int') {
    return input.value === '' ? null : Number(input.value);
  }
  return input.value;
}

function wireFieldSave(input, taskId, colId) {
  if (!input) return;
  var commit = function () {
    var fields = {};
    fields[colId] = readFieldInput(input);
    grist.selectedTable.update({ id: taskId, fields: fields }).catch(function (err) {
      showError('Could not save that field.', err);
    });
  };
  if (input.tagName === 'SELECT' || input.type === 'checkbox') {
    input.addEventListener('change', commit);
  } else {
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
    });
  }
}

/* ---------- state ---------- */

var state = {
  tasks: [], // {id, label, start, end, color, group, tableExtra, timelineExtra}
  zoom: 'month', // 'week' | 'month'
  pxPerDay: 10,
  rangeStart: null, // UTC midnight Date
  rangeEnd: null,
  mappings: null,
  sample: null, // one raw record, kept for the on-screen debug panel
  scrolledOnce: false,
  collapsed: {}, // group name -> true if collapsed
  colWidths: {} // colId -> px width (persisted via widgetOptions)
};

var ZOOM_PX = { day: 48, week: 36, month: 10, quarter: 3 };

/* ---------- rendering ---------- */

var elInner = document.getElementById('timeline-inner');
var elScroll = document.getElementById('timeline-scroll');
var elEmpty = document.getElementById('empty-state');

function computeRange() {
  var minStart = null,
    maxEnd = null;
  state.tasks.forEach(function (t) {
    if (t.start && (!minStart || t.start < minStart)) minStart = t.start;
    if (t.end && (!maxEnd || t.end > maxEnd)) maxEnd = t.end;
  });
  var today = utcMidnight(new Date());
  if (!minStart) minStart = today;
  if (!maxEnd) maxEnd = today;
  if (minStart > today) minStart = today;
  if (maxEnd < today) maxEnd = today;
  state.rangeStart = addDays(utcMidnight(minStart), -7);
  state.rangeEnd = addDays(utcMidnight(maxEnd), 14);

  var MAX_DAYS = 7300; // ~20 years — individual dates are already sanity-checked (1990-2100), so this is just a final backstop
  if (daysBetween(state.rangeStart, state.rangeEnd) > MAX_DAYS) {
    state.rangeEnd = addDays(state.rangeStart, MAX_DAYS);
    showError(
      'The date range is unusually wide (20+ years) and was clamped — check the Start/End column mapping if that looks wrong.'
    );
  }
}

function xForDate(date) {
  return daysBetween(state.rangeStart, date) * state.pxPerDay;
}

/* ---------- sticky column layout (one column per "Extra fields (list)", no forced Name field) ---------- */

var EXTRA_COL_W = 130; // default per-column width
var MIN_COL_W = 60;
var MAX_COL_W = 600;
var GROUP_LABEL_W = 180; // reserved so group headers have somewhere to show their label, even with zero extra fields picked

function extraCols() {
  return (state.mappings && state.mappings.tableFields) || [];
}
function colWidth(colId) {
  var w = state.colWidths[colId];
  return typeof w === 'number' && isFinite(w) ? w : EXTRA_COL_W;
}
function stickyWidth() {
  var w = extraCols().reduce(function (sum, colId) {
    return sum + colWidth(colId);
  }, 0);
  if (state.mappings && state.mappings.group) w = Math.max(w, GROUP_LABEL_W);
  return w;
}
function headerIcon(type) {
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'var(--text-muted)');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flexShrink = '0';
  var paths;
  if (type === 'Choice' || type === 'ChoiceList')
    paths = ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M8.5 12l2.5 2.5 4.5-5'];
  else if (type.indexOf('Date') === 0) paths = ['M5 4h14v16H5z', 'M5 9h14', 'M9 2v4', 'M15 2v4'];
  else if (type === 'Numeric' || type === 'Int')
    paths = ['M4 9h16', 'M4 15h16', 'M9 4l-2 16', 'M17 4l-2 16'];
  else if (type === 'Bool') paths = ['M4 6h16v12H4z', 'M8 12l3 3 5-6'];
  else paths = ['M5 6h14', 'M12 6v13']; // text: a T
  paths.forEach(function (d) {
    var p = document.createElementNS(svgNS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  });
  return svg;
}

/* renders one list-column cell: a coloured, click-to-edit badge for Choice
   columns; the plain typed input for everything else */
function buildCell(colId, rawValue, taskId) {
  var meta = columnMeta[colId] || { type: 'Text' };
  if ((meta.type === 'Choice' || meta.type === 'ChoiceList') && taskId) {
    var value = firstChoice(rawValue);
    var badge = document.createElement('span');
    if (value) {
      var c = resolveColor(value);
      badge.className = 'cell-badge';
      badge.style.background = c.bg;
      badge.style.color = c.text;
      badge.textContent = value;
    } else {
      badge.className = 'cell-badge empty';
      badge.textContent = '\u2014';
    }
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute(
      'aria-label',
      (columnLabels[colId] || colId) + ': ' + (value || 'empty') + ', edit'
    );
    var swap = function () {
      var input = buildFieldInput(colId, rawValue);
      var sel = input.querySelector('select');
      wireFieldSave(sel, taskId, colId);
      sel.addEventListener('blur', function () {
        // re-render happens on the Grist writeback; nothing to do here
      });
      badge.replaceWith(input);
      if (sel) sel.focus();
    };
    badge.addEventListener('click', swap);
    badge.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        swap();
      }
    });
    return badge;
  }
  var input = buildFieldInput(colId, rawValue);
  wireFieldSave(input.querySelector('input, select'), taskId, colId);
  return input;
}

function buildStickyGroup(extraValues, isHeader, taskId) {
  var group = document.createElement('div');
  group.className = 'sticky-group';
  group.style.width = stickyWidth() + 'px';

  extraCols().forEach(function (colId, i) {
    var cell = document.createElement('div');
    cell.className = 'sticky-col extra' + (isHeader ? ' header' : '');
    cell.style.width = colWidth(colId) + 'px';
    if (isHeader) {
      var meta = columnMeta[colId] || { type: 'Text' };
      cell.appendChild(headerIcon(meta.type));
      var lbl = document.createElement('span');
      lbl.style.marginLeft = '0.375rem';
      lbl.textContent = columnLabels[colId] || colId;
      cell.appendChild(lbl);
      var grip = document.createElement('div');
      grip.className = 'col-resize';
      grip.setAttribute('aria-hidden', 'true');
      attachColResize(grip, colId);
      cell.appendChild(grip);
    } else if (taskId) {
      var rawValue = extraValues ? extraValues[i] : undefined;
      cell.appendChild(buildCell(colId, rawValue, taskId));
    } else {
      cell.textContent =
        extraValues && extraValues[i] !== undefined ? cellDisplay(extraValues[i]) : '';
    }
    group.appendChild(cell);
  });

  return group;
}

/* drag a header cell's right edge to resize that column. Live-updates every
   cell in the column during the drag; commits + persists on release. */
function attachColResize(grip, colId) {
  grip.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var startX = e.clientX;
    var startW = colWidth(colId);
    var idx = extraCols().indexOf(colId);
    grip.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';

    function liveWidths(w) {
      // resize this column's cell in every row without a full re-render
      var groups = elInner.querySelectorAll('.sticky-group');
      groups.forEach(function (g) {
        var cell = g.children[idx];
        if (cell) cell.style.width = w + 'px';
        g.style.width = stickyWidthWith(colId, w) + 'px';
      });
    }

    function onMove(ev) {
      var w = validateNumber(startW + (ev.clientX - startX), MIN_COL_W, MAX_COL_W, startW);
      state.colWidths[colId] = w;
      liveWidths(w);
    }
    function onUp(ev) {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      try {
        grip.releasePointerCapture(ev.pointerId);
      } catch (_err) {
        /* noop */
      }
      document.body.style.cursor = '';
      persistColWidths();
      render(); // full re-render so ruler/track widths line up cleanly
    }
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
  });
}

/* sticky-group width if colId were width w (used mid-drag before state settles) */
function stickyWidthWith(colId, w) {
  var total = extraCols().reduce(function (sum, c) {
    return sum + (c === colId ? w : colWidth(c));
  }, 0);
  if (state.mappings && state.mappings.group) total = Math.max(total, GROUP_LABEL_W);
  return total;
}

function renderRuler(totalWidth) {
  var ruler = document.createElement('div');
  ruler.className = 'ruler-row';

  var spacer = document.createElement('div');
  spacer.className = 'sticky-group';
  spacer.style.width = stickyWidth() + 'px';
  ruler.appendChild(spacer);

  var ticks = document.createElement('div');
  ticks.className = 'ruler-ticks';
  ticks.style.width = totalWidth + 'px';

  var cursor = startOfMonth(state.rangeStart);
  while (cursor < state.rangeEnd) {
    var nextMonth = addMonths(cursor, 1);
    var bandStart = cursor < state.rangeStart ? state.rangeStart : cursor;
    var left = xForDate(bandStart);
    var width = xForDate(nextMonth < state.rangeEnd ? nextMonth : state.rangeEnd) - left;
    var band2 = document.createElement('div');
    band2.className = 'month-band';
    band2.style.left = left + 'px';
    band2.style.width = Math.max(width, 0) + 'px';
    band2.textContent = fmtMonthYear(cursor);
    ticks.appendChild(band2);
    cursor = nextMonth;
  }

  function addTick(date, label) {
    var tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = xForDate(date) + 'px';
    ticks.appendChild(tick);
    if (label) {
      var tl = document.createElement('div');
      tl.className = 'tick-label';
      tl.style.left = xForDate(date) + 'px';
      tl.textContent = label;
      ticks.appendChild(tl);
    }
  }

  if (state.zoom === 'day') {
    cursor = new Date(state.rangeStart);
    while (cursor < state.rangeEnd) {
      addTick(cursor, fmtShort(cursor));
      cursor = addDays(cursor, 1);
    }
  } else if (state.zoom === 'week') {
    cursor = new Date(state.rangeStart);
    while (cursor < state.rangeEnd) {
      addTick(cursor, fmtShort(cursor));
      cursor = addDays(cursor, 7);
    }
  } else if (state.zoom === 'quarter') {
    cursor = startOfQuarter(state.rangeStart);
    while (cursor < state.rangeEnd) {
      addTick(cursor, fmtQuarter(cursor));
      cursor = addMonths(cursor, 3);
    }
  } else {
    // month
    cursor = startOfMonth(state.rangeStart);
    while (cursor < state.rangeEnd) {
      addTick(cursor, null);
      cursor = addMonths(cursor, 1);
    }
  }

  ruler.appendChild(ticks);
  return ruler;
}

/* With no dedicated Name field, identify a task from whatever's actually
   shown for it — the on-bar fields first, then the list-column fields —
   for aria-labels, tooltips, and the modal title. */
function taskDisplayText(task) {
  if (task.timelineExtra.length) return task.timelineExtra.join(' \u00b7 ');
  var extras = task.tableExtra.map(cellDisplay).filter(Boolean);
  if (extras.length) return extras.join(' \u00b7 ');
  return 'Task';
}

function taskAriaLabel(task) {
  var parts = [taskDisplayText(task)];
  if (task.start && task.end) parts.push(fmtShort(task.start) + ' to ' + fmtShort(task.end));
  if (task.color) parts.push('coloured ' + task.color);
  return parts.join(', ');
}

function renderRow(task, totalWidth) {
  var row = document.createElement('div');
  row.className = 'task-row';
  row.appendChild(buildStickyGroup(task.tableExtra, false, task.id));

  var track = document.createElement('div');
  track.className = 'bar-track';
  track.style.width = totalWidth + 'px';

  if (task.start && task.end) {
    var color = resolveColor(task.color);
    var bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.background = color.bg;
    bar.dataset.id = task.id;
    bar.setAttribute('role', 'button');
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('aria-describedby', 'kbd-instructions');
    bar.setAttribute('aria-label', taskAriaLabel(task));
    var titleParts = [
      taskDisplayText(task),
      fmtShort(task.start) + ' \u2192 ' + fmtShort(task.end)
    ];
    bar.title = titleParts.join(' \u2014 ');

    var labelSpan = document.createElement('span');
    labelSpan.className = 'bar-label';
    labelSpan.style.color = color.text;
    task.timelineExtra.forEach(function (extraVal) {
      var tag = document.createElement('span');
      tag.className = 'bar-tag';
      tag.textContent = extraVal;
      labelSpan.appendChild(tag);
    });
    bar.appendChild(labelSpan);

    positionBar(bar, task.start, task.end);

    var leftHandle = document.createElement('div');
    leftHandle.className = 'bar-handle left';
    leftHandle.setAttribute('aria-hidden', 'true');
    var rightHandle = document.createElement('div');
    rightHandle.className = 'bar-handle right';
    rightHandle.setAttribute('aria-hidden', 'true');
    bar.appendChild(leftHandle);
    bar.appendChild(rightHandle);

    attachDrag(bar, task);
    attachKeyboard(bar, task);

    track.appendChild(bar);
  }

  row.appendChild(track);
  return row;
}

function renderGroupHeader(name, count, totalWidth) {
  var row = document.createElement('div');
  row.className = 'group-row';

  var group = document.createElement('div');
  group.className = 'sticky-group';
  group.style.width = stickyWidth() + 'px';

  var collapsed = !!state.collapsed[name];
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'group-toggle';
  btn.setAttribute('aria-expanded', String(!collapsed));

  var chevron = document.createElement('span');
  chevron.className = 'group-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = collapsed ? '\u25B6' : '\u25BC';

  var text = document.createElement('span');
  text.className = 'group-name';
  text.textContent = name || '(no group)';

  var countEl = document.createElement('span');
  countEl.className = 'group-count';
  countEl.textContent = count;

  btn.appendChild(chevron);
  btn.appendChild(text);
  btn.appendChild(countEl);
  btn.addEventListener('click', function () {
    state.collapsed[name] = !state.collapsed[name];
    render();
  });

  var cell = document.createElement('div');
  cell.className = 'sticky-col name';
  cell.style.width = stickyWidth() + 'px';
  cell.appendChild(btn);
  group.appendChild(cell);
  row.appendChild(group);

  var spacer = document.createElement('div');
  spacer.style.width = totalWidth + 'px';
  row.appendChild(spacer);
  return row;
}

function renderColumnHeader(totalWidth) {
  var row = document.createElement('div');
  row.className = 'colhead-row';
  row.appendChild(buildStickyGroup(null, true));
  var spacer = document.createElement('div');
  spacer.style.width = totalWidth + 'px';
  row.appendChild(spacer);
  return row;
}

function renderGap(totalWidth) {
  var row = document.createElement('div');
  row.className = 'gap-row';
  var left = document.createElement('div');
  left.className = 'sticky-group';
  left.style.width = stickyWidth() + 'px';
  row.appendChild(left);
  var spacer = document.createElement('div');
  spacer.style.width = totalWidth + 'px';
  row.appendChild(spacer);
  return row;
}

function renderNewRow(groupName, totalWidth) {
  var row = document.createElement('div');
  row.className = 'new-row';

  var group = document.createElement('div');
  group.className = 'sticky-group';
  group.style.width = stickyWidth() + 'px';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'new-btn';
  var plus = document.createElement('span');
  plus.className = 'new-plus';
  plus.setAttribute('aria-hidden', 'true');
  plus.textContent = '+';
  var lbl = document.createElement('span');
  lbl.textContent = 'New';
  btn.appendChild(plus);
  btn.appendChild(lbl);
  btn.addEventListener('click', function () {
    createRecord(groupName, btn);
  });

  group.appendChild(btn);
  row.appendChild(group);

  var spacer = document.createElement('div');
  spacer.style.width = totalWidth + 'px';
  row.appendChild(spacer);
  return row;
}

/* creates a row with default dates (today -> +7d) so it shows on the
   timeline, inheriting the group value of the section it was added under */
function createRecord(groupName, btn) {
  if (!state.mappings || !state.mappings.start || !state.mappings.end) return;
  var today = utcMidnight(new Date());
  var fields = {};
  fields[state.mappings.start] = dateToSec(today);
  fields[state.mappings.end] = dateToSec(addDays(today, 7));

  // inherit the group value when adding under a named group
  if (groupName && state.mappings.group && groupName !== '(no group)') {
    var meta = columnMeta[state.mappings.group] || { type: 'Choice' };
    fields[state.mappings.group] = meta.type === 'ChoiceList' ? ['L', groupName] : groupName;
  }

  if (btn) btn.disabled = true;
  grist.selectedTable
    .create({ fields: fields })
    .then(function () {
      if (btn) btn.disabled = false;
    })
    .catch(function (err) {
      if (btn) btn.disabled = false;
      showError('Could not create the record.', err);
    });
}

function positionBar(bar, start, end) {
  var left = xForDate(start);
  var width = Math.max(daysBetween(start, end) * state.pxPerDay, 8);
  bar.style.left = left + 'px';
  bar.style.width = width + 'px';
}

function groupedTasks() {
  if (!state.mappings || !state.mappings.group) return [{ name: null, tasks: state.tasks }];
  var groups = {},
    order = [];
  function push(key, task) {
    if (!(key in groups)) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(task);
  }
  state.tasks.forEach(function (t) {
    if (t.groups.length) {
      // a task with several group values appears once under each — same
      // record, so editing/dragging any of its bars updates them all
      t.groups.forEach(function (g) {
        push(g, t);
      });
    } else {
      push('', t); // no group value → "(no group)" bucket
    }
  });
  order.sort();
  return order.map(function (key) {
    return { name: key || '(no group)', tasks: groups[key] };
  });
}

function renderDebug() {
  var el = document.getElementById('debug-info');
  var m = state.mappings;
  if (!el || !m || !m.start || !m.end || !state.sample) {
    if (el) el.textContent = '';
    return;
  }
  var lines = [
    'DEBUG (remove this panel once things work):',
    'mappings.start = ' + JSON.stringify(m.start),
    'mappings.end = ' + JSON.stringify(m.end),
    'mappings.color = ' + JSON.stringify(m.color),
    'mappings.group = ' + JSON.stringify(m.group),
    'first record keys: ' + Object.keys(state.sample).join(', '),
    'record[start] = ' + JSON.stringify(state.sample[m.start]),
    'record[end] = ' + JSON.stringify(state.sample[m.end])
  ];
  el.textContent = lines.join('\n');
}

function render() {
  if (!state.tasks.length) {
    elEmpty.classList.add('visible');
    elScroll.classList.add('hidden');
    renderDebug();
    return;
  }
  elEmpty.classList.remove('visible');
  elScroll.classList.remove('hidden');

  state.pxPerDay = ZOOM_PX[state.zoom];
  computeRange();

  var totalWidth = daysBetween(state.rangeStart, state.rangeEnd) * state.pxPerDay;

  elInner.innerHTML = '';
  elInner.style.width = totalWidth + stickyWidth() + 'px';
  elInner.appendChild(renderRuler(totalWidth));

  var todayX = xForDate(utcMidnight(new Date()));
  var todayLine = document.createElement('div');
  todayLine.className = 'today-line';
  todayLine.style.left = todayX + 'px';
  todayLine.style.top = '2.9375rem';
  elInner.appendChild(todayLine);

  var todayBadge = document.createElement('div');
  todayBadge.className = 'today-badge';
  todayBadge.style.left = todayX + 'px';
  todayBadge.textContent = 'Today';
  elInner.appendChild(todayBadge);

  var groups = groupedTasks();
  groups.forEach(function (g, gi) {
    if (g.name !== null) {
      if (gi > 0) elInner.appendChild(renderGap(totalWidth));
      elInner.appendChild(renderGroupHeader(g.name, g.tasks.length, totalWidth));
      if (state.collapsed[g.name]) return;
      if (extraCols().length) elInner.appendChild(renderColumnHeader(totalWidth));
    } else if (extraCols().length) {
      elInner.appendChild(renderColumnHeader(totalWidth));
    }
    g.tasks.forEach(function (task) {
      elInner.appendChild(renderRow(task, totalWidth));
    });
    elInner.appendChild(renderNewRow(g.name, totalWidth));
  });

  if (!state.scrolledOnce) {
    state.scrolledOnce = true;
    scrollToToday();
  }
}

/* ---------- writing back to Grist ---------- */

function commitDates(taskId, newStart, newEnd, barEl, revertFn) {
  var fields = {};
  fields[state.mappings.start] = dateToSec(newStart);
  fields[state.mappings.end] = dateToSec(newEnd);

  if (barEl) barEl.classList.add('saving');

  grist.selectedTable
    .update({ id: taskId, fields: fields })
    .then(function () {
      if (barEl) barEl.classList.remove('saving');
    })
    .catch(function (err) {
      if (barEl) barEl.classList.remove('saving');
      if (revertFn) revertFn();
      showError('Could not save that change, it has been reverted.', err);
    });
}

/* ---------- pointer drag ---------- */

function attachDrag(bar, task) {
  var mode = null;
  var startPointerX = 0;
  var origStart, origEnd;

  bar.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var rect = bar.getBoundingClientRect();
    var offsetX = e.clientX - rect.left;
    if (offsetX < 8) mode = 'resize-left';
    else if (offsetX > rect.width - 8) mode = 'resize-right';
    else mode = 'move';

    startPointerX = e.clientX;
    origStart = task.start;
    origEnd = task.end;
    bar.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  bar.addEventListener('pointermove', function (e) {
    if (!mode) return;
    var deltaPx = e.clientX - startPointerX;
    var deltaDays = Math.round(deltaPx / state.pxPerDay);
    var newStart = origStart,
      newEnd = origEnd;

    if (mode === 'move') {
      newStart = addDays(origStart, deltaDays);
      newEnd = addDays(origEnd, deltaDays);
    } else if (mode === 'resize-left') {
      newStart = addDays(origStart, deltaDays);
      if (newStart > origEnd) newStart = origEnd;
    } else if (mode === 'resize-right') {
      newEnd = addDays(origEnd, deltaDays);
      if (newEnd < origStart) newEnd = origStart;
    }
    positionBar(bar, newStart, newEnd);
    task._pendingStart = newStart;
    task._pendingEnd = newEnd;
  });

  function finish(e) {
    if (!mode) return;
    try {
      bar.releasePointerCapture(e.pointerId);
    } catch (_err) {
      /* noop */
    }
    var newStart = task._pendingStart || origStart;
    var newEnd = task._pendingEnd || origEnd;
    mode = null;
    task._pendingStart = null;
    task._pendingEnd = null;

    if (daysBetween(origStart, newStart) === 0 && daysBetween(origEnd, newEnd) === 0) {
      openTaskModal(task);
      return;
    }

    task.start = newStart;
    task.end = newEnd;
    bar.setAttribute('aria-label', taskAriaLabel(task));
    commitDates(task.id, newStart, newEnd, bar, function () {
      task.start = origStart;
      task.end = origEnd;
      positionBar(bar, origStart, origEnd);
      bar.setAttribute('aria-label', taskAriaLabel(task));
    });
  }

  bar.addEventListener('pointerup', finish);
  bar.addEventListener('pointercancel', finish);
}

/* ---------- keyboard interaction ---------- */

function attachKeyboard(bar, task) {
  bar.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openTaskModal(task);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    var dir = e.key === 'ArrowRight' ? 1 : -1;
    var origStart = task.start,
      origEnd = task.end;
    var newStart = origStart,
      newEnd = origEnd;

    if (e.shiftKey) {
      newEnd = addDays(origEnd, dir);
      if (newEnd < origStart) newEnd = origStart;
    } else if (e.altKey) {
      newStart = addDays(origStart, dir);
      if (newStart > origEnd) newStart = origEnd;
    } else {
      newStart = addDays(origStart, dir);
      newEnd = addDays(origEnd, dir);
    }

    task.start = newStart;
    task.end = newEnd;
    positionBar(bar, newStart, newEnd);
    bar.setAttribute('aria-label', taskAriaLabel(task));
    commitDates(task.id, newStart, newEnd, bar, function () {
      task.start = origStart;
      task.end = origEnd;
      positionBar(bar, origStart, origEnd);
      bar.setAttribute('aria-label', taskAriaLabel(task));
    });
  });
}

/* ---------- task detail modal ---------- */

var taskModal = document.getElementById('task-modal');
var taskModalTitle = document.getElementById('task-modal-title');
var taskModalBody = document.getElementById('task-modal-body');
var taskModalClose = document.getElementById('task-modal-close');
var modalTriggerEl = null;

function openTaskModal(task) {
  modalTriggerEl = document.activeElement;
  taskModalTitle.textContent = taskDisplayText(task);
  taskModalBody.innerHTML = '';

  var editCols = (state.mappings && state.mappings.editFields) || [];
  if (!editCols.length) {
    var p = document.createElement('p');
    p.className = 'modal-empty';
    p.textContent =
      'No editable fields configured yet \u2014 pick some under "Editable fields (popup)" in the config panel.';
    taskModalBody.appendChild(p);
  } else {
    editCols.forEach(function (colId) {
      var field = document.createElement('div');
      var meta = columnMeta[colId] || { type: 'Text' };
      field.className = 'modal-field' + (isShortField(meta.type) ? '' : ' full');
      var fieldId = 'modal-field-' + colId;
      var label = document.createElement('label');
      label.setAttribute('for', fieldId);
      label.textContent = columnLabels[colId] || colId;
      field.appendChild(label);

      var rawValue = task.raw ? task.raw[colId] : undefined;
      var inputWrap = buildFieldInput(colId, rawValue);
      var input = inputWrap.querySelector('input, select');
      input.id = fieldId;
      wireFieldSave(input, task.id, colId);
      field.appendChild(inputWrap);
      taskModalBody.appendChild(field);
    });
  }

  taskModal.hidden = false;
  var firstField = taskModalBody.querySelector('input, select');
  (firstField || taskModalClose).focus();
  document.addEventListener('keydown', onModalKeydown);
}

function closeTaskModal() {
  taskModal.hidden = true;
  document.removeEventListener('keydown', onModalKeydown);
  if (modalTriggerEl && typeof modalTriggerEl.focus === 'function') modalTriggerEl.focus();
}

function onModalKeydown(e) {
  if (e.key === 'Escape') {
    closeTaskModal();
    return;
  }
  if (e.key !== 'Tab') return;
  var focusables = taskModal.querySelectorAll('input, select, button');
  if (!focusables.length) return;
  var first = focusables[0],
    last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

taskModalClose.addEventListener('click', closeTaskModal);
taskModal.addEventListener('click', function (e) {
  if (e.target === taskModal) closeTaskModal();
});

/* ---------- zoom + today controls ---------- */

document.querySelectorAll('.btn-group [data-zoom]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    setZoom(btn.dataset.zoom);
  });
});
function setZoom(z) {
  state.zoom = z;
  document.querySelectorAll('.btn-group [data-zoom]').forEach(function (btn) {
    btn.setAttribute('aria-pressed', String(btn.dataset.zoom === z));
  });
  render();
  scrollToToday();
}

function scrollToToday() {
  requestAnimationFrame(function () {
    var todayX = xForDate(utcMidnight(new Date()));
    var maxScroll = Math.max(elInner.scrollWidth - elScroll.clientWidth, 0);
    elScroll.scrollLeft = validateNumber(todayX - elScroll.clientWidth / 2, 0, maxScroll, 0);
  });
}
document.getElementById('scroll-today').addEventListener('click', scrollToToday);

/* ---------- Grist wiring ---------- */
/* Native column mapping — works because this widget is properly hosted
   (the mapped bulk fetch this relies on isn't supported by the paste-in
   widget builder's preview bridge, only by a real Custom URL widget). */

grist.ready({
  requiredAccess: 'full',
  columns: [
    { name: 'start', title: 'Start date', type: 'Date,DateTime', optional: false },
    { name: 'end', title: 'End date', type: 'Date,DateTime', optional: false },
    { name: 'color', title: 'Colour by', type: 'Choice,ChoiceList', optional: true },
    { name: 'group', title: 'Group by', type: 'Choice,ChoiceList', optional: true },
    {
      name: 'tableFields',
      title: 'Extra fields (list)',
      type: 'Any',
      optional: true,
      allowMultiple: true
    },
    {
      name: 'timelineFields',
      title: 'Extra fields (on bar)',
      type: 'Any',
      optional: true,
      allowMultiple: true
    },
    {
      name: 'editFields',
      title: 'Editable fields (popup)',
      type: 'Any',
      optional: true,
      allowMultiple: true
    }
  ]
});

/* Column-width persistence via grist.setOption / onOptions.
 *
 * DELIBERATE DEVIATION from the project security guide (§3, "Don't use
 * grist.setOption/onOptions"). That rule exists because setOption can raise a
 * "widget changed" warning and, for schema-bound widgets, marker rows are the
 * cleaner store. Neither applies well here: this widget is generic and reusable
 * across arbitrary tables, so it has no guaranteed marker column to write to,
 * and marker rows would pollute the user's own data (a phantom row surfacing in
 * every other Grist view of that table). setOption is widget-scoped and leaves
 * the data untouched. Choice reviewed and accepted; revisit if the "widget
 * changed" warning proves disruptive in practice.
 *
 * We only WRITE on resize-release, and ignore the echo of our own write so
 * onOptions doesn't cause a render loop. */
var suppressNextOptions = false;

function persistColWidths() {
  suppressNextOptions = true;
  grist.setOption('colWidths', state.colWidths);
}

grist.onOptions(function (options) {
  if (suppressNextOptions) {
    suppressNextOptions = false;
    return;
  }
  var w = options && options.colWidths;
  if (w && typeof w === 'object') {
    state.colWidths = w;
    if (state.mappings) render();
  }
});

var lastRecordsKey = null;

grist.onRecords(function (records, mappings) {
  try {
    var key = JSON.stringify(records) + JSON.stringify(mappings);
    if (key === lastRecordsKey) return;
    lastRecordsKey = key;

    state.mappings = mappings;
    state.sample = records && records[0] ? records[0] : null;

    state.tasks = records
      .map(function (r) {
        var startDate = secToDate(r[mappings.start]);
        var endDate = secToDate(r[mappings.end]);
        return {
          id: r.id,
          start: startDate ? utcMidnight(startDate) : null,
          end: endDate ? utcMidnight(endDate) : null,
          color: firstChoice(r[mappings.color]),
          groups: mappings.group
            ? choiceListToArray(r[mappings.group]).map(val).filter(Boolean)
            : [],
          tableExtra: (mappings.tableFields || []).map(function (colId) {
            return r[colId];
          }),
          timelineExtra: (mappings.timelineFields || [])
            .map(function (colId) {
              return cellDisplay(r[colId]);
            })
            .filter(Boolean),
          raw: r
        };
      })
      .filter(function (t) {
        return t.start && t.end;
      });
  } catch (err) {
    hideLoader();
    showError('Could not read the mapped data.', err);
    return;
  }

  loadSchema(mappings)
    .then(function () {
      try {
        hideLoader();
        render();
      } catch (err) {
        hideLoader();
        showError('Could not render the timeline.', err);
      }
    })
    .catch(function (err) {
      hideLoader();
      showError('Could not load colours.', err);
    });
});
