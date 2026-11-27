import './widget-info.ts';
import { buildCursor } from './cursor';
import { headerMonitor, recalculateHeader, rewriteHeader } from './header';
import {
  Command,
  DATA,
  dateDesc,
  fetchSchema,
  hasChanged,
  Item,
  memo,
  onClick,
  parseGristDate,
  ParsedGristDate,
  showAlert,
  stringToValue,
  valueToString,
  withElementSpinner,
  withIdSpinner
} from './lib';
import './vendor';
import { from } from 'fromit';
import { observable } from 'grainjs';
import moment from 'moment-timezone';
import { memoizeWith } from 'ramda';
import { distinct, filter, skip, Subject } from 'rxjs';
import VanillaContextMenu from 'vanilla-context-menu';
import { DataSet, Timeline, TimelineOptions } from 'vis-timeline/standalone';

declare global {
  var grist: any;
}

// DOM element where the Timeline will be attached
const container = document.getElementById('visualization')!;

const itemSet = new DataSet<Item>([]);
const groupSet = new DataSet<any>([]);
const records = observable([] as any[]);
const order = new Map();
const editCard = observable(false);
const confirmChanges = observable(false);
const currentScale = observable('auto');
const items = observable([] as Item[]);
const groupSelected = observable(null as any);
groupSelected.addListener((sel) => {
  document.querySelectorAll('.group-template').forEach((el) => {
    el.classList.remove('group-selected');
  });
  if (sel !== null && sel !== undefined) {
    const selId = typeof sel === 'object' ? sel.id : sel;
    document.querySelectorAll(`.group-item-${selId}`).forEach((el) => {
      el.classList.add('group-selected');
    });
  }
});
const focusOnSelect = observable(false);
const showAddButton = observable(true);
const mappings = observable<any>({});

function openSettingsDrawer() {
  const drawer = document.querySelector('.drawer-settings') as any;
  if (drawer) {
    drawer.show();
  }
}

const eventAdd = new Subject<number>();
const eventGroupInfo = new Subject<number>();

const cmdAddBlank = new Command<any>();

// Two indexes to quickly find group name by id and vice versa.
const byStart = new Map<string, Item[]>();
const byEnd = new Map<string, Item[]>();
const key = memoizeWith(
  (...args: any[]) => args.join(),
  (date: Date | string, days: number = 0) => {
    return moment(date).add({ days }).format('YYYY-MM-DD');
  }
) as (date: Date | string, days?: number) => string;
function startKey(item: Item, days: number = 0) {
  return `${item.group}-${key(item.start, days)}`;
}
function endKey(item: Item, days: number = 0): string {
  return `${item.group}-${key(item.end, days)}`;
}

grist.ready({
  allowSelectBy: true,
  requiredAccess: 'full',
  onEditOptions: () => openSettingsDrawer(),
  columns: [
    {
      name: 'Columns',
      title: 'Group by',
      allowMultiple: true,
      optional: true
    },

    {
      name: 'Title',
      title: 'Title / Label',
      allowMultiple: true,
      optional: true
    },
    {
      name: 'Readonly',
      title: 'Readonly',
      optional: true
    },
    {
      name: 'From',
      title: 'From / Start Date',
      type: 'Date,DateTime'
    },
    {
      name: 'To',
      title: 'To / End Date',
      type: 'Date,DateTime',
      optional: true
    },

    {
      name: 'GroupInfo',
      title: 'Group Info',
      allowMultiple: true,
      optional: true
    },

    {
      name: 'ItemInfo',
      title: 'Item Info',
      allowMultiple: true,
      optional: true
    }
  ]
});

// Configuration for the Timeline
const options: TimelineOptions = {
  groupOrder: function (a, b) {
    if (a.id === 0) {
      // This is last group, so it should bgroupHeadere last.
      return 1;
    }
    if (b.id === 0) {
      return -1;
    }
    return a.id - b.id;
  },

  /**
   * Item template is used to render each item in the timeline. Notice, this is run many times,
   * even when scrolling or moving.
   */
  template: function (item, element, data) {
    const parts = data.content.split('|');
    const text = parts[1] ? `${parts[0]} (${parts[1] || 'no subject'})` : parts[0];
    const div = document.createElement('div');
    div.className = 'item-template';
    div.title = text;
    const span = document.createElement('span');
    span.innerText = text;
    div.appendChild(span);

    const someoneOnLeft = byEnd.get(startKey(item, -1)) ?? [];
    const someoneOnRight = byStart.get(endKey(item, +1)) ?? [];

    div.classList.add('item-template');
    if (someoneOnLeft.length) {
      div.classList.add('item-left');
    }
    if (someoneOnRight.length) {
      div.classList.add('item-right');
    }

    const { start, end } = data;

    const all = items.get() as Item[];

    div.classList.remove('item-clash');
    const iStart = new Date(start).getTime();
    const iEnd = new Date(end).getTime();
    for (const other of all) {
      if (other.group !== item.group) {
        continue;
      }
      if (other.id === item.id) {
        continue;
      }
      const oStart = new Date(other.start).getTime();
      const oEnd = new Date(other.end).getTime();
      if (iStart >= oEnd || iEnd <= oStart) {
        continue;
      }
      div.classList.add('item-clash');
      break;
    }

    item.element = div;
    return div;
  },
  async onRemove(item, callback) {
    if (!confirmChanges.get() || confirm('Are you sure you want to delete this item?')) {
      await grist.selectedTable.destroy(item.id);
      callback(null);
    }
  },
  async onMove(item, callback) {
    let { start, end } = item;
    if (!end || !start) {
      return;
    }
    const format = (date: any) => moment(date).format('YYYY-MM-DD');

    if (confirmChanges.get() && !confirm('Are you sure you want to move this item?')) {
      callback(null);
      return;
    }

    let endM = moment(end);
    // If end is at midnight (0:00:00), subtract 1 second so it belongs to the intended day.
    if (endM.hours() === 0 && endM.minutes() === 0 && endM.seconds() === 0) {
      endM = endM.subtract(1, 'second');
    }
    const fromCol = mappings.get()?.From;
    const toCol = mappings.get()?.To;
    const fields: Record<string, any> = {};
    if (fromCol) fields[fromCol] = format(start);
    if (toCol) fields[toCol] = format(endM.toDate());

    await withIdSpinner(item.id, async () => {
      callback(item);
      await grist.selectedTable.update({ id: item.id, fields });
    });
  },
  async onAdd(item, callback) {
    let id: number = 0;
    try {
      const group = idToCols.get(item.group) || [];
      const groupArray = Array.isArray(group) ? group : [group];
      const start = moment(item.start).format('YYYY-MM-DD');

      if (!item.start) {
        console.error('Invalid date');
        return;
      }

      // In group we have list of values, we need to create an object from it (zip it with columns).
      const end = moment(defaultEnd(new Date(item.start))).format('YYYY-MM-DD');
      const mappedCols = mappings.get()?.Columns;
      const colNames = Array.isArray(mappedCols) ? mappedCols : (mappedCols ? [mappedCols] : []);
      const fromCol = mappings.get()?.From;
      const toCol = mappings.get()?.To;
      const values = [...groupArray, start, end];
      const columns = [...colNames, fromCol, toCol].filter(Boolean);
      const rawFields = Object.fromEntries(zip(columns, values));

      const fields = await gristfyFields(rawFields);
      id = (await grist.selectedTable.create({ fields })).id;

      await grist.setCursorPos({ rowId: id });

      callback(null);

      openCard();
    } finally {
      if (id) {
        eventAdd.next(id);
      }
    }
  },

  groupTemplate: function (group) {
    // Create a container for the group
    const container = document.createElement('div');

    container.classList.add('group-template', `group-item-${group.id}`);

    const sel = groupSelected.get();
    const selId = typeof sel === 'object' && sel !== null ? (sel as any).id : sel;
    if (selId === group.id) {
      container.classList.add('group-selected');
    }

    if (group.id === 0) {
      container.classList.add('group-empty');
      return container;
    }

    const groupCols = Array.isArray(group.columns)
      ? group.columns
      : [group.columns ?? group.content ?? ''];

    const groupLabelParts = groupCols
      .map((col) => {
        const val = stringToValue(col);
        return typeof val === 'string' || val === null
          ? valueToString(val)
          : Array.isArray(val)
            ? val.join(', ')
            : String(val ?? '');
      })
      .filter((s) => s.trim().length > 0);
    const fullGroupName = groupLabelParts.join(' • ') || group.content || 'Groupe';

    container.title = fullGroupName;

    const columnsDivs: HTMLDivElement[] = groupCols.map((col) => {
      const div = document.createElement('div');
      const value = stringToValue(col);
      if (typeof value === 'string' || value === null) {
        div.innerText = valueToString(value);
      } else if (typeof value === 'number') {
        div.innerText = formatCurrency.format(value);
      } else if (typeof value === 'boolean') {
        div.innerHTML = `<input type="checkbox" ${value ? 'checked' : ''} disabled>`;
      } else if (Array.isArray(value)) {
        // We only expect here to be array of strings.
        div.innerText = value.join(', ');
      }
      div.title = div.innerText;
      div.classList.add('group-part');
      return div;
    });

    // Add 3 dots menu.
    const menuBtn = document.createElement('div');
    menuBtn.innerHTML = '<sl-icon name="three-dots"></sl-icon>';
    menuBtn.className = 'center cursor group-menu-btn';
    menuBtn.title = `${fullGroupName} — Options / Détails`;
    menuBtn.setAttribute('aria-label', `${fullGroupName} options`);
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      eventGroupInfo.next(group.id);
    });
    columnsDivs.push(menuBtn);

    container.append(...columnsDivs);

    container.addEventListener('click', function () {
      // Find first item in that group.
      const last = itemSet
        .get()
        .filter((i) => i.group === group.id)
        .sort((a, b) => dateDesc(a.start, b.start))[0];
      if (last) {
        timeline.focus(last.id);
      }
      groupSelected.set(group);
    });

    // Return the container as the group's template
    return container;
  },

  editable: {
    add: true,
    updateTime: true,
    updateGroup: false
  },
  showCurrentTime: true,
  showWeekScale: false,
  groupHeightMode: 'fixed',

  verticalScroll: true,
  zoomKey: 'ctrlKey',
  height: '100%',

  orientation: 'top',

  locale: 'en-gb',
  format: {
    minorLabels: {
      millisecond: 'SSS',
      second: 's',
      minute: 'HH:mm',
      hour: 'HH:mm',
      weekday: 'ddd D',
      day: 'D',
      week: 'w',
      month: 'MMM',
      year: 'YYYY'
    },
    majorLabels: {
      millisecond: 'HH:mm:ss',
      second: 'D MMMM HH:mm',
      minute: 'ddd D MMMM',
      hour: 'ddd D MMMM',
      weekday: 'MMMM YYYY',
      day: 'MMMM YYYY',
      week: 'MMMM YYYY',
      month: 'YYYY',
      year: ''
    }
  },
  stack: true,
  stackSubgroups: false,
  xss: {
    disabled: true
  },
  zoomMin: 1000 * 60 * 60 * 24 * 1, // 1 day
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
  moment: function (date) {
    return moment(date); // Use moment with the 'en-gb' locale setting
  },
  snap: function (date) {
    const snappedDate = moment(date);
    snappedDate.startOf('day');
    return snappedDate.toDate();
  },
  margin: {
    item: 4,
    axis: 4
  }
};

// Create a Timeline
const timeline = new Timeline(container, itemSet, options);
timeline.setOptions({
  ...options,
  groupHeightMode: 'fixed'
});

// Exposed for configuration.
Object.assign(window as any, {
  currentScale,
  confirmChanges,
  editCard,
  focusOnSelect,
  showAddButton,
  timeline
});

const newMappings = hasChanged();

// This is async iterator
grist.onRecords(async (recs: any[], maps: any) => {
  // First compare mappings with those before, if they are different, we need to fetch
  // columns again.

  setTimeout(() => {
    document.body.classList.add('slow');
  }, 80);

  const areMappingsNew = newMappings(maps);
  if (areMappingsNew || !DATA.schema) {
    DATA.schema = await fetchSchema();
  }

  try {
    headerMonitor.pause();
    mappings.set(maps);
    records.set(grist.mapColumnNames(recs));
    order.clear();
    recs.forEach((r, i) => order.set(r.id, i));
    renderAllItems();

    if (areMappingsNew) {
      rewriteHeader({ mappings, timeline, cmdAddBlank });
    } else {
      recalculateHeader();
    }

    document.body.classList.remove('loading');
  } finally {
    headerMonitor.resume();
  }
});

const onRecord = new Subject<number>();
grist.onRecord(({ id }) => onRecord.next(id));
onRecord
  .pipe(
    distinct(), // ignore duplicates
    skip(1), // ignore initial one
    filter((id) => timeline.getSelection()[0] !== id)
  )
  .subscribe((id) => {
    timeline.setSelection(Number(id), {
      focus: focusOnSelect.get(),
      animation: {
        animation: false
      }
    });
  });

timeline.on('select', function (properties) {
  if (properties.items.length === 0) {
    return;
  }
  const selectedId = properties.items[0];
  grist.setCursorPos({ rowId: selectedId });
  if (focusOnSelect.get()) {
    timeline.focus(selectedId, {
      animation: {
        duration: 300,
        easingFunction: 'easeInOutQuad'
      }
    });
  }
  if (editCard.get()) {
    openCard();
  }
});

function getFrom(r: any): ParsedGristDate | null {
  return parseGristDate(r.From ?? r.start ?? r.Start ?? r.Date ?? r.date);
}

function getTo(r: any): ParsedGristDate | null {
  const toVal = r.To ?? r.end ?? r.End;
  return parseGristDate(toVal) ?? getFrom(r);
}

function recToItem(r: any): Item {
  const parsedFrom = getFrom(r);
  const parsedTo = getTo(r);

  const start = parsedFrom
    ? parsedFrom.isDateOnly
      ? `${parsedFrom.dateStr}T00:00:00`
      : moment(parsedFrom.date).format('YYYY-MM-DDTHH:mm:ss')
    : '';
  const end = parsedTo
    ? parsedTo.isDateOnly
      ? `${parsedTo.dateStr}T23:59:59`
      : moment(parsedTo.date).format('YYYY-MM-DDTHH:mm:ss')
    : '';

  const groupKey = calcGroup(r);
  const groupId = nameToId.get(groupKey) ?? 1;

  let titleStr = 'no title';
  if (r.Title !== undefined && r.Title !== null) {
    if (Array.isArray(r.Title)) {
      titleStr = r.Title.map((t: any) => valueToString(t)).join(' | ');
    } else {
      titleStr = valueToString(r.Title);
    }
  }

  const result: Item = {
    id: r.id,
    content: titleStr || 'no title',
    start,
    end,
    type: 'range',
    group: groupId,
    className: 'item_' + r.id,
    data: r,
    editable: r.Readonly ? false : (undefined as any),
    startKey: '',
    endKey: ''
  };
  result.startKey = startKey(result);
  result.endKey = endKey(result);

  return result;
}

/**
 * Converts mapped record (as seen by widget), to the row in Grist.
 */
function recToRow(record: any) {
  const m = mappings.get() || {};
  const mappedCols = m.Columns;
  const columns = Array.isArray(mappedCols) ? mappedCols : mappedCols ? [mappedCols] : [];
  const rawGroupVals = record.Columns;
  const groupValues = Array.isArray(rawGroupVals)
    ? rawGroupVals
    : rawGroupVals
      ? [rawGroupVals]
      : [];

  const mappedItemCols = m.ItemInfo;
  const itemColumns = Array.isArray(mappedItemCols)
    ? mappedItemCols
    : mappedItemCols
      ? [mappedItemCols]
      : [];
  const rawItemVals = record.ItemInfo;
  const itemValues = Array.isArray(rawItemVals) ? rawItemVals : rawItemVals ? [rawItemVals] : [];

  const parsedFrom = parseGristDate(record.From);
  const parsedTo = parseGristDate(record.To);
  const baseStart = parsedFrom ? parsedFrom.date : new Date();
  const baseEnd = parsedTo ? parsedTo.date : baseStart;

  const newStart = moment(baseStart).add(1, 'day').toDate();
  const newEnd = moment(baseEnd).add(1, 'week').toDate();

  const allColumns = [...columns, ...itemColumns, m.From, m.To].filter(Boolean);
  const allValues = [
    ...groupValues,
    ...itemValues,
    moment(newStart).format('YYYY-MM-DD'),
    moment(newEnd).format('YYYY-MM-DD')
  ];
  const fields = Object.fromEntries(zip(allColumns, allValues));
  return {
    id: record.id,
    ...fields
  };
}

function compareItems(a: any, b: any) {
  // Compare each field in the item above
  if (a.id !== b.id) {
    return false;
  }
  if (a.content !== b.content) {
    return false;
  }
  if (a.start !== b.start) {
    return false;
  }
  if (a.end !== b.end) {
    return false;
  }
  if (a.group !== b.group) {
    return false;
  }
  if (a.type !== b.type) {
    return false;
  }
  return true;
}

onClick('#btnAlCampaign', () => {
  renderAllItems();
});

const oldRecs = new Map();

function renderItems() {
  const recs = records.get();

  let i = 1;
  nameToId.clear();
  idToName.clear();
  idToCols.clear();
  for (const rec of recs) {
    const groupName = calcGroup(rec);
    if (nameToId.has(groupName)) {
      continue;
    }
    nameToId.set(groupName, i);
    idToName.set(i, groupName);
    const cols = Array.isArray(rec.Columns)
      ? rec.Columns
      : rec.Columns
        ? [rec.Columns]
        : [groupName];
    idToCols.set(i, cols);
    i++;
  }

  // If no groups at all, ensure at least one default group
  if (nameToId.size === 0) {
    nameToId.set('Default', 1);
    idToName.set(1, 'Default');
    idToCols.set(1, ['Default']);
  }

  const newIds = new Set(recs.map((x) => x.id));
  const existing = itemSet.getIds();
  const removed = existing.filter((x) => !newIds.has(x));
  itemSet.remove(removed);

  byStart.clear();
  byEnd.clear();

  const newItems = from(recs as any[])
    .filter((r) => getFrom(r) !== null)
    .map((r) => {
      const item = recToItem(r);
      if (!byStart.has(item.startKey)) {
        byStart.set(item.startKey, []);
      }
      if (!byEnd.has(item.endKey)) {
        byEnd.set(item.endKey, []);
      }
      byStart.get(item.startKey)!.push(item);
      byEnd.get(item.endKey)!.push(item);
      return item;
    });

  items.set(newItems.toArray());

  const changedItems =
    oldRecs.size > 0
      ? newItems.filter((newOne) => {
          const old = oldRecs.get(newOne.id);
          const LEAVE = true,
            REMOVE = false;
          if (!old) {
            return LEAVE;
          }
          const same = compareItems(old, newOne);
          return same ? REMOVE : LEAVE;
        })
      : newItems;

  const array = changedItems.toArray();
  oldRecs.clear();
  array.forEach((x) => oldRecs.set(x.id, x));

  itemSet.update(array);
}

const formatCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

function renderAllItems() {
  renderItems();
  renderGroups();
}

const nameToId = new Map(); // keys to id
const idToName = new Map(); // id to keys
const idToCols = new Map(); // visible columns

function calcGroup(rec: any): string {
  const cols = rec?.Columns;
  if (!cols) {
    return 'Default';
  }
  if (Array.isArray(cols)) {
    const parts = cols.map((c) => valueToString(c)).join('|');
    return parts || 'Default';
  }
  return valueToString(cols) || 'Default';
}

function renderGroups() {
  const existingGroups = groupSet.getIds();
  const groupsToRemove = existingGroups.filter((id) => !idToName.has(id));
  groupSet.remove(groupsToRemove);
  const rawGroups = Array.from(idToName.entries()).map((c) => ({
    id: c[0],
    content: c[1],
    editable: true,
    className: 'group_' + c[1],
    columns: idToCols.get(c[0]) || [c[1]]
  }));

  groupSet.update(rawGroups);
  timeline.setGroups(groupSet);
}

function bindConfig() {
  const configElements = document.querySelectorAll('.config');

  for (const el of configElements) {
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'sl-switch') {
      el.addEventListener('sl-change', (event: any) => {
        const elementId = el.getAttribute('id')!;
        const checked = Boolean(event.target.checked);
        updateConfig(elementId, checked);
      });
    } else {
      (el as HTMLElement).addEventListener('change', () => {
        const elementId = el.getAttribute('id')!;
        const value = (el as HTMLSelectElement | HTMLInputElement).value;
        updateConfig(elementId, value);
      });
    }
  }
}
bindConfig();

const functions = {};

function updateConfig(elementId: string, value: any) {
  if (elementId in functions) {
    functions[elementId](value);
    return;
  }
  const formatedValue = typeof value === 'boolean' ? value : stringToValue(value);
  const schema = elementId.split(':')[0];
  const [parent, child] = elementId.split(':')[1].split('.');
  if (child && schema === 'timeline') {
    if (child === 'scale') {
      currentScale.set(formatedValue);
      if (formatedValue === 'auto') {
        timeline.setOptions({
          timeAxis: null as any
        });
      } else {
        timeline.setOptions({
          timeAxis: {
            scale: formatedValue
          }
        });
      }
      grist.setOption('timeScale', formatedValue);
    } else {
      timeline.setOptions({
        [parent]: {
          [child]: formatedValue
        }
      });
    }
  } else if (schema === 'timeline') {
    timeline.setOptions({
      [parent]: formatedValue
    });

    if (parent === 'stack') {
      timeline.setOptions({
        cluster: false as any
      });
      timeline.setGroups(groupSet);
      timeline.redraw();
    }
  } else if (schema === 'local' || schema === 'settings') {
    if (!(parent in window)) {
      console.error(`Local variable ${parent} not found in window`);
      return;
    }

    (window as any)[parent].set(formatedValue);
    grist.setOption(parent, formatedValue);
  } else {
    console.error(`Unknown schema ${schema}`);
  }
}

timeline.setGroups(groupSet);

buildCursor(timeline, {
  eventAdd
});

document.addEventListener('DOMContentLoaded', function () {
  const fore = document.querySelector(
    '#visualization > div.vis-timeline.vis-bottom.vis-ltr > div.vis-panel.vis-center > div.vis-content > div > div.vis-foreground'
  );
  fore?.addEventListener('contextmenu', function (e) {
    // If we clicked in the .vis-item.vis-range it is ok, else stopImmediatePropagation
    const item = (e.target as HTMLElement).closest('.vis-item.vis-range');
    if (item) {
      // It has class item_N, get the N and select it (but first find that class)
      // then parse it to int and select it.
      const classes = Array.from(item.classList);
      const classItem = classes.find((c) => c.startsWith('item_'));
      if (classItem) {
        const id = parseInt(classItem.replace('item_', ''), 10);
        timeline.setSelection([id]);
      }
    } else {
      e.stopImmediatePropagation();
    }
    // e.preventDefault();
  });
  // Set defaults.
  timeline.setOptions({
    stack: true
  });

  const zoomIn = () => {
    timeline.zoomIn(0.3, { animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  };
  const zoomOut = () => {
    timeline.zoomOut(0.3, { animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  };

  document.getElementById('zoomInButton')?.addEventListener('click', zoomIn);
  document.getElementById('zoomOutButton')?.addEventListener('click', zoomOut);

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === '+' || e.key === '=') {
      zoomIn();
    } else if (e.key === '-' || e.key === '_') {
      zoomOut();
    }
  });

  document.getElementById('allButton')!.addEventListener('click', function () {
    timeline.fit();
  });

  document.getElementById('fitButton')!.addEventListener('click', () => autoFit(true));

  document.getElementById('settingsButton')?.addEventListener('click', openSettingsDrawer);

  // Collision prevention for major time axis labels
  function preventMajorOverlap() {
    const majorLabels = Array.from(
      document.querySelectorAll<HTMLElement>('.vis-time-axis .vis-text.vis-major')
    ).sort((a, b) => a.offsetLeft - b.offsetLeft);

    if (majorLabels.length <= 1) {
      majorLabels.forEach((el) => {
        el.style.visibility = 'visible';
        el.style.maxWidth = '';
      });
      return;
    }

    let lastRight = -Infinity;
    for (let i = 0; i < majorLabels.length; i++) {
      const label = majorLabels[i];
      const left = label.offsetLeft;
      const nextLeft = i < majorLabels.length - 1 ? majorLabels[i + 1].offsetLeft : Infinity;
      const availableWidth = nextLeft - left - 12;

      if (left < lastRight + 8 || availableWidth < 35) {
        label.style.visibility = 'hidden';
      } else {
        label.style.visibility = 'visible';
        if (Number.isFinite(availableWidth) && availableWidth > 0) {
          label.style.maxWidth = `${availableWidth}px`;
        } else {
          label.style.maxWidth = '';
        }
        lastRight = left + label.offsetWidth;
      }
    }
  }

  timeline.on('rangechange', preventMajorOverlap);
  timeline.on('rangechanged', preventMajorOverlap);

  const axisObserver = new MutationObserver(() => {
    preventMajorOverlap();
  });
  const timeAxisEl = container.querySelector('.vis-time-axis');
  if (timeAxisEl) {
    axisObserver.observe(timeAxisEl, { childList: true, subtree: true });
  } else {
    const initObserver = new MutationObserver(() => {
      const el = container.querySelector('.vis-time-axis');
      if (el) {
        initObserver.disconnect();
        axisObserver.observe(el, { childList: true, subtree: true });
        preventMajorOverlap();
      }
    });
    initObserver.observe(container, { childList: true, subtree: true });
  }

  headerMonitor.start();

  // same menu for .vis-item.vis-range
  const itemMenu = new VanillaContextMenu({
    scope: fore as HTMLElement,
    menuItems: [
      {
        label: 'Edit',
        callback: async () => {
          const selected = timeline.getSelection();
          if (selected.length === 0) {
            return;
          }
          await grist.setCursorPos({ rowId: selected[0] });
          await openCard();
        }
      },
      {
        label: 'Delete',
        callback: deleteSelected
      },
      {
        label: 'More info',
        callback: () => {
          const selected = timeline.getSelection();
          if (selected.length === 0) {
            return;
          }
          openItemDrawer(selected[0] as number);
        }
      },
      {
        label: 'Duplicate',
        callback: duplicateSelected
      }
    ],
    customThemeClass: 'context-menu-orange-theme',
    customClass: 'custom-context-menu-cls'
  });
});

editCard.addListener((value: boolean) => {
  const el1 = document.getElementById('local:editCard') as any;
  const el2 = document.getElementById('settings:editCard') as any;
  if (el1 && el1.checked !== value) el1.checked = value;
  if (el2 && el2.checked !== value) el2.checked = value;
});

confirmChanges.addListener((value: boolean) => {
  const el1 = document.getElementById('local:confirmChanges') as any;
  const el2 = document.getElementById('settings:confirmChanges') as any;
  if (el1 && el1.checked !== value) el1.checked = value;
  if (el2 && el2.checked !== value) el2.checked = value;
});

focusOnSelect.addListener((value: boolean) => {
  const el1 = document.getElementById('local:focusOnSelect') as any;
  const el2 = document.getElementById('settings:focusOnSelect') as any;
  if (el1 && el1.checked !== value) el1.checked = value;
  if (el2 && el2.checked !== value) el2.checked = value;
});

showAddButton.addListener((value: boolean) => {
  document.getElementById('visualization')?.classList.toggle('hide-add', !value);
  document.getElementById('groupHeader')?.classList.toggle('hide-add', !value);
  const el = document.getElementById('settings:showAddButton') as any;
  if (el && el.checked !== value) el.checked = value;
});

grist.onOptions((options: any) => {
  if (options?.editCard !== undefined) {
    editCard.set(Boolean(options.editCard));
  }
  if (options?.confirmChanges !== undefined) {
    confirmChanges.set(Boolean(options.confirmChanges));
  }
  if (options?.focusOnSelect !== undefined) {
    focusOnSelect.set(Boolean(options.focusOnSelect));
  }
  if (options?.showAddButton !== undefined) {
    showAddButton.set(Boolean(options.showAddButton));
  }
  if (options?.timeScale !== undefined) {
    currentScale.set(options.timeScale);
    if (options.timeScale === 'auto') {
      timeline.setOptions({
        timeAxis: null as any
      });
    } else {
      timeline.setOptions({
        timeAxis: {
          scale: options.timeScale
        }
      });
    }
    const select = document.getElementById('timeline:timeAxis.scale') as HTMLSelectElement | null;
    if (select) select.value = options.timeScale;
  }
});

function zip<T, V>(a: T[], b: V[]): [T, V][] {
  return a.map((e, i) => [e, b[i]]);
}

function defaultEnd(start: Date) {
  switch (currentScale.get()) {
    case 'auto':
    case 'day':
      return moment(start).endOf('day').toDate();
    case 'week':
      return moment(start).add(1, 'week').subtract(1, 'day').endOf('day').toDate();
    case 'month':
      return moment(start).add(1, 'month').subtract(1, 'day').endOf('day').toDate();
    case 'year':
      return moment(start).add(1, 'year').subtract(1, 'day').endOf('day').toDate();
  }
  return moment(start).endOf('day').toDate();
}

async function openCard() {
  try {
    if (grist?.commandApi?.run) {
      await grist.commandApi.run('viewAsCard');
    }
  } catch (err) {
    console.warn('Could not open card view:', err);
  }
}

/**
 * When creating a row in Grist we need to change values for Ref columns to row ids.
 */
async function gristfyFields(fields: Record<string, any>) {
  const allColumns = DATA.schema!.allColumns;
  const myColumns = DATA.schema!.columns;
  let clone = null as any;

  const fetchTable = memo(async (tableId: string) => await grist.docApi.fetchTable(tableId));

  for (const colId in fields) {
    const col = myColumns.find((c) => c.colId === colId);
    if (!col) {
      throw new Error(`Column with id ${colId} not found`);
    }
    // If this is formula column, omit it.
    if (col.isFormula && col.formula) {
      clone ??= { ...fields };
      delete clone[colId];
      continue;
    }
    const type = col?.type;
    if (type.startsWith('Ref:')) {
      const tableId = type.split(':')[1];
      const visibleColRowId = col.visibleCol;
      const visibleColModel = allColumns.find((c) => c.id === visibleColRowId);
      const visibleColId = visibleColModel?.colId;
      const table = await fetchTable(tableId);
      const visibleColValues = table[visibleColId];
      const rowIndex = visibleColValues.indexOf(fields[colId]);
      const rowId = table.id[rowIndex];
      clone ??= { ...fields };
      clone[colId] = rowId;
    } else if (type === 'ChoiceList') {
      const value = fields[colId];
      if (typeof value === 'string') {
        clone ??= { ...fields };
        clone[colId] = ['L', value];
      } else if (Array.isArray(value)) {
        clone ??= { ...fields };
        clone[colId] = ['L', ...value];
      }
    }
  }

  return clone ?? fields;
}

timeline.on('doubleClick', async function (props) {
  const { item, event } = props;
  if (event?.type === 'dblclick' && item) {
    await withIdSpinner(item, async () => {
      await openCard();
    });
  }
});

window.onunhandledrejection = function (event) {
  console.error(event);
  showAlert('danger', event.reason);
  document.body.classList.remove('loading');
};

window.onerror = function (event) {
  console.error(event);
  const message = (event as any).message ?? event;
  showAlert('danger', message);
  document.body.classList.remove('loading');
};

// Add one label/value row to the drawer, setting each piece via
// textContent so the column label and cell value show up as plain text.
function appendDrawerLine(drawerInfo: any, label: any, value: any) {
  const line = document.createElement('div');
  line.className = 'line';
  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = String(label ?? '');
  const valueEl = document.createElement('div');
  valueEl.className = 'value';
  valueEl.textContent = valueToString(value);
  line.append(labelEl, valueEl);
  drawerInfo.append(line);
}

eventGroupInfo.subscribe(openGroupDrawer);
function openGroupDrawer(groupId: number) {
  if (!groupId) {
    return;
  }
  const item = itemSet.get().find((i) => i.group === groupId);
  if (!item) {
    return;
  }

  const drawer = document.querySelector('.drawer-overview') as any;
  if (!drawer) return;
  const drawerInfo = drawer.querySelector('.drawer-info') as any;
  if (!drawerInfo) return;
  drawerInfo.innerHTML = ``;

  const m = mappings.get() || {};
  const groupInfo = m.GroupInfo ?? [];
  const colInfo = m.Columns ?? [];
  const groupInfoArr = Array.isArray(groupInfo) ? groupInfo : groupInfo ? [groupInfo] : [];
  const colInfoArr = Array.isArray(colInfo) ? colInfo : colInfo ? [colInfo] : [];

  const labels = [...colInfoArr, ...groupInfoArr].filter(Boolean);
  const rawGroupVals = item.data?.GroupInfo ?? [];
  const rawColVals = item.data?.Columns ?? [];
  const groupValsArr = Array.isArray(rawGroupVals)
    ? rawGroupVals
    : rawGroupVals
      ? [rawGroupVals]
      : [];
  const colValsArr = Array.isArray(rawColVals) ? rawColVals : rawColVals ? [rawColVals] : [];
  const values = [...colValsArr, ...groupValsArr];
  const obj = zip(labels, values);

  for (const [label, value] of obj) {
    appendDrawerLine(drawerInfo, label, value);
  }
  drawer.show();
}

function openItemDrawer(itemId: number) {
  // Same as above but for item.
  const item = itemSet.get().find((i) => i.id === itemId);
  if (!item) {
    return;
  }
  const drawer = document.querySelector('.drawer-overview') as any;
  if (!drawer) return;
  const drawerInfo = drawer.querySelector('.drawer-info') as any;
  if (!drawerInfo) return;
  drawerInfo.innerHTML = ``;

  const m = mappings.get() || {};
  const itemInfo = m.ItemInfo ?? [];
  const itemInfoArr = Array.isArray(itemInfo) ? itemInfo : itemInfo ? [itemInfo] : [];
  if (!itemInfoArr.length) {
    return;
  }
  const rawItemVals = item.data?.ItemInfo ?? [];
  const itemValsArr = Array.isArray(rawItemVals) ? rawItemVals : rawItemVals ? [rawItemVals] : [];
  const obj = zip(itemInfoArr, itemValsArr);
  for (const [label, value] of obj) {
    appendDrawerLine(drawerInfo, label, value);
  }
  drawer.show();
}

cmdAddBlank.handle(addBlank);
async function addBlank() {
  const m = mappings.get() || {};
  const fromCol = m.From;
  const toCol = m.To;
  if (!fromCol) {
    showAlert('warning', 'Please map the From / Start Date column first.');
    return;
  }
  const rawFields: Record<string, any> = {
    [fromCol]: moment().format('YYYY-MM-DD')
  };
  if (toCol) {
    rawFields[toCol] = moment().endOf('isoWeek').format('YYYY-MM-DD');
  }
  const fields = await gristfyFields(rawFields);
  const { id } = await grist.selectedTable.create({ fields });
  await grist.setCursorPos({ rowId: id });
  await openCard();
}

async function deleteSelected() {
  const selected = timeline.getSelection();
  if (selected.length === 0) {
    return;
  }
  setTimeout(async () => {
    if (!confirmChanges.get() || confirm('Are you sure you want to delete this item?')) {
      await grist.selectedTable.destroy(selected[0]);
    }
  }, 10);
}

async function duplicateSelected(ev?: MouseEvent) {
  const selected = timeline.getSelection() as number[];
  if (selected.length === 0) {
    return;
  }
  const recs = records.get();
  const rec = recs.find((r) => r.id === selected[0]);
  if (!rec) {
    return;
  }

  const clone = structuredClone(rec);
  const parsedFrom = parseGristDate(rec.From);
  const parsedTo = parseGristDate(rec.To) ?? parsedFrom;

  if (parsedFrom && parsedTo) {
    const diffMs = Math.max(86400000, parsedTo.date.getTime() - parsedFrom.date.getTime());
    const newFrom = new Date(parsedTo.date.getTime() + 86400000);
    const newTo = new Date(newFrom.getTime() + diffMs);
    clone.From = moment(newFrom).format('YYYY-MM-DD');
    clone.To = moment(newTo).format('YYYY-MM-DD');
  }

  const row = recToRow(clone);
  delete row.id;

  const element = document.querySelector(`.item_${selected[0]}`);

  if (element) {
    await withElementSpinner(element, async () => {
      const fields = await gristfyFields(row);
      await grist.selectedTable.create({ fields });
    });
  } else {
    const fields = await gristfyFields(row);
    await grist.selectedTable.create({ fields });
  }
}

function autoFit(animation = false) {
  const window = timeline.getWindow();
  const end = window.end;
  // To work comfortably with the timeline, each day should be roughly 24px wide.
  const currentWidth = document
    .querySelector('.vis-panel.vis-center')!
    .getBoundingClientRect().width;
  // Calculate how many days should be in the window.
  const daysToFit = Math.floor(currentWidth / 24);
  const newStart = moment(end).subtract(daysToFit, 'days').toDate();
  timeline.setWindow(newStart, end, {
    animation: {
      duration: animation ? 500 : 0,
      easingFunction: 'easeInOutQuad'
    }
  });
}
