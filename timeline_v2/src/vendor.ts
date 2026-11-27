import moment from 'moment-timezone';
import 'moment/locale/en-gb';
import { registerIconLibrary } from '@shoelace-style/shoelace/dist/utilities/icon-library.js';

import iconThreeDots from './icons/three-dots.svg?raw';
import iconArrowsCollapseVertical from './icons/arrows-collapse-vertical.svg?raw';
import iconExclamationOctagon from './icons/exclamation-octagon.svg?raw';
import iconChevronBarLeft from './icons/chevron-bar-left.svg?raw';
import iconChevronBarRight from './icons/chevron-bar-right.svg?raw';
import iconBorderAll from './icons/border-all.svg?raw';

const ICONS: Record<string, string> = {
  'three-dots': iconThreeDots,
  'arrows-collapse-vertical': iconArrowsCollapseVertical,
  'exclamation-octagon': iconExclamationOctagon,
  'chevron-bar-left': iconChevronBarLeft,
  'chevron-bar-right': iconChevronBarRight,
  'border-all': iconBorderAll
};

registerIconLibrary('default', {
  resolver: (name: string) => {
    const svg = ICONS[name];
    if (svg) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
    return '';
  }
});

import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';

// Make sure we have monday as the first day of the week.
moment.locale('en-gb');
