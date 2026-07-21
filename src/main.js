import { Terminal } from './vendor/xterm/xterm.mjs';
import { FitAddon } from './vendor/addon-fit/addon-fit.mjs';
import { Unicode11Addon } from './vendor/addon-unicode11/addon-unicode11.mjs';
import { WebglAddon } from './vendor/addon-webgl/addon-webgl.mjs';
import { WebLinksAddon } from './vendor/addon-web-links/addon-web-links.mjs';

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

const DEFAULT_AUTO_CLI = '';
function loadSlotAutoCli(slotIdx) {
  const raw = localStorage.getItem(`gridterm.autoCli.${slotIdx}`);
  return raw === null ? DEFAULT_AUTO_CLI : raw;
}
function saveSlotAutoCli(slotIdx, cmd) {
  if (cmd === DEFAULT_AUTO_CLI) localStorage.removeItem(`gridterm.autoCli.${slotIdx}`);
  else localStorage.setItem(`gridterm.autoCli.${slotIdx}`, cmd);
}

const DEFAULT_DIM_INACTIVE = true;
function loadDimInactive() {
  const raw = localStorage.getItem('gridterm.dimInactive');
  if (raw === null) return DEFAULT_DIM_INACTIVE;
  return raw === 'true';
}
function saveDimInactive(on) {
  localStorage.setItem('gridterm.dimInactive', on ? 'true' : 'false');
}
function applyDimInactive(on) {
  saveDimInactive(on);
  document.body.classList.toggle('dim-inactive-off', !on);
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
  // Title always follows the current folder's basename. Manual pins are
  // session-only — a cwd change (or a fresh load) drops them.
  const titleText = col.cwd
    ? (col.cwd.split(/[\\/]/).filter(Boolean).pop() || col.cwd)
    : col.project;
  el.innerHTML = `
    <div class="term-header">
      <div class="info">
        <div class="project" contenteditable="plaintext-only" spellcheck="false">${titleText}</div>
        <div class="meta">
          <span class="cwd-display" contenteditable="plaintext-only" spellcheck="false" title="${col.cwd}">${col.cwd}</span>
        </div>
      </div>
      <div class="header-tags">
        <span class="cli">${col.cli}</span>
        <span class="badge">${col.badge}</span>
        <div class="dot"></div>
        <button class="col-power" aria-label="reset terminal">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
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
  const webLinks = new WebLinksAddon((event, uri) => {
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      invoke('plugin:opener|open_url', { url: uri }).catch(() => {});
    }
  });
  term.loadAddon(fit);
  term.loadAddon(unicode11);
  term.loadAddon(webLinks);
  term.unicode.activeVersion = '11';
  term.open(bodyEl);

  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
        return false;
      }
    }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'C' || e.key === 'c')) {
      const sel = term.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
        term.clearSelection();
        return false;
      }
    }
    return true;
  });

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
  // If the slot was loaded with a manually pinned title, prime registeredProject
  // so the OSC-9 auto-basename doesn't overwrite it before claude runs.
  if (col.manualProject && col.project) {
    col.registeredProject = col.project;
  }
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
      // Keep the title in sync with the current folder as the user cd's
      // around. A cwd change also drops any session-only manual pin.
      if (projectEl && cwd && document.activeElement !== projectEl) {
        const basename = cwd.split(/[\\/]/).filter(Boolean).pop() || cwd;
        projectEl.textContent = basename;
        col.registeredProject = basename;
        col.manualProject = false;
      }
      // Persist the current cwd so restarts land back here. Also clear any
      // stored manualProject flag so a stale pin doesn't outlive the folder.
      if (cwd && typeof col.slotIdx === 'number') {
        saveSlotOverride(col.slotIdx, { cwd, manualProject: false });
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
    // Alt-screen enter/exit is a reliable signal that a TUI (claude, vim, etc.)
    // is running, independent of the sysinfo child-process walk which can miss
    // Windows process trees. Feeds the power button's running state.
    const data = e.payload;
    if (data.includes('\x1b[?1049h') || data.includes('\x1b[?47h')) {
      col._altScreen = true;
      col._syncPower?.();
    } else if (data.includes('\x1b[?1049l') || data.includes('\x1b[?47l')) {
      col._altScreen = false;
      col._syncPower?.();
    }
  });

  await listen(`pty-close-${col.id}`, () => {
    // Suppress the exit notice when the close was triggered by our own reset —
    // the fresh shell is about to render its own prompt, so a dangling
    // "[process exited]" would just be noise.
    if (!col._resetting) {
      term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
    }
    col._altScreen = false;
    col._claudeIntent = false;
    col._syncPower?.();
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
      // Register the current cwd as this slot's identity. Title always
      // tracks the folder basename — any prior manual pin is released.
      const nowCwd = cwdEl?.title || cwdEl?.textContent || '';
      if (nowCwd && typeof col.slotIdx === 'number') {
        const basename = nowCwd.split(/[\\/]/).filter(Boolean).pop() || nowCwd;
        saveSlotOverride(col.slotIdx, { project: basename, cwd: nowCwd, manualProject: false });
        col.registeredProject = basename;
        col.manualProject = false;
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
    if (e.target.closest('.project')) return;
    if (e.target.closest('.col-close')) return;
    if (dragActivated) return;
    term.focus();
  });

  const powerBtn = colEl.querySelector('.col-power');
  if (powerBtn) {
    // Swallow pointerdown so the header's drag-start handler doesn't fire.
    powerBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    powerBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (powerBtn.dataset.resetting === '1') return;
      powerBtn.dataset.resetting = '1';
      col._resetting = true;
      try {
        // Full reset: kill the PTY (child.kill() on the Rust side), then respawn
        // a fresh cmd.exe at the current header cwd. Works for any CLI — no
        // per-tool special-casing. If the slot has an auto-launch CLI configured
        // in Settings, it runs once the fresh shell is ready.
        const currentCwd = (cwdEl?.title || cwdEl?.textContent || col.cwd || '').trim();
        await invoke('kill_pty', { id: col.id });
        try { term.reset(); } catch (_) {}
        col._altScreen = false;
        col._claudeIntent = false;
        // Give the old reader thread a beat to finish emitting the child's last
        // bytes before the fresh spawn re-uses the same pty-data event name.
        await new Promise((r) => setTimeout(r, 150));
        await invoke('spawn_pty', {
          id: col.id,
          shell: null,
          cwd: currentCwd || null,
          cols: term.cols,
          rows: term.rows,
        });
        const cmd = typeof col.slotIdx === 'number' ? loadSlotAutoCli(col.slotIdx) : '';
        if (cmd) {
          // Wait for the fresh cmd.exe prompt to render before typing.
          await new Promise((r) => setTimeout(r, 200));
          await invoke('write_pty', { id: col.id, data: cmd + '\r' });
        }
        try { term.scrollToBottom(); } catch (_) {}
        col._syncPower?.();
      } finally {
        delete powerBtn.dataset.resetting;
        col._resetting = false;
      }
    });
    // Keep a subtle "active" hint on the icon when a CLI is running inside —
    // pure visual cue, click behavior is always reset.
    const syncPower = () => {
      const running =
        (badgeEl && badgeEl.classList.contains('badge-active')) ||
        col._altScreen === true ||
        col._claudeIntent === true;
      powerBtn.classList.toggle('running', !!running);
      const cmd = loadSlotAutoCli(col.slotIdx ?? 0);
      powerBtn.title = cmd ? `Reset terminal (relaunches ${cmd})` : 'Reset terminal';
    };
    col._syncPower = syncPower;
    syncPower();
    if (badgeEl) {
      new MutationObserver(syncPower).observe(badgeEl, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // The title is also editable — useful for naming a slot before the folder
  // exists (e.g. a fresh project under claudecode-projects/). Editing pins the
  // name so cwd changes don't overwrite it.
  const commitProject = () => {
    const val = projectEl.textContent.trim();
    if (!val) {
      const restore = col.registeredProject || col.project || '';
      projectEl.textContent = restore;
      return;
    }
    if (typeof col.slotIdx === 'number') {
      saveSlotOverride(col.slotIdx, { project: val, manualProject: true });
    }
    col.registeredProject = val;
    col.manualProject = true;
    projectEl.textContent = val;
  };
  if (projectEl) {
    projectEl.addEventListener('blur', commitProject);
    projectEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    });
    projectEl.addEventListener('focus', () => {
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(projectEl);
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  const commitCwd = () => {
    const val = cwdEl.textContent.trim();
    if (!val) {
      // User deleted the whole path — restore the last known cwd so the
      // header layout doesn't collapse into a title-only row.
      const restore = cwdEl.title || col.cwd || '';
      cwdEl.textContent = restore;
      return;
    }
    if (typeof col.slotIdx !== 'number') return;
    // Manually pasting a new cwd re-identifies the slot: title always
    // updates to the new folder's basename and any manual pin is dropped.
    const basename = val.split(/[\\/]/).filter(Boolean).pop() || val;
    saveSlotOverride(col.slotIdx, { cwd: val, project: basename, manualProject: false });
    cwdEl.title = val;
    col.registeredProject = basename;
    col.manualProject = false;
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
  // Auto-select the whole path on focus so pasting a new one replaces it
  // instead of appending — no need to backspace first.
  cwdEl.addEventListener('focus', () => {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(cwdEl);
    sel.removeAllRanges();
    sel.addRange(range);
  });

  return { term, fit, refit: fitNoScrollbarReserve };
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
      // term.paste() wraps in bracketed-paste sequences when the app enabled
      // that mode (Claude Code does), which makes Claude Code recognize the
      // path as a paste and render it as `[Image #N]` instead of the raw path.
      if (targetCol.term) targetCol.term.paste(path);
      else await invoke('write_pty', { id: targetCol.col.id, data: path });
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

  // Take over Ctrl+V entirely when the focus is on a terminal. WebView2's
  // paste event doesn't reliably reach xterm's helper textarea for plain
  // Ctrl+V inside bracketed-paste apps (Claude Code), so we read the
  // clipboard from Rust and inject through term.paste() — which wraps in
  // bracketed-paste sequences when the running app enabled them and passes
  // raw text otherwise. Ctrl+Shift+V is left alone so the browser's native
  // paste path stays available as a fallback.
  document.addEventListener(
    'keydown',
    async (e) => {
      if (!(e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'v' || e.key === 'V'))) return;
      const active = document.activeElement;
      if (!active || !active.classList || !active.classList.contains('xterm-helper-textarea')) return;
      const target = findFocusedColumn();
      if (!target || !target.term) return;
      e.preventDefault();
      e.stopPropagation();
      // Prefer text when the clipboard has both (e.g. a spreadsheet cell
      // copied with a bitmap fallback) — image paste only wins when the
      // clipboard is image-only, so plain-text copy always pastes as text.
      try {
        const text = await invoke('read_clipboard_text');
        if (text) {
          target.term.paste(text);
          return;
        }
      } catch (_) {}
      try {
        const path = await invoke('read_clipboard_image');
        if (path) target.term.paste(path);
      } catch (_) {}
    },
    true,
  );
}

// Tauri intercepts OS-level file drops before HTML5 drag events fire, so we
// hook the `tauri://drag-drop` event instead. Drop an image or PDF on any
// column to paste its path into that column's PTY (Claude Code reads both).
function wireImageDrop() {
  const DROP_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?|avif|heic|svg|pdf)$/i;
  listen('tauri://drag-drop', async (e) => {
    const payload = e.payload || {};
    const paths = payload.paths || [];
    if (!paths.length) return;
    const imagePaths = paths.filter((p) => DROP_RE.test(p));
    if (!imagePaths.length) return;

    // Position comes in physical pixels; convert to CSS coords for hit-testing.
    const dpr = window.devicePixelRatio || 1;
    const cssX = (payload.position?.x ?? 0) / dpr;
    const cssY = (payload.position?.y ?? 0) / dpr;
    let target = null;
    const hit = document.elementFromPoint(cssX, cssY);
    const colEl = hit && hit.closest('.term');
    if (colEl) target = mounted.find((m) => m.colEl === colEl);
    if (!target) target = findFocusedColumn();
    if (!target || !target.term) return;

    // term.paste() wraps in bracketed paste when the running app enabled it,
    // so Claude Code shows `[Image #N]` instead of the raw disk path.
    for (const p of imagePaths) {
      target.term.paste(p);
    }
  });
}

const mounted = [];
// Slots that were toggled off via the dot: PTY + xterm stay alive, but the
// column element is detached from the grid so it's not visible. Re-showing
// re-appends the same element — scrollback, running Claude session, etc.
// all survive.
const hidden = [];

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
    const isVisible = mounted.some((m) => m.col.slotIdx === slotIdx);
    const isHidden = !isVisible && hidden.some((h) => h.col.slotIdx === slotIdx);
    btn.classList.toggle('active', isVisible);
    btn.classList.toggle('alive', isHidden);
    btn.style.setProperty('--dot-color', slotCfg?.accent || 'var(--text)');
  }
}

// Cell metrics change with font size/weight/family. xterm re-measures the char
// size on the next frame, so we wait a couple rAFs before refitting — otherwise
// the fit reads stale cell width and columns end up short (leaving a padding
// gap on the right until the next resize). Also clear the WebGL texture atlas
// so cached glyphs at the old metrics don't render.
async function refitAfterFontChange() {
  for (const m of mounted) {
    if (!m.term) continue;
    try { m.term.clearTextureAtlas?.(); } catch (_) {}
  }
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  for (const m of mounted) {
    if (!m.term) continue;
    try {
      if (m.refit) m.refit();
      else if (m.fit) m.fit.fit();
      invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
    } catch (_) {}
  }
}

// Font/theme updates target both visible and hidden entries so a hidden
// slot doesn't render with stale settings the moment it's shown again.
function allEntries() {
  return [...mounted, ...hidden];
}

function applyFontSize(size) {
  saveFontSize(size);
  for (const m of allEntries()) {
    if (!m.term) continue;
    try { m.term.options.fontSize = size; } catch (_) {}
  }
  refitAfterFontChange();
}

function applyFontWeight(weight) {
  saveFontWeight(weight);
  for (const m of allEntries()) {
    if (!m.term) continue;
    try { m.term.options.fontWeight = weight; } catch (_) {}
  }
  refitAfterFontChange();
}

function applyFontFamily(id) {
  saveFontFamilyId(id);
  const stack = currentFontStack();
  for (const m of allEntries()) {
    if (!m.term) continue;
    try { m.term.options.fontFamily = stack; } catch (_) {}
  }
  refitAfterFontChange();
}

function applySlotBg(slotIdx, hex) {
  saveSlotBg(slotIdx, hex);
  for (const m of allEntries()) {
    if (m.col.slotIdx !== slotIdx) continue;
    m.colEl.style.setProperty('--tint-bg', hex);
    if (m.term) {
      try { m.term.options.theme = slotTheme(slotIdx); } catch (_) {}
    }
  }
}

function applySlotFg(slotIdx, hex) {
  saveSlotFg(slotIdx, hex);
  for (const m of allEntries()) {
    if (m.col.slotIdx !== slotIdx) continue;
    if (m.term) {
      try { m.term.options.theme = slotTheme(slotIdx); } catch (_) {}
    }
  }
}

function applySlotAccent(slotIdx, hex) {
  saveSlotAccent(slotIdx, hex);
  if (COLUMNS[slotIdx]) COLUMNS[slotIdx].accent = hex;
  for (const m of allEntries()) {
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

  const dimButtons = document.querySelectorAll('.seg-btn[data-dim]');
  const syncDimButtons = () => {
    const on = loadDimInactive();
    for (const b of dimButtons) {
      const active = (b.dataset.dim === 'on') === on;
      b.classList.toggle('active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    }
  };
  const syncFromStorage = () => {
    input.value = String(loadFontSize());
    weightSel.value = String(loadFontWeight());
    familySel.value = loadFontFamilyId();
    syncDimButtons();
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
    for (const inp of document.querySelectorAll('[data-auto-cli-input]')) {
      const idx = parseInt(inp.dataset.autoCliInput, 10);
      inp.value = loadSlotAutoCli(idx);
    }
    for (const dot of document.querySelectorAll('[data-auto-cli-dot]')) {
      const idx = parseInt(dot.dataset.autoCliDot, 10);
      dot.style.background = loadSlotAccent(idx);
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
  for (const b of dimButtons) {
    b.addEventListener('click', () => {
      applyDimInactive(b.dataset.dim === 'on');
      syncDimButtons();
    });
  }

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
  for (const inp of document.querySelectorAll('[data-auto-cli-input]')) {
    inp.addEventListener('input', () => {
      const slotIdx = parseInt(inp.dataset.autoCliInput, 10);
      saveSlotAutoCli(slotIdx, inp.value);
      // Refresh the power button tooltip on any mounted/hidden slot with this idx.
      for (const m of allEntries()) {
        if (m.col.slotIdx !== slotIdx) continue;
        const pb = m.colEl.querySelector('.col-power');
        if (pb && !pb.classList.contains('running')) {
          pb.title = `Run ${inp.value || 'shell'}`;
        }
      }
    });
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
    applyDimInactive(DEFAULT_DIM_INACTIVE);
    for (let i = 0; i < 3; i++) {
      applySlotBg(i, BASE_BG);
      applySlotFg(i, BASE_FG);
      applySlotAccent(i, DEFAULT_ACCENTS[i]);
      saveSlotAutoCli(i, DEFAULT_AUTO_CLI);
    }
    syncFromStorage();
  });
}

async function addColumn(col) {
  const grid = document.getElementById('grid');
  const colEl = buildColumn(col);
  grid.appendChild(colEl);
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
    entry = { col, colEl, term: null, fit: null, refit: null };
  }
  mounted.push(entry);
  updateCount();
}

function refitAllVisible() {
  requestAnimationFrame(() => {
    for (const m of mounted) {
      if (!m.fit) continue;
      if (m.refit) m.refit();
      else m.fit.fit();
      if (m.term) invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
    }
  });
}

function hideSlot(slotIdx) {
  const idx = mounted.findIndex((m) => m.col.slotIdx === slotIdx);
  if (idx < 0) return;
  const [m] = mounted.splice(idx, 1);
  m.colEl.remove();
  hidden.push(m);
  updateCount();
}

async function showSlot(slotIdx) {
  const idx = hidden.findIndex((h) => h.col.slotIdx === slotIdx);
  if (idx < 0) return;
  const [m] = hidden.splice(idx, 1);
  document.getElementById('grid').appendChild(m.colEl);
  mounted.push(m);
  updateCount();
  // Column width almost certainly changed while hidden — do a proper
  // scrollbar-aware refit before letting xterm redraw.
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  try {
    if (m.refit) m.refit();
    else if (m.fit) m.fit.fit();
    if (m.term) invoke('resize_pty', { id: m.col.id, cols: m.term.cols, rows: m.term.rows });
  } catch (_) {}
}

async function toggleSlot(slotIdx) {
  if (mounted.some((m) => m.col.slotIdx === slotIdx)) {
    // Visible → hide (session keeps running in the background).
    if (mounted.length <= 1) return;
    hideSlot(slotIdx);
    refitAllVisible();
    return;
  }
  if (hidden.some((h) => h.col.slotIdx === slotIdx)) {
    // Hidden → reveal existing session, no new spawn.
    await showSlot(slotIdx);
    refitAllVisible();
    return;
  }
  // Slot was killed (or never spawned) → fresh spawn.
  const base = COLUMNS[slotIdx];
  if (!base) return;
  const col = { ...base, id: `${base.id}-${Date.now().toString(36)}`, slotIdx };
  await addColumn(col);
  refitAllVisible();
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
  wireImageDrop();
  wireSettingsModal();
  applyDimInactive(loadDimInactive());

  let home;
  try { home = await homeDir(); } catch (_) { home = 'C:\\'; }
  COLUMNS = makeDefaultColumns(home);

  // Open with just one terminal — users add more via the column-picker toggles.
  // COLUMNS still holds all slot defaults so toggling slot 1/2 spawns them
  // with the right accent/cwd/CLI overrides.
  document.getElementById('grid').style.setProperty('--cols', 1);
  await addColumn({ ...COLUMNS[0], slotIdx: 0 });

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
