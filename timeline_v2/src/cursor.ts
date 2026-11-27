/**
 * This file contains the code to build the cursor highlight on the timeline.
 */

import { from } from 'fromit';
import { Timeline } from 'vis-timeline';
import type * as Rx from 'rxjs';

export function buildCursor(
  timeline: Timeline,
  options: {
    eventAdd: Rx.Observable<number>;
  }
) {
  const cursorBox = document.createElement('div');
  cursorBox.append(document.createElement('sl-spinner'));
  cursorBox.addEventListener('dblclick', async function () {
    cursorBox.classList.add('cursor-loading');
  });
  options.eventAdd.subscribe(() => cursorBox.classList.remove('cursor-loading'));

  const foreground = document.querySelector('.vis-center .vis-foreground') as HTMLElement;
  if (!foreground) return;

  cursorBox.className = 'cursor-selection';
  foreground.appendChild(cursorBox);

  let leftPoints: { left: number; width: number }[] = [];
  let pendingRaf: number | null = null;
  let lastMouseEvent: { clientX: number; target: HTMLElement } | null = null;

  foreground.addEventListener('mouseleave', function () {
    if (pendingRaf) {
      cancelAnimationFrame(pendingRaf);
      pendingRaf = null;
    }
    lastMouseEvent = null;
    cursorBox.style.display = 'none';
  });

  const updateCursor = () => {
    pendingRaf = null;
    if (!lastMouseEvent) return;

    const { clientX, target } = lastMouseEvent;
    if (target === cursorBox || cursorBox.contains(target)) {
      return;
    }

    if (!target.classList.contains('vis-group')) {
      cursorBox.style.display = 'none';
      return;
    }

    const fgRect = foreground.getBoundingClientRect();
    const x = clientX - fgRect.left;

    const anotherDiv = document.querySelector(
      'div.vis-panel.vis-background.vis-vertical > div.vis-time-axis.vis-background'
    ) as HTMLElement | null;
    if (!anotherDiv) {
      cursorBox.style.display = 'none';
      return;
    }

    if (!leftPoints.length) {
      const children = Array.from(anotherDiv.children) as HTMLElement[];
      const weekFromElement = (el: Element) => {
        const classList = Array.from(el.classList).filter(
          (f) => !['vis-even', 'vis-odd', 'vis-minor', 'vis-major'].includes(f)
        );
        return classList.join(' ');
      };

      const getElemLeft = (el: HTMLElement): number => {
        const tr = el.style.transform;
        if (tr) {
          const m = tr.match(/translate\(([-\d.]+)px/);
          if (m) return parseFloat(m[1]);
        }
        return parseFloat(el.style.left) || 0;
      };

      const getElemWidth = (el: HTMLElement): number => {
        const w = parseFloat(el.style.width);
        return !isNaN(w) && w > 0 ? w : 40;
      };

      const grouped = from(children)
        .groupBy((e) => weekFromElement(e))
        .toArray();

      leftPoints = grouped.map((group) => {
        const first = group.first() as HTMLElement;
        const left = getElemLeft(first);
        const width = group.reduce((acc, el) => acc + getElemWidth(el as HTMLElement), 0);
        return { left, width };
      });
    }

    if (!leftPoints.length) {
      cursorBox.style.display = 'none';
      return;
    }

    const index = leftPoints.findLastIndex((c) => c.left <= x);
    const closest = index >= 0 ? leftPoints[index] : leftPoints[0];
    if (!closest) {
      cursorBox.style.display = 'none';
      return;
    }

    const targetLeft = `${closest.left}px`;
    const targetWidth = `${closest.width}px`;
    if (cursorBox.style.left !== targetLeft) {
      cursorBox.style.left = targetLeft;
    }
    if (cursorBox.style.width !== targetWidth) {
      cursorBox.style.width = targetWidth;
    }
    if (cursorBox.style.display !== 'grid') {
      cursorBox.style.display = 'grid';
    }
    if (cursorBox.style.transform !== '') {
      cursorBox.style.transform = '';
    }

    try {
      if (cursorBox.parentElement !== target) {
        target.prepend(cursorBox);
      }
    } catch (ex) {}
  };

  foreground.addEventListener('mousemove', function (e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target === cursorBox || cursorBox.contains(target)) {
      return;
    }
    lastMouseEvent = { clientX: e.clientX, target };
    if (!pendingRaf) {
      pendingRaf = requestAnimationFrame(updateCursor);
    }
  });

  timeline.on('rangechange', ({ byUser, event }) => {
    leftPoints = [];
    if (!byUser || !event || !event.deltaX || cursorBox.style.display === 'none') {
      return;
    }
    cursorBox.style.transform = `translateX(${event.deltaX}px)`;
  });

  timeline.on('rangechanged', () => {
    if (cursorBox.style.display === 'none') {
      cursorBox.style.transform = '';
      return;
    }
    const transform = cursorBox.style.transform;
    if (!transform) {
      return;
    }
    const match = transform.match(/translateX\(([^)]+)\)/);
    if (!match) {
      return;
    }
    const x = parseFloat(match[1]);
    const left = parseFloat(cursorBox.style.left) || 0;
    cursorBox.style.left = `${left + x}px`;
    cursorBox.style.transform = '';
  });
}
