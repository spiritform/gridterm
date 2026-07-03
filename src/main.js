import { Terminal } from './vendor/xterm/xterm.mjs';
import { FitAddon } from './vendor/addon-fit/addon-fit.mjs';
import { Unicode11Addon } from './vendor/addon-unicode11/addon-unicode11.mjs';
import { WebglAddon } from './vendor/addon-webgl/addon-webgl.mjs';

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const { homeDir } = window.__TAURI__.path;

const DEFAULT_ACCENTS = ['#ff8c42', '#4ade80', '#7c9eff'];

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
  return DEFAULT_ACCENTS.map((accent, i) => {
    const base = {
      id: `term${i + 1}`,
      project: `terminal ${i + 1}`,
      cli: 'cmd',
      cwd: home,
      accent,
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
  background: '#131318',
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
    fontFamily: '"Cascadia Code", "Cascadia Mono", "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
    fontSize: 13,
    fontWeight: 500,
    fontWeightBold: 700,
    lineHeight: 1.55,
    letterSpacing: 0.3,
    theme: XTERM_THEME,
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

  // Only the cwd is editable — titles are set by claude auto-register.
  const commitCwd = () => {
    const val = cwdEl.textContent.trim();
    if (!val || typeof col.slotIdx !== 'number') return;
    saveSlotOverride(col.slotIdx, { cwd: val });
    cwdEl.title = val;
    // Actually cd into the new folder so the terminal reflects it immediately.
    // OSC 9;9 will fire on the next prompt and update the title from the basename.
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
  for (const btn of document.querySelectorAll('#col-picker button')) {
    const slotIdx = parseInt(btn.dataset.n, 10) - 1;
    const slotCfg = COLUMNS[slotIdx];
    const active = mounted.some((m) => m.col.slotIdx === slotIdx);
    btn.classList.toggle('active', active);
    btn.style.setProperty('--dot-color', slotCfg?.accent || 'var(--text)');
  }
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
