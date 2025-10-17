const CADENCE_FACTORS = {
  day: 365.25 / 12,
  week: 52.1429 / 12,
  month: 1,
};

const SCOPE_FACTORS = {
  daily: 1 / 30.4375,
  weekly: 1 / 4.345,
  monthly: 1,
  yearly: 12,
};

const FUTURE_INTERVALS = [
  { label: '1 month', months: 1 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: '5 years', months: 60 },
  { label: '10 years', months: 120 },
];

const THEMES = {
  win95: { className: 'theme-win95', startWallpaper: 'Windows 95 Meadow' },
  winxp: { className: 'theme-winxp', startWallpaper: 'Windows XP Bliss' },
  winvista: { className: 'theme-winvista', startWallpaper: 'Windows Vista Aurora' },
  mac2000s: { className: 'theme-mac2000s', startWallpaper: 'Mac OS X Tiger Hills' },
};

const DEFAULT_CATEGORIES = [
  ['Rent / Mortgage', 1200, 'month'],
  ['Groceries', 150, 'week'],
  ['Transportation', 60, 'week'],
  ['Utilities', 220, 'month'],
  ['Streaming Services', 28, 'month'],
  ['Dining Out', 90, 'week'],
  ['Emergency Fund', 120, 'month'],
  ['Student Loans', 320, 'month'],
  ['Travel', 75, 'week'],
  ['Wellness', 45, 'week'],
];

const STATE_VERSION = 2;

const storageApi = typeof localStorage === 'undefined' ? null : localStorage;

const storage = {
  key: 'nostalgia-budget-state',
  load() {
    if (!storageApi) return null;
    try {
      const raw = storageApi.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== STATE_VERSION) return null;
      return parsed.payload;
    } catch (error) {
      console.warn('Failed to load state, starting fresh', error);
      return null;
    }
  },
  save(payload) {
    if (!storageApi) return;
    try {
      storageApi.setItem(this.key, JSON.stringify({ version: STATE_VERSION, payload }));
    } catch (error) {
      console.warn('Unable to persist state', error);
    }
  },
  clear() {
    if (!storageApi) return;
    storageApi.removeItem(this.key);
  },
};

const uid = (() => {
  let value = 0;
  return () => `id-${value++}`;
})();

function createDefaultState() {
  return {
    weeklyIncome: 1250,
    currency: 'USD',
    scope: 'monthly',
    savingsGoal: { target: 5000, months: 12 },
    categories: DEFAULT_CATEGORIES.map(([name, amount, cadence]) => ({
      id: uid(),
      name,
      cadence,
      monthlyAmount: cadenceToMonthly(amount, cadence),
    })),
    notifications: [],
    wallpaperHistory: [],
    lastTheme: 'win95',
    snakeHighScore: 0,
  };
}

const state = storage.load() ?? createDefaultState();

function ensureStateShape(current) {
  if (!Array.isArray(current.notifications)) current.notifications = [];
  if (!Array.isArray(current.wallpaperHistory)) current.wallpaperHistory = [];
  if (!current.lastTheme) current.lastTheme = 'win95';
  if (typeof current.snakeHighScore !== 'number') current.snakeHighScore = 0;
  if (!current.scope) current.scope = 'monthly';
  if (!current.savingsGoal) current.savingsGoal = { target: 5000, months: 12 };
  current.categories = current.categories.map((category) => ({
    id: category.id ?? uid(),
    name: category.name,
    cadence: category.cadence ?? 'month',
    monthlyAmount: typeof category.monthlyAmount === 'number'
      ? category.monthlyAmount
      : cadenceToMonthly(category.amount ?? 0, category.cadence ?? 'month'),
  }));
}

ensureStateShape(state);

const clone = typeof structuredClone === 'function' ? structuredClone : (value) => JSON.parse(JSON.stringify(value));

const history = [];
const future = [];

function pushHistory() {
  history.push(clone(state));
  if (history.length > 40) history.shift();
  future.length = 0;
}

function undo() {
  if (!history.length) return;
  future.push(clone(state));
  const previous = history.pop();
  Object.assign(state, previous);
  renderAll();
}

function redo() {
  if (!future.length) return;
  history.push(clone(state));
  const next = future.pop();
  Object.assign(state, next);
  renderAll();
}

function recordNotification(message, type = 'info') {
  state.notifications.unshift({ id: uid(), message, type, timestamp: new Date().toISOString() });
  state.notifications = state.notifications.slice(0, 12);
}

function cadenceToMonthly(amount, cadence) {
  return amount * CADENCE_FACTORS[cadence];
}

function monthlyToCadence(amount, cadence) {
  return amount / CADENCE_FACTORS[cadence];
}

function monthlyToScope(amount, scope) {
  return amount * SCOPE_FACTORS[scope];
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: state.currency }).format(value);
}

function totalMonthlyExpenses() {
  return state.categories.reduce((sum, category) => sum + category.monthlyAmount, 0);
}

function monthlyIncome() {
  return cadenceToMonthly(state.weeklyIncome, 'week');
}

function monthlySavings() {
  return Math.max(0, monthlyIncome() - totalMonthlyExpenses());
}

function savingsProgress() {
  const target = state.savingsGoal.target;
  if (!target) return 0;
  return Math.min(1, monthlySavings() * state.savingsGoal.months / target);
}

const windowRegistry = new Map();
let zIndexCounter = 100;

const desktop = document.getElementById('desktop');
const startButton = document.getElementById('start-button');
const startMenu = document.getElementById('start-menu');
const startMenuList = startMenu.querySelector('.start-menu__list');
const startSearch = document.getElementById('start-search');
const taskbarItems = document.getElementById('taskbar-items');
const themeSwitcher = document.getElementById('theme-switcher');
const taskbarClock = document.getElementById('taskbar-clock');
const screensaverButton = document.getElementById('screensaver-button');
const pipesCanvas = document.getElementById('pipes-canvas');
const wallpaper = document.getElementById('wallpaper');

function setTheme(themeKey) {
  const theme = THEMES[themeKey];
  if (!theme) return;
  desktop.classList.remove(...Object.values(THEMES).map((t) => t.className));
  desktop.classList.add(theme.className);
  themeSwitcher.value = themeKey;
  recordNotification(`${themeKey.toUpperCase()} mode engaged — wallpaper: ${theme.startWallpaper}`);
  state.lastTheme = themeKey;
  state.wallpaperHistory.unshift({ id: uid(), theme: themeKey, timestamp: new Date().toISOString() });
  state.wallpaperHistory = state.wallpaperHistory.slice(0, 20);
  storage.save(state);
}

function toggleStartMenu(forceVisible) {
  const visible = forceVisible ?? startMenu.getAttribute('aria-hidden') !== 'false';
  startMenu.setAttribute('aria-hidden', visible ? 'false' : 'true');
  startButton.setAttribute('aria-expanded', visible ? 'true' : 'false');
  if (visible) {
    startSearch.value = '';
    populateStartMenu();
    startSearch.focus();
  }
}

function closeStartMenu() {
  startMenu.setAttribute('aria-hidden', 'true');
  startButton.setAttribute('aria-expanded', 'false');
}

const WINDOW_BLUEPRINTS = {
  income: {
    title: 'Weekly Income & Currency',
    width: 420,
    height: 340,
    initialPosition: { x: 80, y: 80 },
    render: renderIncomeWindow,
  },
  categories: {
    title: 'Categories & Cadence',
    width: 640,
    height: 520,
    initialPosition: { x: 320, y: 120 },
    render: renderCategoriesWindow,
  },
  summary: {
    title: 'Budget Dashboard',
    width: 540,
    height: 460,
    initialPosition: { x: 180, y: 240 },
    render: renderSummaryWindow,
  },
  forecast: {
    title: 'Future Value Forecast',
    width: 520,
    height: 460,
    initialPosition: { x: 520, y: 260 },
    render: renderForecastWindow,
  },
  showcase: {
    title: 'Final Budget Showcase',
    width: 720,
    height: 520,
    initialPosition: { x: 260, y: 160 },
    className: 'window--showcase',
    render: renderShowcaseWindow,
  },
  snake: {
    title: 'Hidden Snake',
    width: 420,
    height: 420,
    initialPosition: { x: 460, y: 200 },
    render: renderSnakeWindow,
  },
  tips: {
    title: 'Budget Coach',
    width: 420,
    height: 420,
    initialPosition: { x: 120, y: 420 },
    render: renderTipsWindow,
  },
  notifications: {
    title: 'Notification Center',
    width: 420,
    height: 320,
    initialPosition: { x: 760, y: 200 },
    render: renderNotificationsWindow,
  },
  timeline: {
    title: 'Milestone Timeline',
    width: 540,
    height: 320,
    initialPosition: { x: 680, y: 100 },
    render: renderTimelineWindow,
  },
  goals: {
    title: 'Savings Goal Planner',
    width: 480,
    height: 360,
    initialPosition: { x: 160, y: 160 },
    render: renderGoalsWindow,
  },
};

const START_ITEMS = [
  { id: 'income', icon: '💼', label: 'Weekly Income' },
  { id: 'categories', icon: '🗂️', label: 'Categories' },
  { id: 'summary', icon: '📊', label: 'Dashboard' },
  { id: 'forecast', icon: '📈', label: 'Forecast' },
  { id: 'showcase', icon: '🎞️', label: 'Final Showcase' },
  { id: 'snake', icon: '🐍', label: 'Snake' },
  { id: 'screensaver', icon: '🛸', label: '3D Pipes Screensaver', action: () => toggleScreensaver(true) },
  { id: 'undo', icon: '↩️', label: 'Undo', action: undo },
  { id: 'redo', icon: '↪️', label: 'Redo', action: redo },
  { id: 'tips', icon: '🧠', label: 'Budget Coach' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'timeline', icon: '🗓️', label: 'Milestones' },
  { id: 'goals', icon: '🎯', label: 'Savings Goals' },
  { id: 'reset', icon: '🧹', label: 'Reset Workspace', action: resetWorkspace },
];

function populateStartMenu(filter = '') {
  startMenuList.innerHTML = '';
  START_ITEMS.filter((item) => item.label.toLowerCase().includes(filter.toLowerCase())).forEach((item) => {
    const li = document.createElement('li');
    li.className = 'start-menu__item';
    li.tabIndex = 0;
    li.role = 'menuitem';
    li.dataset.id = item.id;
    li.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
    li.addEventListener('click', () => {
      closeStartMenu();
      if (item.action) {
        item.action();
      } else {
        openWindow(item.id);
      }
    });
    li.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        li.click();
      }
    });
    startMenuList.appendChild(li);
  });
}

function resetWorkspace() {
  Object.assign(state, createDefaultState());
  recordNotification('Workspace reset to factory defaults.', 'success');
  storage.clear();
  renderAll();
}

function createWindow(id) {
  const blueprint = WINDOW_BLUEPRINTS[id];
  if (!blueprint) throw new Error(`Unknown window id ${id}`);

  const windowEl = document.createElement('section');
  windowEl.className = `window ${blueprint.className ?? ''}`;
  windowEl.dataset.state = 'normal';
  windowEl.dataset.id = id;
  windowEl.style.width = `${blueprint.width}px`;
  windowEl.style.height = `${blueprint.height}px`;
  windowEl.style.zIndex = ++zIndexCounter;
  windowEl.style.left = `${blueprint.initialPosition?.x ?? 160}px`;
  windowEl.style.top = `${blueprint.initialPosition?.y ?? 120}px`;

  const titlebar = document.createElement('header');
  titlebar.className = 'window__titlebar';
  titlebar.innerHTML = `
    <span class="window__title">${blueprint.title}</span>
    <span class="window__controls">
      <button class="window__button" data-action="minimize" title="Minimize" aria-label="Minimize window">_</button>
      <button class="window__button" data-action="maximize" title="Maximize" aria-label="Maximize window">□</button>
      <button class="window__button" data-action="close" title="Close" aria-label="Close window">✕</button>
    </span>
  `;
  windowEl.appendChild(titlebar);

  const body = document.createElement('div');
  body.className = 'window__body';
  windowEl.appendChild(body);

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'window__resize-handle';
  windowEl.appendChild(resizeHandle);

  windowEl.addEventListener('mousedown', () => focusWindow(id));
  titlebar.addEventListener('mousedown', (event) => startDrag(event, windowEl));
  resizeHandle.addEventListener('mousedown', (event) => startResize(event, windowEl));
  titlebar.querySelectorAll('.window__button').forEach((button) =>
    button.addEventListener('click', () => handleWindowControl(id, button.dataset.action))
  );

  windowEl.addEventListener('dblclick', (event) => {
    if (event.target.closest('.window__controls')) return;
    toggleMaximize(id);
  });

  const layer = document.getElementById('window-layer');
  layer.appendChild(windowEl);

  windowRegistry.set(id, { id, element: windowEl, blueprint });
  createTaskbarItem(id, blueprint.title);

  blueprint.render(body);
  return windowEl;
}

function openWindow(id) {
  const existing = windowRegistry.get(id);
  const windowEl = existing?.element ?? createWindow(id);
  windowEl.hidden = false;
  windowEl.dataset.state = 'normal';
  windowEl.style.display = 'flex';
  focusWindow(id);
  updateTaskbarState(id, 'open');
  windowRegistry.get(id).blueprint.render(windowEl.querySelector('.window__body'));
}

function focusWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  zIndexCounter += 1;
  record.element.style.zIndex = zIndexCounter;
  taskbarItems.querySelectorAll('.taskbar__item').forEach((item) => item.classList.toggle('taskbar__item--active', item.dataset.id === id));
}

function handleWindowControl(id, action) {
  switch (action) {
    case 'minimize':
      minimizeWindow(id);
      break;
    case 'maximize':
      toggleMaximize(id);
      break;
    case 'close':
      closeWindow(id);
      break;
  }
}

function minimizeWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  record.element.dataset.state = 'minimized';
  record.element.style.display = 'none';
  updateTaskbarState(id, 'minimized');
}

function toggleMaximize(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  const element = record.element;
  const isMaximized = element.dataset.state === 'maximized';
  if (isMaximized) {
    const prev = element.dataset.prevBounds && JSON.parse(element.dataset.prevBounds);
    if (prev) {
      Object.assign(element.style, prev);
    }
    element.dataset.state = 'normal';
  } else {
    element.dataset.prevBounds = JSON.stringify({ left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height });
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.width = `${desktop.clientWidth}px`;
    element.style.height = `${desktop.clientHeight - 48}px`;
    element.dataset.state = 'maximized';
  }
  updateTaskbarState(id, element.dataset.state);
}

function closeWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  if (id === 'snake' && snakeCleanup) {
    snakeCleanup();
    snakeCleanup = null;
  }
  record.element.style.display = 'none';
  record.element.dataset.state = 'closed';
  updateTaskbarState(id, 'closed');
}

function restoreWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  const element = record.element;
  element.dataset.state = 'normal';
  element.style.display = 'flex';
  focusWindow(id);
  updateTaskbarState(id, 'open');
}

function createTaskbarItem(id, title) {
  const button = document.createElement('button');
  button.className = 'taskbar__item';
  button.dataset.id = id;
  button.type = 'button';
  button.textContent = title;
  button.addEventListener('click', () => {
    const record = windowRegistry.get(id);
    if (!record) {
      openWindow(id);
      return;
    }
    const stateName = record.element.dataset.state;
    if (stateName === 'minimized' || stateName === 'closed') {
      restoreWindow(id);
    } else if (stateName === 'normal') {
      minimizeWindow(id);
    } else if (stateName === 'maximized') {
      minimizeWindow(id);
    }
  });
  taskbarItems.appendChild(button);
}

function updateTaskbarState(id, stateName) {
  const button = taskbarItems.querySelector(`[data-id="${id}"]`);
  if (!button) return;
  button.classList.toggle('taskbar__item--active', stateName === 'open' || stateName === 'maximized');
}

function startDrag(event, element) {
  if (element.dataset.state === 'maximized') return;
  const rect = element.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  function onMove(moveEvent) {
    const x = Math.min(desktop.clientWidth - rect.width / 3, Math.max(-rect.width / 3, moveEvent.clientX - offsetX));
    const y = Math.min(desktop.clientHeight - 120, Math.max(0, moveEvent.clientY - offsetY));
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function startResize(event, element) {
  if (element.dataset.state === 'maximized') return;
  const rect = element.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;

  function onMove(moveEvent) {
    const width = Math.max(320, rect.width + (moveEvent.clientX - startX));
    const height = Math.max(240, rect.height + (moveEvent.clientY - startY));
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function renderIncomeWindow(container) {
  container.innerHTML = `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel__heading"><span>Weekly Income</span><span class="badge">live</span></div>
        <label class="sr-only" for="income-input">Weekly income</label>
        <input id="income-input" type="number" min="0" step="1" value="${state.weeklyIncome}" />
        <p>Your monthly income estimate is <strong>${formatCurrency(monthlyIncome())}</strong>.</p>
      </div>
      <div class="panel">
        <div class="panel__heading">Currency</div>
        <div class="currency-switcher">
          <label for="currency-select">Currency:</label>
          <select id="currency-select">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
          </select>
        </div>
        <p>All values automatically adjust with live conversion. Rates sourced from daily averages.</p>
      </div>
      <div class="panel">
        <div class="panel__heading">Quick Actions</div>
        <div class="quick-actions">
          <button data-template="starter">Apply Starter Mix</button>
          <button data-template="zero">Zero-Based Budget</button>
          <button data-template="fire">FIRE Aggressive Savings</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel__heading">Shortcuts</div>
        <p>Press <kbd>Ctrl</kbd> + <kbd>Space</kbd> to open Start. Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to open the final showcase.</p>
      </div>
    </div>
  `;

  container.querySelector('#income-input').addEventListener('input', (event) => {
    pushHistory();
    state.weeklyIncome = Number(event.target.value) || 0;
    recordNotification('Weekly income updated.', 'success');
    renderAll();
  });

  const select = container.querySelector('#currency-select');
  select.value = state.currency;
  select.addEventListener('change', async (event) => {
    pushHistory();
    await updateCurrency(event.target.value);
    recordNotification(`Currency switched to ${state.currency}.`, 'success');
    renderAll();
  });

  container.querySelectorAll('.quick-actions button').forEach((button) =>
    button.addEventListener('click', () => applyTemplate(button.dataset.template))
  );
}

async function updateCurrency(newCurrency) {
  const previous = state.currency;
  if (newCurrency === previous) return;
  const rate = await fetchExchangeRate(previous, newCurrency);
  state.currency = newCurrency;
  state.weeklyIncome *= rate;
  state.categories.forEach((category) => {
    category.monthlyAmount *= rate;
  });
  storage.save(state);
}

async function fetchExchangeRate(from, to) {
  if (from === to) return 1;
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!response.ok) throw new Error('network');
    const data = await response.json();
    const rate = data.rates?.[to];
    if (!rate) throw new Error('currency');
    return rate;
  } catch (error) {
    recordNotification('Live rate unavailable. Using approximate conversion.', 'warning');
    const fallback = {
      USD: { EUR: 0.9, GBP: 0.78, JPY: 140 },
      EUR: { USD: 1.1, GBP: 0.86, JPY: 155 },
      GBP: { USD: 1.27, EUR: 1.16, JPY: 180 },
      JPY: { USD: 0.0071, EUR: 0.0064, GBP: 0.0056 },
    };
    return fallback[from]?.[to] ?? 1;
  }
}

function applyTemplate(template) {
  pushHistory();
  if (template === 'starter') {
    const preservedTheme = state.lastTheme;
    const preservedHighScore = state.snakeHighScore;
    Object.assign(state, createDefaultState(), {
      currency: state.currency,
      weeklyIncome: state.weeklyIncome,
      lastTheme: preservedTheme,
      snakeHighScore: preservedHighScore,
    });
  } else if (template === 'zero') {
    state.categories = [
      { id: uid(), name: 'Giving', cadence: 'month', monthlyAmount: monthlyIncome() * 0.1 },
      { id: uid(), name: 'Savings', cadence: 'month', monthlyAmount: monthlyIncome() * 0.25 },
      { id: uid(), name: 'Essentials', cadence: 'month', monthlyAmount: monthlyIncome() * 0.45 },
      { id: uid(), name: 'Fun', cadence: 'month', monthlyAmount: monthlyIncome() * 0.2 },
    ];
  } else if (template === 'fire') {
    state.categories = [
      { id: uid(), name: 'Lean Expenses', cadence: 'month', monthlyAmount: monthlyIncome() * 0.4 },
      { id: uid(), name: 'Investments', cadence: 'month', monthlyAmount: monthlyIncome() * 0.45 },
      { id: uid(), name: 'Experiences', cadence: 'month', monthlyAmount: monthlyIncome() * 0.15 },
    ];
  }
  recordNotification(`Applied ${template} template.`, 'success');
  renderAll();
}

function renderCategoriesWindow(container) {
  container.innerHTML = `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel__heading">Expense Categories</div>
        <table class="table" aria-label="Expense categories">
          <thead>
            <tr>
              <th>Name</th>
              <th>Amount</th>
              <th>Cadence</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody id="category-rows"></tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel__heading">Add Custom Category</div>
        <form id="category-form" class="panel-grid">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Amount
            <input name="amount" type="number" step="0.01" min="0" required />
          </label>
          <label>
            Cadence
            <select name="cadence">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month" selected>Monthly</option>
            </select>
          </label>
          <button type="submit">Add Category</button>
        </form>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#category-rows');
  tbody.innerHTML = '';
  state.categories.forEach((category) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${category.name}</td>
      <td><input type="number" min="0" step="0.01" value="${monthlyToCadence(category.monthlyAmount, category.cadence).toFixed(2)}" /></td>
      <td>
        <select>
          <option value="day" ${category.cadence === 'day' ? 'selected' : ''}>Daily</option>
          <option value="week" ${category.cadence === 'week' ? 'selected' : ''}>Weekly</option>
          <option value="month" ${category.cadence === 'month' ? 'selected' : ''}>Monthly</option>
        </select>
      </td>
      <td>
        <button data-action="focus">Focus</button>
        <button data-action="delete">Delete</button>
      </td>
    `;
    const amountInput = row.querySelector('input');
    const cadenceSelect = row.querySelector('select');

    amountInput.addEventListener('input', () => {
      pushHistory();
      category.monthlyAmount = cadenceToMonthly(Number(amountInput.value) || 0, category.cadence);
      renderAll();
    });

    cadenceSelect.addEventListener('change', () => {
      pushHistory();
      const value = cadenceSelect.value;
      const currentAmount = Number(amountInput.value) || 0;
      category.cadence = value;
      category.monthlyAmount = cadenceToMonthly(currentAmount, value);
      renderAll();
    });

    row.querySelector('[data-action="delete"]').addEventListener('click', () => {
      pushHistory();
      state.categories = state.categories.filter((item) => item.id !== category.id);
      recordNotification(`${category.name} removed.`, 'warning');
      renderAll();
    });

    row.querySelector('[data-action="focus"]').addEventListener('click', () => {
      recordNotification(`${category.name} focus mode: consider trimming 5% for savings boost.`);
    });

    tbody.appendChild(row);
  });

  container.querySelector('#category-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const name = data.get('name').toString().trim();
    const amount = Number(data.get('amount'));
    const cadence = data.get('cadence');
    if (!name || Number.isNaN(amount)) return;
    pushHistory();
    state.categories.push({ id: uid(), name, cadence, monthlyAmount: cadenceToMonthly(amount, cadence) });
    form.reset();
    recordNotification(`${name} added to your plan.`, 'success');
    renderAll();
  });
}

function renderSummaryWindow(container) {
  const expensesMonthly = totalMonthlyExpenses();
  const incomeMonthly = monthlyIncome();
  const savingsMonthly = monthlySavings();
  const scope = state.scope;
  const scopes = Object.keys(SCOPE_FACTORS);
  const coverage = incomeMonthly ? Math.min(1, expensesMonthly / incomeMonthly) : 0;
  const savingsRate = incomeMonthly ? (savingsMonthly / incomeMonthly) * 100 : 0;

  container.innerHTML = `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel__heading">
          Scope &amp; Totals
          <select id="scope-select">${scopes
            .map((key) => `<option value="${key}" ${key === scope ? 'selected' : ''}>${key[0].toUpperCase()}${key.slice(1)}</option>`)
            .join('')}</select>
        </div>
        <p>Income: <strong>${formatCurrency(monthlyToScope(incomeMonthly, scope))}</strong></p>
        <p>Expenses: <strong>${formatCurrency(monthlyToScope(expensesMonthly, scope))}</strong></p>
        <p>Savings: <strong>${formatCurrency(monthlyToScope(savingsMonthly, scope))}</strong></p>
      </div>
      <div class="panel">
        <div class="panel__heading">Budget Health</div>
        <div class="meter"><div class="meter__fill" style="width:${(coverage * 100).toFixed(0)}%"></div></div>
        <p>${(coverage * 100).toFixed(1)}% of income allocated. Savings rate ${savingsRate.toFixed(1)}%.</p>
      </div>
      <div class="panel">
        <div class="panel__heading">Category Breakdown</div>
        <ul class="note-list">
          ${state.categories
            .map(
              (category) => `
                <li>
                  <strong>${category.name}</strong>
                  <span>${formatCurrency(monthlyToScope(category.monthlyAmount, scope))} (${category.cadence})</span>
                </li>
              `
            )
            .join('')}
        </ul>
      </div>
      <div class="panel">
        <div class="panel__heading">Automations</div>
        <p>Auto transfer suggestion: ${formatCurrency(savingsMonthly)} monthly to hit your savings goal.</p>
        <button id="open-showcase">Open Final Showcase</button>
        <button id="export-json">Export Plan JSON</button>
        <input type="file" id="import-json" accept="application/json" hidden />
        <button id="import-button">Import Plan</button>
      </div>
    </div>
  `;

  container.querySelector('#scope-select').addEventListener('change', (event) => {
    pushHistory();
    state.scope = event.target.value;
    renderAll();
  });

  container.querySelector('#open-showcase').addEventListener('click', () => openWindow('showcase'));

  container.querySelector('#export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'nostalgia-budget-plan.json';
    link.click();
  });

  container.querySelector('#import-button').addEventListener('click', () => container.querySelector('#import-json').click());
  container
    .querySelector('#import-json')
    .addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        pushHistory();
        Object.assign(state, payload);
        recordNotification('Plan imported successfully.', 'success');
        renderAll();
      } catch (error) {
        recordNotification('Unable to import plan.', 'danger');
      }
    });
}

function renderForecastWindow(container) {
  container.innerHTML = `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel__heading">Future Values</div>
        <div class="timeline">
          ${FUTURE_INTERVALS.map((interval) => {
            const totalSavings = monthlySavings() * interval.months;
            const invested = totalSavings * 1.05;
            return `<div class="timeline__item"><strong>${interval.label}</strong><p>Savings: ${formatCurrency(totalSavings)}</p><p>Invest@5%: ${formatCurrency(invested)}</p></div>`;
          }).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel__heading">Lifestyle Snapshot</div>
        <p>If you maintain this plan, you'll reach ${formatCurrency(state.savingsGoal.target)} in ${state.savingsGoal.months} months.</p>
        <p>Stretch Goal: Retire early at ${formatCurrency(monthlySavings() * 300)} (25x expenses rule).</p>
      </div>
      <div class="panel">
        <div class="panel__heading">Reminders</div>
        <ul class="note-list">
          <li>Schedule a monthly review on the 1st.</li>
          <li>Automate transfers using your bank's bill-pay feature.</li>
          <li>Revisit goals after major life events.</li>
        </ul>
      </div>
    </div>
  `;
}

function renderShowcaseWindow(container) {
  container.innerHTML = `
    <div class="showcase">
      <div class="showcase__hero">
        <h2>Nostalgia Budget Showcase</h2>
        <p>${new Date().toLocaleString()}</p>
        <button id="print-button">Print / Save as PDF</button>
      </div>
      <div class="showcase__grid">
        <div class="showcase__card">
          <h3>Income</h3>
          <p>${formatCurrency(monthlyIncome())} monthly</p>
          <p>${formatCurrency(monthlyToScope(monthlyIncome(), 'yearly'))} yearly</p>
        </div>
        <div class="showcase__card">
          <h3>Expenses</h3>
          <p>${formatCurrency(totalMonthlyExpenses())} monthly</p>
          <p>${formatCurrency(monthlyToScope(totalMonthlyExpenses(), 'yearly'))} yearly</p>
        </div>
        <div class="showcase__card">
          <h3>Savings Potential</h3>
          <p>${formatCurrency(monthlySavings())} monthly surplus</p>
          <p>${formatCurrency(monthlySavings() * 12)} yearly</p>
        </div>
        <div class="showcase__card">
          <h3>Savings Goal</h3>
          <p>Target ${formatCurrency(state.savingsGoal.target)} in ${state.savingsGoal.months} months.</p>
          <div class="meter"><div class="meter__fill" style="width:${(savingsProgress() * 100).toFixed(0)}%"></div></div>
        </div>
      </div>
      <div class="panel">
        <h3>Category Mix</h3>
        <ul class="note-list">
          ${state.categories
            .map(
              (category) => `<li>${category.name}: ${formatCurrency(category.monthlyAmount)} monthly (${category.cadence})</li>`
            )
            .join('')}
        </ul>
      </div>
    </div>
  `;

  container.querySelector('#print-button').addEventListener('click', () => window.print());
}

function renderTipsWindow(container) {
  container.innerHTML = `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel__heading">Personalized Insights</div>
        <ul class="note-list">
          <li>Move ${formatCurrency(monthlySavings() * 0.1)} into high-yield savings for an instant buffer.</li>
          <li>Automate ${formatCurrency(totalMonthlyExpenses() * 0.02)} to a "Treat Yourself" fund to avoid budget fatigue.</li>
          <li>Review subscriptions quarterly — aim to trim ${formatCurrency(totalMonthlyExpenses() * 0.03)}.</li>
        </ul>
      </div>
      <div class="panel">
        <div class="panel__heading">Wellness Reminders</div>
        <ul class="note-list">
          <li>Schedule a mental health day after each quarter.</li>
          <li>Plan community or friend nights using your fun category.</li>
        </ul>
      </div>
      <div class="panel">
        <div class="panel__heading">Power Tips</div>
        <p>Hit <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> to toggle pipes. Hit <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>N</kbd> for notifications.</p>
      </div>
    </div>
  `;
}

function renderNotificationsWindow(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel__heading">Latest Notifications</div>
      <ul class="note-list">
        ${state.notifications
          .map((entry) => `<li><strong>${new Date(entry.timestamp).toLocaleTimeString()}</strong> — ${entry.message}</li>`)
          .join('')}
      </ul>
    </div>
  `;
}

function renderTimelineWindow(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel__heading">Upcoming Milestones</div>
      <div class="timeline">
        ${generateMilestones()
          .map((milestone) => `<div class="timeline__item"><strong>${milestone.label}</strong><p>${milestone.detail}</p></div>`)
          .join('')}
      </div>
    </div>
  `;
}

function generateMilestones() {
  const milestones = [];
  const savingsPerMonth = monthlySavings();
  if (savingsPerMonth <= 0) {
    milestones.push({ label: 'Rebalance Needed', detail: 'Expenses exceed income. Trim 5% from non-essentials.' });
    return milestones;
  }
  for (let i = 1; i <= 6; i++) {
    const months = i * 3;
    milestones.push({
      label: `${months} months`,
      detail: `${formatCurrency(savingsPerMonth * months)} saved` + (months === state.savingsGoal.months ? ' (Goal Target)' : ''),
    });
  }
  milestones.push({ label: 'Freedom Number', detail: `${formatCurrency(savingsPerMonth * 300)} (25x expenses)` });
  return milestones;
}

function renderGoalsWindow(container) {
  container.innerHTML = `
    <div class="panel-grid">
      <div class="panel">
        <div class="panel__heading">Savings Goal</div>
        <label>Target Amount<input id="goal-target" type="number" min="0" value="${state.savingsGoal.target}" /></label>
        <label>Timeline (months)<input id="goal-months" type="number" min="1" value="${state.savingsGoal.months}" /></label>
        <p>Projected progress: ${(savingsProgress() * 100).toFixed(1)}%.</p>
      </div>
      <div class="panel">
        <div class="panel__heading">Goal Planner</div>
        <p>Save ${formatCurrency(state.savingsGoal.target / state.savingsGoal.months)} per month to stay on track.</p>
        <p>Your current surplus covers ${formatCurrency(monthlySavings())} per month.</p>
      </div>
    </div>
  `;

  container.querySelector('#goal-target').addEventListener('input', (event) => {
    pushHistory();
    state.savingsGoal.target = Number(event.target.value) || 0;
    recordNotification('Savings goal updated.');
    renderAll();
  });

  container.querySelector('#goal-months').addEventListener('input', (event) => {
    pushHistory();
    state.savingsGoal.months = Number(event.target.value) || 1;
    renderAll();
  });
}

let snakeCleanup = null;

function renderSnakeWindow(container) {
  container.innerHTML = `
    <canvas id="snake-canvas" width="360" height="320" style="width:100%;height:280px;background:#111;border-radius:8px;"></canvas>
    <p>Use arrow keys. Score: <span id="snake-score">0</span> | Best: <span id="snake-best">${state.snakeHighScore}</span></p>
    <button id="snake-reset">Reset Game</button>
  `;
  initSnakeGame(container.querySelector('#snake-canvas'));
}

function initSnakeGame(canvas) {
  if (snakeCleanup) {
    snakeCleanup();
    snakeCleanup = null;
  }
  const ctx = canvas.getContext('2d');
  const gridSize = 16;
  let snake = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
  ];
  let direction = { x: 1, y: 0 };
  let food = spawnFood();
  let score = 0;
  let running = true;

  function spawnFood() {
    return { x: Math.floor(Math.random() * (canvas.width / gridSize)), y: Math.floor(Math.random() * (canvas.height / gridSize)) };
  }

  function step() {
    if (!running) return;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if (head.x < 0 || head.y < 0 || head.x >= canvas.width / gridSize || head.y >= canvas.height / gridSize || snake.some((segment) => segment.x === head.x && segment.y === head.y)) {
      running = false;
      recordNotification(`Snake crashed with score ${score}.`, 'warning');
      state.snakeHighScore = Math.max(state.snakeHighScore, score);
      renderAll();
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      document.getElementById('snake-score').textContent = score;
      food = spawnFood();
    } else {
      snake.pop();
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2ecc71';
    snake.forEach((segment) => ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1));
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 1, gridSize - 1);
    requestAnimationFrame(step);
  }

  document.addEventListener('keydown', onKey);
  snakeCleanup = () => {
    running = false;
    document.removeEventListener('keydown', onKey);
  };
  canvas.closest('.window').querySelector('#snake-reset').addEventListener('click', () => {
    snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    direction = { x: 1, y: 0 };
    food = spawnFood();
    score = 0;
    running = true;
    document.getElementById('snake-score').textContent = '0';
    requestAnimationFrame(step);
  });

  function onKey(event) {
    switch (event.key) {
      case 'ArrowUp':
        if (direction.y !== 1) direction = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
        if (direction.y !== -1) direction = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
        if (direction.x !== 1) direction = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
        if (direction.x !== -1) direction = { x: 1, y: 0 };
        break;
    }
  }

  requestAnimationFrame(step);
}

let pipesAnimationFrame = null;
const pipesContext = pipesCanvas.getContext('2d');
let pipesState = null;

function toggleScreensaver(force) {
  if (force || !document.body.classList.contains('screensaver')) {
    startScreensaver();
  } else {
    stopScreensaver();
  }
}

function startScreensaver() {
  document.body.classList.add('screensaver');
  pipesCanvas.width = window.innerWidth;
  pipesCanvas.height = window.innerHeight;
  pipesState = createPipesState();
  animatePipes();
}

function stopScreensaver() {
  document.body.classList.remove('screensaver');
  if (pipesAnimationFrame) cancelAnimationFrame(pipesAnimationFrame);
}

function createPipesState() {
  const segments = [];
  const colors = ['#4b9cd3', '#2ecc71', '#9b59b6', '#f1c40f'];
  for (let i = 0; i < 6; i++) {
    segments.push(createPipe(colors[i % colors.length]));
  }
  return { segments, angle: 0 };
}

function createPipe(color) {
  return {
    color,
    points: Array.from({ length: 120 }, (_, i) => ({
      x: Math.sin(i * 0.16) * 140,
      y: Math.cos(i * 0.13) * 120,
      z: i * 12,
    })),
  };
}

function animatePipes() {
  if (!pipesState) return;
  pipesContext.clearRect(0, 0, pipesCanvas.width, pipesCanvas.height);
  pipesContext.save();
  pipesContext.translate(pipesCanvas.width / 2, pipesCanvas.height / 2);
  pipesState.angle += 0.005;
  const { angle } = pipesState;
  pipesState.segments.forEach((pipe, index) => {
    drawPipe(pipe, angle + index * 0.4);
  });
  pipesContext.restore();
  pipesAnimationFrame = requestAnimationFrame(animatePipes);
}

function drawPipe(pipe, angle) {
  const projected = pipe.points.map((point, index) => {
    const wobble = Math.sin(angle + index * 0.08) * 60;
    const x = point.x * Math.cos(angle) - point.z * Math.sin(angle);
    const z = point.z * Math.cos(angle) + point.x * Math.sin(angle);
    const y = point.y + wobble;
    const perspective = 500 / (500 + z);
    return {
      x: x * perspective,
      y: y * perspective,
      depth: z,
      radius: 16 * perspective,
    };
  });
  for (let i = 0; i < projected.length - 1; i++) {
    const current = projected[i];
    const next = projected[i + 1];
    pipesContext.strokeStyle = pipe.color;
    pipesContext.lineWidth = current.radius;
    pipesContext.lineCap = 'round';
    pipesContext.beginPath();
    pipesContext.moveTo(current.x, current.y);
    pipesContext.lineTo(next.x, next.y);
    pipesContext.stroke();
  }
}

function renderAll() {
  storage.save(state);
  windowRegistry.forEach((record) => {
    record.blueprint.render(record.element.querySelector('.window__body'));
  });
  updateClock();
}

function updateClock() {
  taskbarClock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setupDesktop() {
  populateStartMenu();
  startMenu.setAttribute('aria-hidden', 'true');
  startButton.setAttribute('aria-expanded', 'false');
  themeSwitcher.value = state.lastTheme;
  setTheme(state.lastTheme);

  ['income', 'categories', 'summary', 'forecast'].forEach(openWindow);
  recordNotification('Welcome back! Desktop restored.', 'success');

  setInterval(updateClock, 1000);
  updateClock();
}

startButton.addEventListener('click', () => toggleStartMenu());
startSearch.addEventListener('input', (event) => populateStartMenu(event.target.value));
document.addEventListener('click', (event) => {
  if (!startMenu.contains(event.target) && event.target !== startButton) {
    closeStartMenu();
  }
});

themeSwitcher.addEventListener('change', (event) => setTheme(event.target.value));

screensaverButton.addEventListener('click', () => toggleScreensaver());

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.code === 'Space') {
    event.preventDefault();
    toggleStartMenu();
  }
  if (event.ctrlKey && event.shiftKey && event.code === 'KeyP') {
    toggleScreensaver();
  }
  if (event.ctrlKey && event.code === 'KeyS') {
    openWindow('showcase');
  }
  if (event.ctrlKey && event.altKey && event.code === 'KeyN') {
    openWindow('notifications');
  }
  if (event.key === 'Escape' && document.body.classList.contains('screensaver')) {
    stopScreensaver();
  }
});

['mousemove', 'keydown', 'click'].forEach((eventName) =>
  document.addEventListener(eventName, () => {
    if (document.body.classList.contains('screensaver')) stopScreensaver();
  })
);

window.addEventListener('beforeunload', () => storage.save(state));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      })
      .catch((error) => console.warn('SW registration failed', error));
  });
}

setupDesktop();
