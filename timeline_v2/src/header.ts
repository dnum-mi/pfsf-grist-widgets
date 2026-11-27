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

function initHeaderTop(timeline: Timeline, cmdAddBlank: Command) {
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

    initHeaderTop(timeline, cmdAddBlank);

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
  const majorEl = document.querySelector('.vis-time-axis .vis-text.vis-major') as HTMLElement;
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
