import { computed, dom, Observable, observable } from 'grainjs';
import { Timeline } from 'vis-timeline';
import { buildColLabel, Command } from './lib';

export class HeaderMonitor {
  private headerMonitor!: ResizeObserver;
  private lastWidth = 0;
  private work = () => {};
  constructor() {
    this.work = debounced(this.invoke.bind(this), 30);
  }
  public start() {
    // Monitor left panel and adjust header left position.
    this.headerMonitor = new ResizeObserver(this.work);
    const panel = this.panel();
    if (panel) {
      this.headerMonitor.observe(panel);
    }
  }
  public invoke(...args: any[]) {
    const panel = this.panel();
    const header = this.header();
    if (!panel || !header) return;

    if (collapsed.get()) {
      header.style.width = '0px';
      header.style.setProperty('--left-width', '0px');
      return;
    }

    const labelset = panel.querySelector('.vis-labelset');
    const leftOffset = labelset
      ? Math.max(0, Math.round(labelset.getBoundingClientRect().left - panel.getBoundingClientRect().left))
      : 0;
    header.style.setProperty('--left-width', `${leftOffset}px`);

    const rawWidth = args[0]?.[0]?.borderBoxSize?.[0]?.inlineSize ?? panel.getBoundingClientRect().width;
    const width = Math.round(rawWidth);
    if (width > 0 && Math.abs(this.lastWidth - width) >= 1) {
      this.lastWidth = width;
      header.style.width = `${width}px`;
    }
    anchorHeader();
  }

  private panel(): HTMLElement | null {
    return document.querySelector('.vis-panel.vis-left');
  }

  private header(): HTMLElement | null {
    return document.getElementById('groupHeader');
  }

  private pauseCalls = 0;

  public pause() {
    this.pauseCalls++;
    if (this.pauseCalls === 1 && this.headerMonitor) {
      this.headerMonitor.disconnect();
    }
  }

  public resume() {
    this.pauseCalls--;
    if (this.pauseCalls <= 0 && this.headerMonitor) {
      this.pauseCalls = 0;
      const panel = this.panel();
      if (panel) {
        this.headerMonitor.observe(panel);
      }
    }
  }
}

export const headerMonitor = new HeaderMonitor();

const collapsed = observable(false);
let headerTopInitialized = false;
let savedExpandedWidth = 220;
let savedExpandedStyles = '';

let customPanelWidth: number | null = null;
let naturalColumnWidths: number[] = [];
let activeTimeline: Timeline | null = null;
let resizerInitialized = false;
let saveOptionTimeout: any = null;

export function getCustomPanelWidth(): number | null {
  return customPanelWidth;
}

export function setCustomPanelWidth(width: number | null) {
  customPanelWidth = typeof width === 'number' && width > 0 ? width : null;
  if (customPanelWidth !== null) {
    applyPanelWidth(customPanelWidth, activeTimeline || undefined);
  } else {
    recalculateHeader();
    if (activeTimeline) {
      activeTimeline.redraw();
    }
  }
}

function debouncedSaveWidth(width: number) {
  if (saveOptionTimeout) {
    clearTimeout(saveOptionTimeout);
  }
  saveOptionTimeout = setTimeout(() => {
    saveWidthNow(width);
  }, 400);
}

function saveWidthNow(width: number) {
  if (saveOptionTimeout) {
    clearTimeout(saveOptionTimeout);
    saveOptionTimeout = null;
  }
  if (typeof grist !== 'undefined' && grist.setOption) {
    grist.setOption('groupPanelWidth', Math.round(width));
  }
}

export function applyPanelWidth(width: number, timeline?: Timeline) {
  if (collapsed.get()) return;

  const visualization = document.getElementById('visualization');
  const columnsDiv = document.querySelector('.group-header-columns') as HTMLElement;
  const header = document.getElementById('groupHeader');
  if (!visualization || !columnsDiv) return;

  const visRect = visualization.getBoundingClientRect();
  const visWidth = visRect.width || window.innerWidth;

  const columnElements = Array.from(columnsDiv.children);
  const numDataCols = Math.max(1, columnElements.length - 1);
  const actionColWidth = 38;

  // Min and max bounds:
  // Min: 38px action col + at least 35px per data col (at least 90px total)
  const minWidth = Math.max(90, actionColWidth + numDataCols * 35);
  // Max: at most 75% of visualization width, leaving at least 25% for timeline
  const maxWidth = Math.max(minWidth + 60, Math.floor(visWidth * 0.75));
  const clampedWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(width)));

  const dataWidth = Math.max(20, clampedWidth - actionColWidth);

  let colWidths: number[] = [];
  if (naturalColumnWidths.length === numDataCols) {
    const sumNatural = naturalColumnWidths.reduce((a, b) => a + b, 0);
    if (sumNatural > 0) {
      let allocated = 0;
      for (let i = 0; i < numDataCols - 1; i++) {
        const w = Math.max(24, Math.round(dataWidth * (naturalColumnWidths[i] / sumNatural)));
        colWidths.push(w);
        allocated += w;
      }
      colWidths.push(Math.max(24, dataWidth - allocated));
    }
  }

  if (colWidths.length !== numDataCols) {
    const perCol = Math.floor(dataWidth / numDataCols);
    let allocated = 0;
    for (let i = 0; i < numDataCols - 1; i++) {
      colWidths.push(perCol);
      allocated += perCol;
    }
    colWidths.push(Math.max(24, dataWidth - allocated));
  }

  const colStyles = colWidths.map((w) => `${w}px`).join(' ') + ` ${actionColWidth}px`;

  columnsDiv.style.setProperty('grid-template-columns', colStyles);
  visualization.style.setProperty('--grid-template-columns', colStyles);
  visualization.style.setProperty('--group-header-width', `${clampedWidth}px`);
  visualization.style.setProperty('--group-first-width', `${colWidths[0]}px`);
  visualization.style.removeProperty('--group-max-width');

  if (header) {
    header.style.width = `${clampedWidth}px`;
  }

  savedExpandedWidth = clampedWidth;
  savedExpandedStyles = colStyles;

  const tl = timeline || activeTimeline;
  if (tl) {
    tl.redraw();
  }
  anchorHeader();
}

function initPanelResizer(timeline: Timeline) {
  activeTimeline = timeline;
  if (resizerInitialized) return;
  resizerInitialized = true;

  const visualization = document.getElementById('visualization');
  if (!visualization) return;

  let handle = visualization.querySelector('.panel-resizer-handle') as HTMLElement;
  if (!handle) {
    handle = dom(
      'div',
      dom.cls('panel-resizer-handle'),
      dom.prop('title', 'Glisser pour ajuster la largeur (Double-clic pour réinitialiser)'),
      dom('div', dom.cls('handle-line')),
      dom(
        'div',
        dom.cls('handle-grip'),
        dom('span'),
        dom('span'),
        dom('span')
      )
    );
    visualization.appendChild(handle);
  }

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;
  let rafPending = false;
  let pendingWidth = 0;

  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || collapsed.get()) return;

    isDragging = true;
    startX = e.clientX;
    const currentHeaderWidth = document.getElementById('groupHeader')?.getBoundingClientRect().width ?? savedExpandedWidth;
    startWidth = savedExpandedWidth > 0 ? savedExpandedWidth : currentHeaderWidth;
    pendingWidth = startWidth;

    headerMonitor.pause();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    handle.classList.add('is-dragging');
    document.body.classList.add('resizing-panel');

    e.preventDefault();
    e.stopPropagation();
  });

  handle.addEventListener('pointermove', (e: PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    pendingWidth = startWidth + deltaX;

    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (!isDragging) return;
        applyPanelWidth(pendingWidth, timeline);
        customPanelWidth = savedExpandedWidth;
        debouncedSaveWidth(savedExpandedWidth);
      });
    }
  });

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;

    handle.classList.remove('is-dragging');
    document.body.classList.remove('resizing-panel');
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {}

    headerMonitor.resume();

    // Final application and instant save to Grist options
    applyPanelWidth(pendingWidth || startWidth, timeline);
    customPanelWidth = savedExpandedWidth;
    saveWidthNow(savedExpandedWidth);
  };

  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerUp);

  handle.addEventListener('dblclick', (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    customPanelWidth = null;
    if (typeof grist !== 'undefined' && grist.setOption) {
      grist.setOption('groupPanelWidth', null);
    }
    recalculateHeader();
    if (timeline) {
      timeline.redraw();
    }
  });
}

function initHeaderTop(timeline: Timeline, cmdAddBlank: Command) {
  activeTimeline = timeline;
  if (headerTopInitialized) return;
  headerTopInitialized = true;

  const headerTop = document.querySelector('#groupHeader .top') as HTMLElement;
  if (!headerTop) return;

  const resizer = headerTop.querySelector('.resizer') as HTMLElement;
  const resizerIcon = headerTop.querySelector('.resizer sl-icon, .resizer-icon') as HTMLElement;
  const button = headerTop.querySelector('#btnAddRecord') as HTMLElement;
  const buttonLoading = observable(false);

  if (resizer) {
    dom.update(
      resizer,
      dom.on('click', () => collapsed.set(!collapsed.get()))
    );
  }

  if (resizerIcon) {
    const iconName = computed((use) => {
      return use(collapsed) ? 'chevron-bar-right' : 'chevron-bar-left';
    });
    dom.update(
      resizerIcon,
      dom.prop('name', iconName)
    );
  }

  if (button) {
    dom.update(
      button,
      dom.prop('loading', buttonLoading),
      dom.on('click', async () => {
        try {
          buttonLoading.set(true);
          await cmdAddBlank.invoke(null);
        } finally {
          buttonLoading.set(false);
        }
      })
    );
  }

  const visualization = document.getElementById('visualization');
  if (visualization) {
    dom.update(visualization, dom.cls('collapsed', collapsed));

    let expandBtn = visualization.querySelector('.collapsed-expand-btn') as HTMLElement;
    if (!expandBtn) {
      expandBtn = dom(
        'button',
        dom.cls('collapsed-expand-btn'),
        dom.prop('title', 'Déplier le panneau des groupes'),
        dom.prop('aria-label', 'Déplier le panneau des groupes'),
        dom('sl-icon', dom.prop('name', 'chevron-bar-right')),
        dom.on('click', () => collapsed.set(false))
      );
      visualization.appendChild(expandBtn);
    }
  }

  collapsed.addListener((isCollapsed) => {
    const tooltip = document.querySelector('#tooltipResizeColumns') as any;
    if (tooltip) {
      tooltip.content = isCollapsed ? 'Déplier le panneau des groupes' : 'Replier le panneau des groupes';
      tooltip.placement = isCollapsed ? 'right' : 'bottom';
    }

    const vis = document.getElementById('visualization');
    const header = document.getElementById('groupHeader');
    const columnsDiv = document.querySelector('.group-header-columns') as HTMLElement;

    if (isCollapsed) {
      if (vis) {
        vis.style.setProperty('--group-header-width', '0px');
        vis.style.setProperty('--group-max-width', '0px');
        vis.style.setProperty('--grid-template-columns', '0px');
      }
      if (header) {
        header.style.width = '0px';
      }
    } else {
      if (header) {
        header.style.removeProperty('width');
      }
      if (vis && savedExpandedWidth > 0) {
        vis.style.setProperty('--group-header-width', `${savedExpandedWidth}px`);
        vis.style.removeProperty('--group-max-width');
        if (header) {
          header.style.width = `${savedExpandedWidth}px`;
        }
        if (savedExpandedStyles) {
          vis.style.setProperty('--grid-template-columns', savedExpandedStyles);
          if (columnsDiv) {
            columnsDiv.style.setProperty('grid-template-columns', savedExpandedStyles);
          }
        }
      } else {
        recalculateHeader();
      }
    }

    timeline.redraw();
    if (!isCollapsed) {
      anchorHeader();
    }
  });
}

export function rewriteHeader({
  mappings,
  timeline,
  cmdAddBlank
}: {
  mappings: Observable<any>;
  timeline: Timeline;
  cmdAddBlank: Command;
}) {
  try {
    headerMonitor.pause();
    activeTimeline = timeline;

    initHeaderTop(timeline, cmdAddBlank);
    initPanelResizer(timeline);

    const headerRight = document.querySelector('#groupHeader .bottom .right')! as HTMLElement;

    const columnsDiv = dom('div');
    columnsDiv.classList.add('group-header-columns');

    const mappedCols = mappings.get()?.Columns;
    const colList: string[] = Array.isArray(mappedCols)
      ? mappedCols
      : mappedCols
        ? [mappedCols]
        : [];

    const columnElements = colList.map((col: string) => {
      return dom(
        'div',
        dom.text(buildColLabel(col)),
        dom.cls('group-part')
      );
    });

    if (columnElements.length === 0) {
      columnElements.push(
        dom(
          'div',
          dom.text('Groupe'),
          dom.cls('group-part')
        )
      );
    }
    columnsDiv.style.setProperty('grid-template-columns', 'auto');

    const moreDiv = document.createElement('div');
    moreDiv.className = 'group-header-more';
    moreDiv.style.width = '38px';
    moreDiv.innerHTML = '<sl-icon name="collection" class="collapsed-group-icon" title="Groupes"></sl-icon>';

    columnElements.push(moreDiv);
    columnsDiv.append(...columnElements);

    // Now we need to update its width, we can't break lines and anything like that.
    headerRight.innerHTML = '';
    headerRight.append(columnsDiv);

    recalculateHeader();
  } finally {
    headerMonitor.resume();
  }
}

export function recalculateHeader() {
  if (collapsed.get()) {
    return;
  }
  try {
    headerMonitor.pause();

    const visualization = document.getElementById('visualization');
    const columnsDiv = document.querySelector('.group-header-columns') as HTMLElement;
    if (!visualization || !columnsDiv) {
      return;
    }

    const columnElements = Array.from(columnsDiv.children);
    const numCols = Math.max(1, columnElements.length - 1);
    const defaultColMin = numCols === 1 ? 180 : 130;

    // Measure column header widths
    const colWidths = columnElements.slice(0, numCols).map((el) => {
      const w = el.getBoundingClientRect().width;
      return Math.max(w, defaultColMin);
    });

    // Inspect rendered rows for content width (sample first 30 rows for fast performance)
    const templates = Array.from(document.querySelectorAll('.group-template')).slice(0, 30);
    for (const row of templates) {
      const parts = Array.from(row.children).slice(0, numCols);
      parts.forEach((part, idx) => {
        const textWidth = (part as HTMLElement).scrollWidth;
        if (textWidth > (colWidths[idx] || 0)) {
          colWidths[idx] = Math.min(Math.max(textWidth + 8, colWidths[idx]), 320);
        }
      });
    }

    naturalColumnWidths = [...colWidths];

    // If user has a saved custom width, apply it now!
    if (customPanelWidth !== null && customPanelWidth > 0) {
      applyPanelWidth(customPanelWidth, activeTimeline || undefined);
      return;
    }

    const actionColWidth = 38;
    const colStyles = colWidths.map((w) => `${Math.ceil(w)}px`).join(' ') + ` ${actionColWidth}px`;

    columnsDiv.style.setProperty('grid-template-columns', colStyles);
    visualization.style.setProperty('--grid-template-columns', colStyles);

    const firstColWidth = colWidths[0] || defaultColMin;
    const totalWidth = colWidths.reduce((a, b) => a + b, 0) + actionColWidth;

    savedExpandedWidth = totalWidth;
    savedExpandedStyles = colStyles;

    visualization.style.setProperty('--group-header-width', `${Math.ceil(totalWidth)}px`);
    visualization.style.setProperty('--group-first-width', `${Math.ceil(firstColWidth)}px`);
    visualization.style.removeProperty('--group-max-width');

    const header = document.getElementById('groupHeader');
    if (header) {
      header.style.width = `${Math.ceil(totalWidth)}px`;
    }

    anchorHeader();
  } finally {
    headerMonitor.resume();
  }
}

export function anchorHeader() {
  if (collapsed.get()) {
    return;
  }
  const store = anchorHeader as any as {
    lastHeight: number;
    lastTopHeight: number;
    lastLeft: number;
  };
  store.lastHeight = store.lastHeight ?? -1;
  store.lastTopHeight = store.lastTopHeight ?? -1;
  store.lastLeft = store.lastLeft ?? -1;

  const panelEl = document.querySelector('.vis-panel.vis-left') as HTMLElement;
  const headerEl = document.getElementById('groupHeader') as HTMLElement;
  const visEl = document.getElementById('visualization') as HTMLElement;
  if (!panelEl || !headerEl || !visEl) {
    return;
  }

  const headerBottomEl = headerEl.querySelector('.bottom') as HTMLElement;
  const headerTopEl = headerEl.querySelector('.top') as HTMLElement;
  const contentEl = panelEl.querySelector('.vis-labelset') as HTMLElement;

  const visRect = visEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();

  // relativeTop is the exact distance from the top of #visualization to the top of .vis-panel.vis-left
  const relativeTop = Math.max(0, Math.round(panelRect.top - visRect.top));
  if (relativeTop <= 0) {
    return;
  }

  // Align topHeight to Vis-Timeline major time axis label if available
  const majorEl = document.querySelector(
    '.vis-time-axis .vis-text.vis-major:not(.vis-measure)'
  ) as HTMLElement;
  let topHeight = majorEl ? Math.round(majorEl.getBoundingClientRect().height) : 0;
  if (topHeight <= 0 || topHeight >= relativeTop) {
    topHeight = Math.round(relativeTop * 0.52);
  }
  const bottomHeight = Math.max(0, relativeTop - topHeight);

  if (relativeTop !== store.lastHeight || topHeight !== store.lastTopHeight) {
    store.lastHeight = relativeTop;
    store.lastTopHeight = topHeight;

    headerEl.style.height = `${relativeTop}px`;
    headerEl.style.top = '0px';
    if (headerTopEl) {
      headerTopEl.style.height = `${topHeight}px`;
    }
    if (headerBottomEl) {
      headerBottomEl.style.height = `${bottomHeight}px`;
    }
  }

  if (contentEl) {
    const contentRect = contentEl.getBoundingClientRect();
    const relativeLeft = Math.max(0, Math.round(contentRect.left - visRect.left));
    if (relativeLeft !== store.lastLeft) {
      store.lastLeft = relativeLeft;
      headerEl.style.left = `${relativeLeft}px`;
    }
  }
}

function debounced(func: (...args: any[]) => void, wait: number = 100): () => void {
  let timeout: number | null = null;
  return function (...args: any[]) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
