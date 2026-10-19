// أيقونات بسيطة مرسومة بالكود — بتاخد لون النص اللي حواليها
const PATHS = {
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  heart: (
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z" />
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M16 12.5h2.5M3 9h15.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  home: <path d="M4 11 12 4l8 7v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19v-8Z" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </>
  ),
  share: <path d="M12 15V3m0 0L8 7m4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />,
  plusSquare: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" />,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />,
  upload: <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4" />,
  tooth: (
    <path d="M7.5 4C5 4 4 6 4 8.2c0 2.3 1.2 3.6 1.7 6.3.4 2.3.9 5.5 2.4 5.5 1.7 0 1.4-4.6 3.9-4.6s2.2 4.6 3.9 4.6c1.5 0 2-3.2 2.4-5.5.5-2.7 1.7-4 1.7-6.3C20 6 19 4 16.5 4c-1.9 0-2.7 1-4.5 1S9.4 4 7.5 4Z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" />
    </>
  ),
  book: <path d="M12 6.5C10 5 7 4.5 4 5v13.5c3-.5 6 0 8 1.5m0-13.5c2-1.5 5-2 8-1.5v13.5c-3-.5-6 0-8 1.5m0-13.5V20" />,
  bed: <path d="M3 18v-7m0 4h18m0 3v-5a3 3 0 0 0-3-3h-7v5M7 12.5a1.5 1.5 0 1 0 0-.01" />,
  scissors: (
    <>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <path d="M8.2 7.5 20 17M8.2 16.5 20 7" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  play: <path d="M8 5.5v13l10.5-6.5Z" />,
  pause: <path d="M9 5.5v13M15 5.5v13" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M5 7h14M10 7V5h4v2m-6 0 .8 12h6.4L16 7" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  beads: (
    <>
      <circle cx="12" cy="4.5" r="1.8" />
      <circle cx="17.3" cy="7" r="1.8" />
      <circle cx="18.5" cy="12.5" r="1.8" />
      <circle cx="6.7" cy="7" r="1.8" />
      <circle cx="5.5" cy="12.5" r="1.8" />
      <path d="M12 15.5v6M10 19h4" />
    </>
  ),
  month: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </>
  ),
  flame: <path d="M12 21c3.6 0 6-2.5 6-5.8 0-3.2-2.2-5-3.4-7.7-.3 1.9-1.3 3-2.6 3.6.4-2.9-.7-5.6-3-7.1.2 2.9-1.4 4.6-2.7 6.4C5.4 11.8 6 13.1 6 15.2 6 18.5 8.4 21 12 21Z" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </>
  ),
  dumbbell: <path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11" />,
  plate: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17M12 12h8.5" />
    </>
  ),
  scale: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M9 9.5a4 4 0 0 1 6 0M12 9.5l1.2-1.6" />
    </>
  ),
  star: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4Z" />,
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" />
    </>
  ),
}

export default function Icon({ name, size = 22, stroke = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
