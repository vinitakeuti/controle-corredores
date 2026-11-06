// Ícones do sistema Pace Lab: SVG próprio, traço único de 1,75 em grade de 24.
const paths = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h12v-9" /></>,
  board: <><rect x="4" y="5" width="4.5" height="14" rx="1" /><rect x="10.5" y="5" width="4.5" height="9" rx="1" /><rect x="17" y="5" width="3" height="11" rx="1" /></>,
  tag: <><path d="M4 12.5V5h7.5l8.5 8.5-7.5 7.5z" /><circle cx="8.5" cy="9" r="1.2" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6" /><path d="M17.5 14.3c1.6.7 2.7 2.3 3 4.7" /></>,
  chart: <><path d="M4 19h16" /><path d="M7 16v-5" /><path d="M12 16V7" /><path d="M17 16v-8" /></>,
  wallet: <><path d="M4 7.5h14a2 2 0 0 1 2 2V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M4 7.5 15.5 4.5V7.5" /><circle cx="16" cy="13.5" r="1.1" /></>,
  layers: <><path d="m12 4 8 4-8 4-8-4z" /><path d="m4 12 8 4 8-4" /><path d="m4 16 8 4 8-4" /></>,
  plug: <><path d="M9 4v4" /><path d="M15 4v4" /><path d="M7 8h10v3a5 5 0 0 1-10 0z" /><path d="M12 16v4" /></>,
  settings: <><circle cx="12" cy="12" r="2.6" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
  store: <><path d="M5 9h14l-1 10H6z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /></>,
  help: <><circle cx="12" cy="12" r="8" /><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.4" /><path d="M12 16.6v.1" /></>,
  logout: <><path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4" /><path d="m10 16-4-4 4-4" /><path d="M6 12h9" /></>,
  external: <><path d="M14 5h5v5" /><path d="m19 5-8 8" /><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m14 6-6 6 6 6" />,
  chevronRight: <path d="m10 6 6 6-6 6" />,
  chevronDown: <path d="m6 10 6 6 6-6" />,
  arrowLeft: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  sort: <><path d="m8 10 4-4 4 4" /><path d="m8 14 4 4 4-4" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5" /><path d="M12 15.8v.1" /></>,
  info: <><circle cx="12" cy="12" r="8" /><path d="M12 11v5" /><path d="M12 8v.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <><path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H11l-4 3.5V16H6.5A1.5 1.5 0 0 1 5 14.5z" /><path d="M9 9.5h6" /><path d="M9 12.5h3.5" /></>,
  send: <><path d="M4.5 12 19.5 5l-4 14-4.2-5.8z" /><path d="m11.3 13.2 8.2-8.2" /></>,
  arrowUp: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
  history: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4 4.5v3.2h3.2" /><path d="M12 8v4.2l2.8 1.8" /></>,
  edit: <><path d="M5 19h3.5L18.2 9.3a2 2 0 0 0 0-2.8l-.7-.7a2 2 0 0 0-2.8 0L5 15.5z" /><path d="m13.5 7 3.5 3.5" /></>,
  archive: <><rect x="4" y="5" width="16" height="4" rx="1" /><path d="M5.5 9v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></>,
  eye: <><path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.6" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.9 6.3A9.6 9.6 0 0 1 12 6c5.7 0 9 6 9 6a15.7 15.7 0 0 1-2.6 3.3" /><path d="M6.5 7.6C4.2 9.2 3 12 3 12s3.3 6 9 6a9 9 0 0 0 4.1-1" /><path d="M10.2 10.3a2.6 2.6 0 0 0 3.5 3.5" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="1" /><path d="M5 15V6a1 1 0 0 1 1-1h9" /></>,
  file: <><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v4h4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  mail: <><rect x="4" y="6" width="16" height="12" rx="1" /><path d="m4.5 7 7.5 6 7.5-6" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="1" /><path d="M4 10h16" /><path d="M8.5 3.5v4M15.5 3.5v4" /></>,
  trash: <><path d="M5 7h14" /><path d="M10 4h4" /><path d="M7 7l1 12h8l1-12" /></>,
  share: <><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M7 11H6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" /></>,
  addSquare: <><rect x="4.5" y="4.5" width="15" height="15" rx="3" /><path d="M12 8.5v7M8.5 12h7" /></>,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg className={`icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} focusable="false">
      {paths[name]}
    </svg>
  );
}
