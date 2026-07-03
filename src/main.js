import { Terminal } from './vendor/xterm/xterm.mjs';
import { FitAddon } from './vendor/addon-fit/addon-fit.mjs';
import { Unicode11Addon } from './vendor/addon-unicode11/addon-unicode11.mjs';

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const { homeDir } = window.__TAURI__.path;

const DEFAULT_ACCENTS = ['#ff8c42', '#7c9eff', '#b967ff', '#4ade80'];

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
  background: '#0b0b0c',
  foreground: '#e6e6e8',
  cursor: '#e6e6e8',
  cursorAccent: '#0b0b0c',
  selectionBackground: 'rgba(255,255,255,0.15)',
  black: '#0b0b0c',
  red: '#e06c75',
  green: '#6bcf7f',
  yellow: '#e5c07b',
  blue: '#7c9eff',
  magenta: '#b967ff',
  cyan: '#56b6c2',
  white: '#e6e6e8',
  brightBlack: '#55555c',
  brightRed: '#e06c75',
  brightGreen: '#6bcf7f',
  brightYellow: '#e5c07b',
  brightBlue: '#8ab4f8',
  brightMagenta: '#b967ff',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
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
    fontFamily: 'Cascadia Mono, Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.2,
    theme: XTERM_THEME,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
  });
  const fit = new FitAddon();
  const unicode11 = new Unicode11Addon();
  term.loadAddon(fit);
  term.loadAddon(unicode11);
  term.unicode.activeVersion = '11';
  term.open(bodyEl);
  // Wait for the browser to lay out the terminal body before measuring it.
  await new Promise((r) => requestAnimationFrame(r));
  try { fit.fit(); } catch (_) {}

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

  await invoke('spawn_pty', {
    id: col.id,
    shell: null,
    cwd: col.cwd,
    cols: term.cols,
    rows: term.rows,
  });

  requestAnimationFrame(() => {
    try {
      fit.fit();
      invoke('resize_pty', { id: col.id, cols: term.cols, rows: term.rows });
    } catch (_) {}
  });

  // Refit on any size change of this column's body (window resize, maximize toggle, etc.)
  const ro = new ResizeObserver(() => {
    try {
      fit.fit();
      invoke('resize_pty', { id: col.id, cols: term.cols, rows: term.rows });
    } catch (_) {}
  });
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

  // Image paste: intercept before xterm swallows it as a text-only paste.
  bodyEl.addEventListener(
    'paste',
    async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          const blob = item.getAsFile();
          if (!blob) return;
          const buf = await blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buf));
          try {
            const path = await invoke('save_paste_image', { bytes });
            await invoke('write_pty', { id: col.id, data: path });
          } catch (_) {}
          return;
        }
      }
    },
    true,
  );

  return { term, fit };
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

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const m of mounted) {
        if (!m.fit) continue;
        m.fit.fit();
        invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
      }
    }, 100);
  });
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
