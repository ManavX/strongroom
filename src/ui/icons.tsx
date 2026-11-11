/** Inline icon set. 24px grid, stroke-based, inherits currentColor. */
import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (children: ReactNode, props: P, fill = false) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const IconMark = (p: P) =>
  base(
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <path d="M12 1.6v4M12 18.4v4M1.6 12h4M18.4 12h4" />
    </>,
    p,
  );

export const IconVault = (p: P) =>
  base(
    <>
      <path d="M3 9.5h18v9.5H3z" />
      <path d="M5 9.5V6.6h14v2.9" />
      <path d="M9.5 13.2h5v2.6h-5z" />
      <path d="M7 9.5v2M17 9.5v2" />
    </>,
    p,
  );

export const IconInventory = (p: P) =>
  base(
    <>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </>,
    p,
  );

export const IconContract = (p: P) =>
  base(
    <>
      <path d="M6 20V9M6 9l-3 3M6 9l3 3" />
      <path d="M12 20V5M12 5L9 8M12 5l3 3" />
      <path d="M18 20v-8M18 12l-3 3M18 12l3 3" />
    </>,
    p,
  );

export const IconBook = (p: P) =>
  base(
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20" transform="translate(0 -2)" />
      <path d="M9 7.5h7M9 11h5" />
    </>,
    p,
  );

export const IconChart = (p: P) =>
  base(
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>,
    p,
  );

export const IconGear = (p: P) =>
  base(
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </>,
    p,
  );

export const IconSound = (p: P) =>
  base(
    <>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" />
    </>,
    p,
  );

export const IconMute = (p: P) =>
  base(
    <>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>,
    p,
  );

export const IconCoin = (p: P) =>
  base(
    <>
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />
      <path d="M12 8v8M9.3 10.2h3.9a1.6 1.6 0 0 1 0 3.2h-2.4" />
    </>,
    p,
  );

export const IconStar = (p: P) => base(<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.6l6.1-.8z" />, p);
export const IconStarFill = (p: P) => base(<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.6l6.1-.8z" />, p, true);
export const IconCheck = (p: P) => base(<path d="M5 12.5l4.5 4.5L19 7.5" />, p);
export const IconBack = (p: P) => base(<path d="M14.5 5.5L8 12l6.5 6.5M8.5 12H20" />, p);
export const IconClose = (p: P) => base(<path d="M6 6l12 12M18 6L6 18" />, p);
export const IconPlus = (p: P) => base(<path d="M12 5v14M5 12h14" />, p);
export const IconSearch = (p: P) =>
  base(
    <>
      <circle cx="10.8" cy="10.8" r="6" />
      <path d="M15.4 15.4L20 20" />
    </>,
    p,
  );
export const IconCamera = (p: P) =>
  base(
    <>
      <path d="M3.5 8h3.6l1.6-2.4h6.6L16.9 8h3.6v11h-17z" />
      <circle cx="12" cy="13.3" r="3.4" />
    </>,
    p,
  );
export const IconCrosshair = (p: P) =>
  base(
    <>
      <circle cx="12" cy="12" r="6.6" />
      <path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" />
    </>,
    p,
  );
export const IconBolt = (p: P) => base(<path d="M13.2 2.8L5.5 13.4h5.6l-1 7.8 8.4-11.3h-5.9z" />, p);
export const IconChevL = (p: P) => base(<path d="M14.5 5.5L8 12l6.5 6.5" />, p);
export const IconChevR = (p: P) => base(<path d="M9.5 5.5L16 12l-6.5 6.5" />, p);
export const IconDownload = (p: P) => base(<path d="M12 4v11M7.5 10.8L12 15.3l4.5-4.5M5 19.5h14" />, p);
export const IconEye = (p: P) =>
  base(
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.7" />
    </>,
    p,
  );
export const IconLock = (p: P) =>
  base(
    <>
      <path d="M5.5 10.5h13v9.5h-13z" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </>,
    p,
  );
export const IconDice = (p: P) =>
  base(
    <>
      <path d="M4.5 4.5h15v15h-15z" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth={2.6} />
    </>,
    p,
  );
export const IconSupply = (p: P) =>
  base(
    <>
      <path d="M12 3v8M8.5 7.5L12 11l3.5-3.5" />
      <path d="M4.5 13.5h15v6.5h-15z" />
      <path d="M9.5 16.8h5" />
    </>,
    p,
  );
