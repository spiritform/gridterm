import { Terminal } from './vendor/xterm/xterm.mjs';
import { FitAddon } from './vendor/addon-fit/addon-fit.mjs';
import { Unicode11Addon } from './vendor/addon-unicode11/addon-unicode11.mjs';
import { WebglAddon } from './vendor/addon-webgl/addon-webgl.mjs';

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const { homeDir } = window.__TAURI__.path;

const DEFAULT_ACCENTS = ['#ff8c42', '#4ade80', '#7c9eff'];

function loadSlotAccent(slotIdx) {
  const raw = localStorage.getItem(`gridterm.accent.${slotIdx}`);
  if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return DEFAULT_ACCENTS[slotIdx] || '#7c9eff';
}
function saveSlotAccent(slotIdx, hex) {
  if (hex === DEFAULT_ACCENTS[slotIdx]) localStorage.removeItem(`gridterm.accent.${slotIdx}`);
  else localStorage.setItem(`gridterm.accent.${slotIdx}`, hex);
}

const LINK_TYPES = ['accent', 'bg', 'fg'];
function isLinked(type) {
  return localStorage.getItem(`gridterm.linked.${type}`) === 'true';
}
function setLinkedState(type, val) {
  if (val) localStorage.setItem(`gridterm.linked.${type}`, 'true');
  else localStorage.removeItem(`gridterm.linked.${type}`);
}
function inputAttrsForType(type) {
  if (type === 'accent') return { inp: 'slot-accent-input', hex: 'slot-accent-hex' };
  if (type === 'bg') return { inp: 'slot-input', hex: 'slot-hex' };
  return { inp: 'slot-fg-input', hex: 'slot-fg-hex' };
}
function applyByType(type, slotIdx, hex) {
  if (type === 'accent') return applySlotAccent(slotIdx, hex);
  if (type === 'bg') return applySlotBg(slotIdx, hex);
  return applySlotFg(slotIdx, hex);
}
function applyColorFromInput(type, slotIdx, hex) {
  applyByType(type, slotIdx, hex);
  if (!isLinked(type)) return;
  const { inp: inpAttr, hex: hexAttr } = inputAttrsForType(type);
  for (let i = 0; i < 3; i++) {
    if (i === slotIdx) continue;
    applyByType(type, i, hex);
    const inp = document.querySelector(`[data-${inpAttr}="${i}"]`);
    const hexEl = document.querySelector(`[data-${hexAttr}="${i}"]`);
    if (inp) inp.value = hex;
    if (hexEl) { hexEl.value = hex; hexEl.classList.remove('invalid'); }
  }
}

const DEFAULT_FONT_SIZE = 13;
function loadFontSize() {
  const raw = parseInt(localStorage.getItem('gridterm.fontSize'), 10);
  if (Number.isFinite(raw) && raw >= 8 && raw <= 32) return raw;
  return DEFAULT_FONT_SIZE;
}
function saveFontSize(n) {
  localStorage.setItem('gridterm.fontSize', String(n));
}

const DEFAULT_FONT_WEIGHT = 500;
const FONT_WEIGHTS = [300, 400, 500, 600, 700];
function loadFontWeight() {
  const raw = parseInt(localStorage.getItem('gridterm.fontWeight'), 10);
  if (FONT_WEIGHTS.includes(raw)) return raw;
  return DEFAULT_FONT_WEIGHT;
}
function saveFontWeight(n) {
  localStorage.setItem('gridterm.fontWeight', String(n));
}

const FONT_FAMILIES = [
  { id: 'cascadia', label: 'Cascadia Code', stack: '"Cascadia Code", "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace' },
  { id: 'jetbrains', label: 'JetBrains Mono', stack: '"JetBrains Mono", "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace' },
  { id: 'consolas', label: 'Consolas', stack: 'Consolas, "Cascadia Mono", Menlo, monospace' },
  { id: 'menlo', label: 'Menlo', stack: 'Menlo, "SF Mono", Consolas, monospace' },
  { id: 'sfmono', label: 'SF Mono', stack: '"SF Mono", Menlo, Consolas, monospace' },
  { id: 'courier', label: 'Courier New', stack: '"Courier New", Courier, monospace' },
  { id: 'ubuntu', label: 'Ubuntu Mono', stack: '"Ubuntu Mono", Consolas, monospace' },
  { id: 'firacode', label: 'Fira Code', stack: '"Fira Code", Consolas, monospace' },
];
const DEFAULT_FONT_FAMILY_ID = 'cascadia';
function loadFontFamilyId() {
  const raw = localStorage.getItem('gridterm.fontFamily');
  if (raw && FONT_FAMILIES.some((f) => f.id === raw)) return raw;
  return DEFAULT_FONT_FAMILY_ID;
}
function saveFontFamilyId(id) {
  localStorage.setItem('gridterm.fontFamily', id);
}
function currentFontStack() {
  return (FONT_FAMILIES.find((f) => f.id === loadFontFamilyId()) || FONT_FAMILIES[0]).stack;
}

const BASE_BG = '#131318';
const BASE_FG = '#b8b8c0';

function loadSlotBg(slotIdx) {
  const raw = localStorage.getItem(`gridterm.bg.${slotIdx}`);
  if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return BASE_BG;
}
function saveSlotBg(slotIdx, hex) {
  if (hex === BASE_BG) localStorage.removeItem(`gridterm.bg.${slotIdx}`);
  else localStorage.setItem(`gridterm.bg.${slotIdx}`, hex);
}
function loadSlotFg(slotIdx) {
  const raw = localStorage.getItem(`gridterm.fg.${slotIdx}`);
  if (raw && /^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return BASE_FG;
}
function saveSlotFg(slotIdx, hex) {
  if (hex === BASE_FG) localStorage.removeItem(`gridterm.fg.${slotIdx}`);
  else localStorage.setItem(`gridterm.fg.${slotIdx}`, hex);
}
function slotTheme(slotIdx) {
  if (typeof slotIdx !== 'number') return XTERM_THEME;
  return { ...XTERM_THEME, background: loadSlotBg(slotIdx), foreground: loadSlotFg(slotIdx), cursor: loadSlotFg(slotIdx) };
}

function loadSlotOverride(i) {
  try {
    const raw = localStorage.getItem(`gridterm.slot.${i}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function saveSlotOverride(i, patch) {
  const cur = loadSlotOverride(i) || {};
  const next = { ...cur, ...patch };
  localStorage.setItem(`gridterm.slot.${i}`, JSON.stringify(next));
}

function makeDefaultColumns(home) {
  return DEFAULT_ACCENTS.map((_defaultAccent, i) => {
    const base = {
      id: `term${i + 1}`,
      project: `terminal ${i + 1}`,
      cli: 'cmd',
      cwd: home,
      accent: loadSlotAccent(i),
      badge: 'shell',
    };
    const override = loadSlotOverride(i);
    return { ...base, ...(override || {}) };
  });
}

let COLUMNS = [];

const PALETTE = ['#ff8c42', '#7c9eff', '#b967ff', '#4ade80', '#f472b6', '#60a5fa', '#fbbf24', '#a78bfa'];

function makeDefaultCol(index) {
  return {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    project: `terminal ${index + 1}`,
    cli: 'cmd',
    cwd: 'H:\\claudecode-projects',
    accent: PALETTE[index % PALETTE.length],
    badge: 'shell',
  };
}

const XTERM_THEME = {
  background: BASE_BG,
  foreground: '#b8b8c0',
  cursor: '#b8b8c0',
  cursorAccent: '#131318',
  selectionBackground: 'rgba(255,255,255,0.10)',
  black: '#0f0f11',
  red: '#d47a83',
  green: '#7cbf95',
  yellow: '#d0b47c',
  blue: '#8098d9',
  magenta: '#b183e0',
  cyan: '#7bb3b8',
  white: '#b8b8c0',
  brightBlack: '#585862',
  brightRed: '#d47a83',
  brightGreen: '#7cbf95',
  brightYellow: '#d0b47c',
  brightBlue: '#9bb5e8',
  brightMagenta: '#b183e0',
  brightCyan: '#7bb3b8',
  brightWhite: '#d8d8de',
};

function shortCwd(path) {
  if (!path) return '';
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return path;
  return parts.slice(-2).join('\\');
}

function buildColumn(col) {
  const el = document.createElement('div');
  el.className = 'term';
  el.style.setProperty('--accent', col.accent);
  if (typeof col.slotIdx === 'number') {
    el.style.setProperty('--tint-bg', loadSlotBg(col.slotIdx));
  }
  el.innerHTML = `
    <div class="term-header">
      <div class="dot"></div>
      <div class="info">
        <div class="project">${col.project}</div>
        <div class="meta">
          <span class="cwd-display" contenteditable="plaintext-only" spellcheck="false" title="${col.cwd}">${col.cwd}</span>
        </div>
      </div>
      <div class="header-tags">
        <span class="cli">${col.cli}</span>
        <span class="badge">${col.badge}</span>
      </div>
    </div>
    <div class="term-body"></div>
  `;
  wireDragHandlers(el);
  return el;
}

let dragSrcColEl = null;
let dragStartX = 0;
let dragStartY = 0;
let dragActivated = false;
const DRAG_THRESHOLD = 6;

function wireDragHandlers(colEl) {
  const header = colEl.querySelector('.term-header');
  header.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragSrcColEl = colEl;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragActivated = false;
  });
}

function activateDrag() {
  dragActivated = true;
  if (dragSrcColEl) dragSrcColEl.classList.add('dragging');
  document.body.classList.add('is-dragging');
}

function endDrag(commit) {
  if (dragSrcColEl && dragActivated && commit) {
    const target = document.querySelector('.term.drop-target');
    if (target && target !== dragSrcColEl) {
      const fromIdx = mounted.findIndex((m) => m.colEl === dragSrcColEl);
      const toIdx = mounted.findIndex((m) => m.colEl === target);
      if (fromIdx >= 0 && toIdx >= 0) reorderColumns(fromIdx, toIdx);
    }
  }
  if (dragSrcColEl) dragSrcColEl.classList.remove('dragging');
  document.body.classList.remove('is-dragging');
  clearDropTargets();
  dragSrcColEl = null;
  dragActivated = false;
}

function wireGridDrop() {
  document.addEventListener('pointermove', (e) => {
    if (!dragSrcColEl) return;
    if (!dragActivated) {
      const dx = Math.abs(e.clientX - dragStartX);
      const dy = Math.abs(e.clientY - dragStartY);
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
      activateDrag();
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const target = under && under.closest && under.closest('.term');
    if (target && target !== dragSrcColEl) {
      if (!target.classList.contains('drop-target')) {
        clearDropTargets();
        const srcAccent = dragSrcColEl.style.getPropertyValue('--accent');
        if (srcAccent) target.style.setProperty('--drop-accent', srcAccent);
        target.classList.add('drop-target');
      }
    } else {
      clearDropTargets();
    }
  });
  document.addEventListener('pointerup', () => {
    if (!dragSrcColEl) return;
    endDrag(true);
  });
  document.addEventListener('pointercancel', () => {
    if (!dragSrcColEl) return;
    endDrag(false);
  });
}

function clearDropTargets() {
  for (const el of document.querySelectorAll('.term.drop-target')) {
    el.classList.remove('drop-target');
    el.style.removeProperty('--drop-accent');
  }
}

function reorderColumns(from, to) {
  const grid = document.getElementById('grid');
  const [moving] = mounted.splice(from, 1);
  mounted.splice(to, 0, moving);
  for (const m of mounted) grid.appendChild(m.colEl);
  updateCount();
  requestAnimationFrame(() => {
    for (const m of mounted) {
      if (!m.fit) continue;
      m.fit.fit();
      invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
    }
  });
}

async function mountTerminal(col, colEl, bodyEl) {
  const term = new Terminal({
    fontFamily: currentFontStack(),
    fontSize: loadFontSize(),
    fontWeight: loadFontWeight(),
    fontWeightBold: 700,
    lineHeight: 1.55,
    letterSpacing: 0.3,
    theme: slotTheme(col.slotIdx),
    cursorBlink: true,
    cursorStyle: 'bar',
    cursorWidth: 2,
    cursorInactiveStyle: 'none',
    scrollback: 5000,
    allowProposedApi: true,
  });
  const fit = new FitAddon();
  const unicode11 = new Unicode11Addon();
  term.loadAddon(fit);
  term.loadAddon(unicode11);
  term.unicode.activeVersion = '11';
  term.open(bodyEl);

  // WebGL renderer — sharper subpixel text than the default canvas renderer.
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch (_) {
    // Fall back to default renderer if WebGL isn't available.
  }
  // Custom fit: reserve room for our styled 8px scrollbar + gutter so terminal
  // cells never render under the scrollbar. `.term-body` has 0 right padding
  // so the scrollbar sits flush against the column separator.
  const SCROLLBAR_RESERVE = 28;
  const fitNoScrollbarReserve = () => {
    try {
      const d = term._core?._renderService?.dimensions;
      const cellW = d?.css?.cell?.width ?? d?.actualCellWidth ?? d?.css?.actualCellWidth;
      const cellH = d?.css?.cell?.height ?? d?.actualCellHeight ?? d?.css?.actualCellHeight;
      if (!cellW || !cellH) {
        fit.fit();
        return;
      }
      const cs = window.getComputedStyle(bodyEl);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      const padT = parseFloat(cs.paddingTop) || 0;
      const padB = parseFloat(cs.paddingBottom) || 0;
      const w = bodyEl.clientWidth - padL - padR - SCROLLBAR_RESERVE;
      const h = bodyEl.clientHeight - padT - padB;
      const cols = Math.max(2, Math.floor(w / cellW));
      const rows = Math.max(1, Math.floor(h / cellH));
      if (cols !== term.cols || rows !== term.rows) {
        term.resize(cols, rows);
      }
    } catch (_) {
      try { fit.fit(); } catch (_) {}
    }
  };

  // Wait for the browser to lay out the terminal body before measuring it.
  // Two rAFs: first lets layout settle, second lets any pending window-maximize
  // reflow complete before we lock in the terminal size.
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  try { fit.fit(); } catch (_) {}
  fitNoScrollbarReserve();

  const cwdEl = colEl.querySelector('.cwd-display');
  const projectEl = colEl.querySelector('.project');
  term.parser.registerOscHandler(9, (data) => {
    const semi = data.indexOf(';');
    if (semi < 0) return false;
    const sub = data.slice(0, semi);
    const payload = data.slice(semi + 1);
    if (sub === '9') {
      const cwd = payload.replace(/^"|"$/g, '');
      if (cwdEl && cwd) {
        cwdEl.textContent = cwd;
        cwdEl.title = cwd;
      }
      if (projectEl && cwd && document.activeElement !== projectEl && !col.registeredProject) {
        const basename = cwd.split(/[\\/]/).filter(Boolean).pop() || cwd;
        projectEl.textContent = basename;
      }
      // Persist the current cwd so restarts land back here.
      if (cwd && typeof col.slotIdx === 'number') {
        saveSlotOverride(col.slotIdx, { cwd });
      }
      return true;
    }
    return false;
  });

  // Spawn with the final (scrollbar-corrected) size so the child sees the
  // right cols on its first render and doesn't have to redraw on SIGWINCH.
  await invoke('spawn_pty', {
    id: col.id,
    shell: null,
    cwd: col.cwd,
    cols: term.cols,
    rows: term.rows,
  });

  // Refit on size changes (window resize, maximize toggle, etc.), debounced
  // so a maximize-drag doesn't blast SIGWINCH at every intermediate pixel.
  let refitTimer;
  const scheduleRefit = () => {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(() => {
      try {
        fitNoScrollbarReserve();
        invoke('resize_pty', { id: col.id, cols: term.cols, rows: term.rows });
      } catch (_) {}
    }, 120);
  };
  const ro = new ResizeObserver(scheduleRefit);
  ro.observe(bodyEl);

  await listen(`pty-data-${col.id}`, (e) => {
    term.write(e.payload);
  });

  await listen(`pty-close-${col.id}`, () => {
    term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
  });

  const cliEl = colEl.querySelector('.cli');
  const badgeEl = colEl.querySelector('.badge');
  await listen(`pty-status-${col.id}`, (e) => {
    const status = e.payload;
    if (status === 'claude') {
      if (cliEl) cliEl.textContent = 'claude-code';
      if (badgeEl) {
        badgeEl.textContent = 'running';
        badgeEl.classList.add('badge-active');
      }
      // Register the current cwd as this slot's identity — persists across sessions
      // and stops the auto-basename updates from overwriting it.
      const nowCwd = cwdEl?.title || cwdEl?.textContent || '';
      if (nowCwd && typeof col.slotIdx === 'number') {
        const basename = nowCwd.split(/[\\/]/).filter(Boolean).pop() || nowCwd;
        saveSlotOverride(col.slotIdx, { project: basename, cwd: nowCwd });
        col.registeredProject = basename;
        if (projectEl && document.activeElement !== projectEl) {
          projectEl.textContent = basename;
        }
      }
    } else {
      if (cliEl) cliEl.textContent = col.cli;
      if (badgeEl) {
        badgeEl.textContent = col.badge;
        badgeEl.classList.remove('badge-active');
      }
    }
  });

  term.onData((data) => {
    invoke('write_pty', { id: col.id, data });
  });

  // Highlight the column whose terminal currently has keyboard focus.
  const textarea = colEl.querySelector('.xterm-helper-textarea');
  if (textarea) {
    textarea.addEventListener('focus', () => {
      document
        .querySelectorAll('.term.focused')
        .forEach((el) => el.classList.remove('focused'));
      colEl.classList.add('focused');
    });
  }

  // Clicking anywhere on the header focuses this terminal — no need to
  // aim at the xterm body. Skip clicks inside the editable cwd display so
  // path editing still works.
  const headerEl = colEl.querySelector('.term-header');
  headerEl.addEventListener('click', (e) => {
    if (e.target.closest('.cwd-display')) return;
    if (dragActivated) return;
    term.focus();
  });

  // Only the cwd is editable — titles are set by claude auto-register.
  const commitCwd = () => {
    const val = cwdEl.textContent.trim();
    if (!val || typeof col.slotIdx !== 'number') return;
    // Manually pasting a new cwd re-identifies the slot — otherwise the
    // previously-registered project name (e.g. "babee") sticks even after
    // navigating to a completely different folder.
    const basename = val.split(/[\\/]/).filter(Boolean).pop() || val;
    saveSlotOverride(col.slotIdx, { cwd: val, project: basename });
    cwdEl.title = val;
    col.registeredProject = basename;
    if (projectEl && document.activeElement !== projectEl) {
      projectEl.textContent = basename;
    }
    // Actually cd into the new folder so the terminal reflects it immediately.
    const cdCmd = /\s/.test(val) ? `cd /d "${val}"\r` : `cd /d ${val}\r`;
    invoke('write_pty', { id: col.id, data: cdCmd });
  };
  cwdEl.addEventListener('blur', commitCwd);
  cwdEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  });

  return { term, fit };
}

function findFocusedColumn() {
  const active = document.activeElement;
  if (!active) return mounted[0];
  for (const m of mounted) {
    if (m.colEl && m.colEl.contains(active)) return m;
  }
  return mounted[0];
}

async function tryPasteImageFromClipboardItems(items, targetCol) {
  if (!items) return false;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      const blob = typeof item.getAsFile === 'function' ? item.getAsFile() : item;
      if (!blob) continue;
      const buf = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      const path = await invoke('save_paste_image', { bytes });
      await invoke('write_pty', { id: targetCol.col.id, data: path });
      return true;
    }
  }
  return false;
}

function wireImagePaste() {
  // Capture-phase paste at document root — catches the event before xterm's
  // textarea handler runs and swallows it.
  document.addEventListener(
    'paste',
    async (e) => {
      const target = findFocusedColumn();
      if (!target) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const handled =
        (await tryPasteImageFromClipboardItems(cd.items, target)) ||
        (await tryPasteImageFromClipboardItems(cd.files, target));
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  // Fallback: Ctrl+V via async clipboard API — some clipboard sources (e.g.
  // Snipping Tool bitmaps) don't populate clipboardData.items in WebView2.
  document.addEventListener(
    'keydown',
    async (e) => {
      if (!(e.ctrlKey && (e.key === 'v' || e.key === 'V'))) return;
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const buf = await blob.arrayBuffer();
              const bytes = Array.from(new Uint8Array(buf));
              const target = findFocusedColumn();
              if (!target) return;
              const path = await invoke('save_paste_image', { bytes });
              await invoke('write_pty', { id: target.col.id, data: path });
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
        }
      } catch (_) {
        // No permission or non-image clipboard — let xterm handle text paste.
      }
    },
    true,
  );
}

const mounted = [];

function updateCount() {
  const countEl = document.getElementById('term-count');
  if (countEl) countEl.textContent = `${mounted.length} terminals`;
  document.getElementById('grid').style.setProperty('--cols', mounted.length);
  const picker = document.getElementById('col-picker');
  const btns = Array.from(picker.querySelectorAll('button[data-n]'));
  // Sort buttons so their order matches the on-screen column order for
  // active slots; inactive slots trail in their original slot order.
  const orderedActive = mounted
    .map((m) => btns.find((b) => parseInt(b.dataset.n, 10) - 1 === m.col.slotIdx))
    .filter(Boolean);
  const inactive = btns
    .filter((b) => !orderedActive.includes(b))
    .sort((a, b) => parseInt(a.dataset.n, 10) - parseInt(b.dataset.n, 10));
  for (const b of [...orderedActive, ...inactive]) picker.appendChild(b);
  for (const btn of btns) {
    const slotIdx = parseInt(btn.dataset.n, 10) - 1;
    const slotCfg = COLUMNS[slotIdx];
    const active = mounted.some((m) => m.col.slotIdx === slotIdx);
    btn.classList.toggle('active', active);
    btn.style.setProperty('--dot-color', slotCfg?.accent || 'var(--text)');
  }
}

function applyFontSize(size) {
  saveFontSize(size);
  for (const m of mounted) {
    if (!m.term) continue;
    try {
      m.term.options.fontSize = size;
      if (m.fit) m.fit.fit();
      invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
    } catch (_) {}
  }
}

function applyFontWeight(weight) {
  saveFontWeight(weight);
  for (const m of mounted) {
    if (!m.term) continue;
    try {
      m.term.options.fontWeight = weight;
      if (m.fit) m.fit.fit();
      invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
    } catch (_) {}
  }
}

function applyFontFamily(id) {
  saveFontFamilyId(id);
  const stack = currentFontStack();
  for (const m of mounted) {
    if (!m.term) continue;
    try {
      m.term.options.fontFamily = stack;
      if (m.fit) m.fit.fit();
      invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
    } catch (_) {}
  }
}

function applySlotBg(slotIdx, hex) {
  saveSlotBg(slotIdx, hex);
  for (const m of mounted) {
    if (m.col.slotIdx !== slotIdx) continue;
    m.colEl.style.setProperty('--tint-bg', hex);
    if (m.term) {
      try { m.term.options.theme = slotTheme(slotIdx); } catch (_) {}
    }
  }
}

function applySlotFg(slotIdx, hex) {
  saveSlotFg(slotIdx, hex);
  for (const m of mounted) {
    if (m.col.slotIdx !== slotIdx) continue;
    if (m.term) {
      try { m.term.options.theme = slotTheme(slotIdx); } catch (_) {}
    }
  }
}

function applySlotAccent(slotIdx, hex) {
  saveSlotAccent(slotIdx, hex);
  if (COLUMNS[slotIdx]) COLUMNS[slotIdx].accent = hex;
  for (const m of mounted) {
    if (m.col.slotIdx !== slotIdx) continue;
    m.col.accent = hex;
    m.colEl.style.setProperty('--accent', hex);
  }
  updateCount();
}

function wireSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('settings-close');
  const input = document.getElementById('setting-font-size');
  const dec = document.getElementById('font-size-dec');
  const inc = document.getElementById('font-size-inc');
  const weightSel = document.getElementById('setting-font-weight');
  const familySel = document.getElementById('setting-font-family');

  const weightLabels = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' };
  weightSel.innerHTML = FONT_WEIGHTS
    .map((w) => `<option value="${w}">${weightLabels[w]}</option>`)
    .join('');
  familySel.innerHTML = FONT_FAMILIES
    .map((f) => `<option value="${f.id}">${f.label}</option>`)
    .join('');

  const syncFromStorage = () => {
    input.value = String(loadFontSize());
    weightSel.value = String(loadFontWeight());
    familySel.value = loadFontFamilyId();
    for (const inp of document.querySelectorAll('[data-slot-input]')) {
      const idx = parseInt(inp.dataset.slotInput, 10);
      const bg = loadSlotBg(idx);
      inp.value = bg;
      const hex = document.querySelector(`[data-slot-hex="${idx}"]`);
      if (hex) { hex.value = bg; hex.classList.remove('invalid'); }
    }
    for (const inp of document.querySelectorAll('[data-slot-fg-input]')) {
      const idx = parseInt(inp.dataset.slotFgInput, 10);
      const fg = loadSlotFg(idx);
      inp.value = fg;
      const hex = document.querySelector(`[data-slot-fg-hex="${idx}"]`);
      if (hex) { hex.value = fg; hex.classList.remove('invalid'); }
    }
    for (const inp of document.querySelectorAll('[data-slot-accent-input]')) {
      const idx = parseInt(inp.dataset.slotAccentInput, 10);
      const ac = loadSlotAccent(idx);
      inp.value = ac;
      const hex = document.querySelector(`[data-slot-accent-hex="${idx}"]`);
      if (hex) { hex.value = ac; hex.classList.remove('invalid'); }
    }
  };
  const open = () => { syncFromStorage(); modal.classList.add('open'); };
  const close = () => { modal.classList.remove('open'); };
  openBtn.addEventListener('click', () => {
    modal.classList.contains('open') ? close() : open();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
  document.getElementById('settings-save').addEventListener('click', close);

  const clamp = (n) => Math.max(8, Math.min(32, n));
  const setSize = (n) => {
    const v = clamp(n | 0);
    input.value = String(v);
    applyFontSize(v);
  };
  input.addEventListener('change', () => setSize(parseInt(input.value, 10) || DEFAULT_FONT_SIZE));
  dec.addEventListener('click', () => setSize((parseInt(input.value, 10) || DEFAULT_FONT_SIZE) - 1));
  inc.addEventListener('click', () => setSize((parseInt(input.value, 10) || DEFAULT_FONT_SIZE) + 1));

  weightSel.addEventListener('change', () => {
    const v = parseInt(weightSel.value, 10);
    if (FONT_WEIGHTS.includes(v)) applyFontWeight(v);
  });
  familySel.addEventListener('change', () => {
    if (FONT_FAMILIES.some((f) => f.id === familySel.value)) applyFontFamily(familySel.value);
  });

  const normalizeHex = (raw) => {
    let s = raw.trim().toLowerCase();
    if (!s.startsWith('#')) s = '#' + s;
    if (/^#[0-9a-f]{3}$/.test(s)) {
      s = '#' + s.slice(1).split('').map((c) => c + c).join('');
    }
    return /^#[0-9a-f]{6}$/.test(s) ? s : null;
  };
  for (const inp of document.querySelectorAll('[data-slot-input]')) {
    inp.addEventListener('input', () => {
      const slotIdx = parseInt(inp.dataset.slotInput, 10);
      applyColorFromInput('bg', slotIdx, inp.value);
      const hex = document.querySelector(`[data-slot-hex="${slotIdx}"]`);
      if (hex) { hex.value = inp.value; hex.classList.remove('invalid'); }
    });
  }
  for (const hex of document.querySelectorAll('[data-slot-hex]')) {
    hex.addEventListener('input', () => {
      const slotIdx = parseInt(hex.dataset.slotHex, 10);
      const norm = normalizeHex(hex.value);
      if (!norm) { hex.classList.add('invalid'); return; }
      hex.classList.remove('invalid');
      applyColorFromInput('bg', slotIdx, norm);
      const inp = document.querySelector(`[data-slot-input="${slotIdx}"]`);
      if (inp) inp.value = norm;
    });
    hex.addEventListener('blur', () => {
      const slotIdx = parseInt(hex.dataset.slotHex, 10);
      hex.value = loadSlotBg(slotIdx);
      hex.classList.remove('invalid');
    });
    hex.addEventListener('focus', () => hex.select());
  }

  for (const inp of document.querySelectorAll('[data-slot-fg-input]')) {
    inp.addEventListener('input', () => {
      const slotIdx = parseInt(inp.dataset.slotFgInput, 10);
      applyColorFromInput('fg', slotIdx, inp.value);
      const hex = document.querySelector(`[data-slot-fg-hex="${slotIdx}"]`);
      if (hex) { hex.value = inp.value; hex.classList.remove('invalid'); }
    });
  }
  for (const inp of document.querySelectorAll('[data-slot-accent-input]')) {
    inp.addEventListener('input', () => {
      const slotIdx = parseInt(inp.dataset.slotAccentInput, 10);
      applyColorFromInput('accent', slotIdx, inp.value);
      const hex = document.querySelector(`[data-slot-accent-hex="${slotIdx}"]`);
      if (hex) { hex.value = inp.value; hex.classList.remove('invalid'); }
    });
  }
  for (const hex of document.querySelectorAll('[data-slot-accent-hex]')) {
    hex.addEventListener('input', () => {
      const slotIdx = parseInt(hex.dataset.slotAccentHex, 10);
      const norm = normalizeHex(hex.value);
      if (!norm) { hex.classList.add('invalid'); return; }
      hex.classList.remove('invalid');
      applyColorFromInput('accent', slotIdx, norm);
      const inp = document.querySelector(`[data-slot-accent-input="${slotIdx}"]`);
      if (inp) inp.value = norm;
    });
    hex.addEventListener('blur', () => {
      const slotIdx = parseInt(hex.dataset.slotAccentHex, 10);
      hex.value = loadSlotAccent(slotIdx);
      hex.classList.remove('invalid');
    });
    hex.addEventListener('focus', () => hex.select());
  }
  for (const hex of document.querySelectorAll('[data-slot-fg-hex]')) {
    hex.addEventListener('input', () => {
      const slotIdx = parseInt(hex.dataset.slotFgHex, 10);
      const norm = normalizeHex(hex.value);
      if (!norm) { hex.classList.add('invalid'); return; }
      hex.classList.remove('invalid');
      applyColorFromInput('fg', slotIdx, norm);
      const inp = document.querySelector(`[data-slot-fg-input="${slotIdx}"]`);
      if (inp) inp.value = norm;
    });
    hex.addEventListener('blur', () => {
      const slotIdx = parseInt(hex.dataset.slotFgHex, 10);
      hex.value = loadSlotFg(slotIdx);
      hex.classList.remove('invalid');
    });
    hex.addEventListener('focus', () => hex.select());
  }
  // Link toggle buttons: syncs all 3 rows for a color type and persists state.
  const syncLinkButtons = () => {
    for (const type of LINK_TYPES) {
      const on = isLinked(type);
      for (const b of document.querySelectorAll(`.v-link[data-link="${type}"]`)) {
        b.classList.toggle('linked', on);
      }
    }
  };
  syncLinkButtons();
  for (const btn of document.querySelectorAll('.v-link')) {
    btn.addEventListener('click', () => {
      const type = btn.dataset.link;
      const turningOn = !isLinked(type);
      setLinkedState(type, turningOn);
      syncLinkButtons();
      if (turningOn) {
        // Sync T2 and T3 to T1's current value so they visibly match.
        const t1Val = type === 'accent' ? loadSlotAccent(0)
                    : type === 'bg' ? loadSlotBg(0)
                    : loadSlotFg(0);
        applyColorFromInput(type, 0, t1Val);
        syncFromStorage();
      }
    });
  }

  document.getElementById('settings-reset-all').addEventListener('click', () => {
    for (const type of LINK_TYPES) setLinkedState(type, false);
    syncLinkButtons();
    applyFontSize(DEFAULT_FONT_SIZE);
    applyFontWeight(DEFAULT_FONT_WEIGHT);
    applyFontFamily(DEFAULT_FONT_FAMILY_ID);
    for (let i = 0; i < 3; i++) {
      applySlotBg(i, BASE_BG);
      applySlotFg(i, BASE_FG);
      applySlotAccent(i, DEFAULT_ACCENTS[i]);
    }
    syncFromStorage();
  });
}

async function addColumn(col) {
  const grid = document.getElementById('grid');
  const colEl = buildColumn(col);
  // Insert in slot order so drag can still reorder but toggle-on lands sensibly.
  let inserted = false;
  for (const m of mounted) {
    if ((m.col.slotIdx ?? -1) > (col.slotIdx ?? -1)) {
      grid.insertBefore(colEl, m.colEl);
      inserted = true;
      break;
    }
  }
  if (!inserted) grid.appendChild(colEl);
  const bodyEl = colEl.querySelector('.term-body');
  let entry;
  try {
    const t = await mountTerminal(col, colEl, bodyEl);
    entry = { col, colEl, ...t };
  } catch (err) {
    bodyEl.textContent = `spawn error: ${err}`;
    bodyEl.style.color = '#e06c75';
    bodyEl.style.padding = '12px';
    bodyEl.style.fontFamily = 'Cascadia Mono, Consolas, monospace';
    entry = { col, colEl, term: null, fit: null };
  }
  // Slot-ordered insert into mounted[]
  let idx = mounted.findIndex((m) => (m.col.slotIdx ?? -1) > (col.slotIdx ?? -1));
  if (idx < 0) idx = mounted.length;
  mounted.splice(idx, 0, entry);
  updateCount();
}

async function removeSlot(slotIdx) {
  const idx = mounted.findIndex((m) => m.col.slotIdx === slotIdx);
  if (idx < 0) return;
  const [m] = mounted.splice(idx, 1);
  try {
    if (m.term) m.term.dispose();
    await invoke('kill_pty', { id: m.col.id });
  } catch (_) {}
  m.colEl.remove();
  updateCount();
}

async function toggleSlot(slotIdx) {
  const existing = mounted.find((m) => m.col.slotIdx === slotIdx);
  if (existing) {
    if (mounted.length <= 1) return;
    await removeSlot(slotIdx);
  } else {
    const base = COLUMNS[slotIdx];
    if (!base) return;
    const col = { ...base, id: `${base.id}-${Date.now().toString(36)}`, slotIdx };
    await addColumn(col);
  }
  requestAnimationFrame(() => {
    for (const m of mounted) {
      if (!m.fit) continue;
      m.fit.fit();
      invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
    }
  });
}

function wireWindowControls() {
  const win = getCurrentWindow();
  document.getElementById('win-min')?.addEventListener('click', () => win.minimize());
  document.getElementById('win-max')?.addEventListener('click', () => win.toggleMaximize());
  document.getElementById('win-close')?.addEventListener('click', () => win.close());
}

async function main() {
  wireWindowControls();
  wireGridDrop();
  wireImagePaste();
  wireSettingsModal();

  let home;
  try { home = await homeDir(); } catch (_) { home = 'C:\\'; }
  COLUMNS = makeDefaultColumns(home);

  // Fix grid width up front so each terminal mounts at its final column width;
  // otherwise the first columns spawn wider than they'll end up, and their
  // PTY cols stay stale after the grid shrinks.
  document.getElementById('grid').style.setProperty('--cols', COLUMNS.length);
  for (let i = 0; i < COLUMNS.length; i++) {
    await addColumn({ ...COLUMNS[i], slotIdx: i });
  }

  document.getElementById('col-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-n]');
    if (!btn) return;
    const slotIdx = parseInt(btn.dataset.n, 10) - 1;
    if (Number.isFinite(slotIdx)) toggleSlot(slotIdx);
  });

  // Per-column ResizeObserver in mountTerminal handles window resize too, so
  // no need for a redundant top-level listener that would race the debounced
  // per-column refit and call the non-scrollbar-aware fit.fit().
}

function injectScrollbarStyle() {
  const s = document.createElement('style');
  s.textContent = `
    ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
    ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-track, ::-webkit-scrollbar-corner { display: none !important; background: transparent !important; }
    * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  `;
  document.head.appendChild(s);
}

window.addEventListener('DOMContentLoaded', () => {
  injectScrollbarStyle();
  main();
});
