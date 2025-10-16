const weeklyIncomeInput = document.querySelector('#weeklyIncome');
const budgetBody = document.querySelector('#budgetBody');
const scopeChooser = document.querySelector('#scopeChooser');
const incomeSnapshot = document.querySelector('#incomeSnapshot');
const summaryGrid = document.querySelector('#summaryGrid');
const futureGrid = document.querySelector('#futureGrid');
const customForm = document.querySelector('#customCategoryForm');
const rowTemplate = document.querySelector('#rowTemplate');
const appFrame = document.querySelector('.app-frame');
const scopeColumnHeader = document.querySelector('#scopeColumnHeader');
const startButton = document.querySelector('#startButton');
const startMenu = document.querySelector('#startMenu');
const startWindowList = document.querySelector('#startWindowList');
const taskbarButtonsContainer = document.querySelector('#taskbarButtons');
const taskbarClock = document.querySelector('#taskbarClock');
const snakeCanvas = document.querySelector('#snakeCanvas');
const snakeStartBtn = document.querySelector('#snakeStart');
const snakePauseBtn = document.querySelector('#snakePause');
const snakeResetBtn = document.querySelector('#snakeReset');
const snakeStatusEl = document.querySelector('#snakeStatus');
const body = document.body;

const scopeFactors = {
  daily: 1 / 7,
  weekly: 1,
  monthly: 4.345,
  yearly: 52,
};

const themeClassMap = {
  win95: 'theme-win95',
  vista: 'theme-vista',
  mac: 'theme-mac',
};

const entryFrequencies = ['daily', 'weekly', 'monthly'];

const futureHorizons = [
  { label: '1 Month', weeks: 4.345 },
  { label: '6 Months', weeks: 26.07 },
  { label: '1 Year', weeks: 52 },
  { label: '2 Years', weeks: 104 },
  { label: '5 Years', weeks: 260 },
];

const recommendedBlueprint = [
  {
    name: 'Housing & Utilities',
    percent: 0.32,
    notes: 'Rent, mortgage, utilities, internet',
  },
  {
    name: 'Groceries & Dining',
    percent: 0.14,
    notes: 'Groceries, coffee runs, eating out',
  },
  {
    name: 'Transportation & Rideshares',
    percent: 0.1,
    notes: 'Car expenses, public transit, rideshares',
  },
  {
    name: 'Insurance & Healthcare',
    percent: 0.07,
    notes: 'Health, renters, phone, other coverage',
  },
  {
    name: 'Debt Payments',
    percent: 0.1,
    notes: 'Student loans, credit cards, car payments',
  },
  {
    name: 'Savings & Investments',
    percent: 0.15,
    notes: 'Emergency fund, Roth IRA, brokerage',
  },
  {
    name: 'Subscriptions & Streaming',
    percent: 0.03,
    notes: 'Streaming bundles, cloud storage, apps',
  },
  {
    name: 'Wellness & Fitness',
    percent: 0.02,
    notes: 'Gym, therapy, wellness apps',
  },
  {
    name: 'Entertainment & Nightlife',
    percent: 0.05,
    notes: 'Concerts, gaming, nights out',
  },
  {
    name: 'Misc Buffer',
    percent: 0.02,
    notes: 'Gifts, travel fund, unexpected fun',
  },
];

let state = {
  scope: 'daily',
  weeklyIncome: 1200,
  categories: [],
  theme: 'win95',
};

const WINDOW_MODE_BREAKPOINT = 860;
let highestZIndex = 100;
let windowModeActive = false;

const windowRegistry = new Map();
let activeWindowId = null;
let taskbarClockTimer = null;

const snakeGame = {
  ctx: null,
  gridSize: 13,
  cellSize: 20,
  snake: [],
  direction: 'right',
  pendingDirection: 'right',
  food: null,
  loopId: null,
  speed: 160,
  running: false,
  wasGameOver: false,
};

function init() {
  weeklyIncomeInput.value = state.weeklyIncome.toFixed(2);
  state.categories = recommendedBlueprint.map((item, index) => {
    const weeklyAmount = state.weeklyIncome * item.percent;
    return {
      id: `rec-${index}`,
      ...item,
      weeklyAmount,
      entryFrequency: 'weekly',
      entryAmount: weeklyAmount,
      recommended: true,
      customized: false,
    };
  });
  applyTheme(state.theme);
  renderAll();
  initializeSnakeGame();
  registerWindows();
  startTaskbarClock();
}

function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function convertFromWeekly(weeklyAmount, scope) {
  return weeklyAmount * scopeFactors[scope];
}

function convertToWeekly(amount, scope) {
  return amount / scopeFactors[scope];
}

function formatScopeLabel(scope) {
  if (!scope) return '';
  return scope.charAt(0).toUpperCase() + scope.slice(1);
}

function renderIncomeSnapshot() {
  const fragments = [
    { label: 'Daily', value: convertFromWeekly(state.weeklyIncome, 'daily') },
    { label: 'Weekly', value: state.weeklyIncome },
    { label: 'Monthly', value: convertFromWeekly(state.weeklyIncome, 'monthly') },
    { label: 'Yearly', value: convertFromWeekly(state.weeklyIncome, 'yearly') },
  ];

  incomeSnapshot.innerHTML = fragments
    .map(
      (item) => `
        <div>
          <span>${item.label}</span>
          <strong>${formatCurrency(item.value)}</strong>
        </div>
      `
    )
    .join('');
}

function renderBudgetTable() {
  budgetBody.innerHTML = '';
  if (scopeColumnHeader) {
    scopeColumnHeader.textContent = `In ${formatScopeLabel(state.scope)} View`;
  }
  const fragment = document.createDocumentFragment();

  state.categories.forEach((category) => {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = category.id;
    row.querySelector('[data-field="name"]').textContent = category.name;

    const amountInput = row.querySelector('[data-field="amount"]');
    const entryFrequency = entryFrequencies.includes(category.entryFrequency)
      ? category.entryFrequency
      : 'weekly';
    const entryAmount = Number.isFinite(category.entryAmount)
      ? category.entryAmount
      : convertFromWeekly(category.weeklyAmount, entryFrequency);
    amountInput.value = entryAmount.toFixed(2);
    amountInput.dataset.id = category.id;
    amountInput.dataset.recommended = category.recommended;

    const frequencySelect = row.querySelector('[data-field="frequency"]');
    frequencySelect.value = entryFrequency;
    frequencySelect.dataset.id = category.id;

    const equivalentCell = row.querySelector('[data-field="equivalent"]');
    equivalentCell.textContent = formatCurrency(
      convertFromWeekly(category.weeklyAmount, state.scope)
    );

    const notesInput = row.querySelector('[data-field="notes"]');
    notesInput.value = category.notes ?? '';
    notesInput.dataset.id = category.id;

    const deleteBtn = row.querySelector('[data-action="delete"]');
    deleteBtn.dataset.id = category.id;
    deleteBtn.disabled = category.recommended;
    if (category.recommended) {
      deleteBtn.title = 'Starter categories stay on your list';
      deleteBtn.classList.add('disabled');
    }

    fragment.appendChild(row);
  });

  budgetBody.appendChild(fragment);
}

function renderSummary() {
  const totalExpensesWeekly = state.categories.reduce(
    (sum, category) => sum + category.weeklyAmount,
    0
  );
  const totalIncomeScoped = convertFromWeekly(state.weeklyIncome, state.scope);
  const totalExpensesScoped = convertFromWeekly(totalExpensesWeekly, state.scope);
  const leftoverWeekly = state.weeklyIncome - totalExpensesWeekly;
  const leftoverScoped = convertFromWeekly(leftoverWeekly, state.scope);
  const savingsRate = state.weeklyIncome === 0 ? 0 : leftoverWeekly / state.weeklyIncome;

  summaryGrid.innerHTML = '';

  const summaryItems = [
    {
      label: `${state.scope.toUpperCase()} Income`,
      value: totalIncomeScoped,
      accent: 'accent-secondary',
    },
    {
      label: `${state.scope.toUpperCase()} Planned Spending`,
      value: totalExpensesScoped,
      accent: leftoverWeekly > 0 ? 'delta-negative' : 'delta-positive',
    },
    {
      label: leftoverWeekly >= 0 ? 'Available to Save' : 'Over Budget',
      value: Math.abs(leftoverScoped),
      accent: leftoverWeekly >= 0 ? 'delta-positive' : 'delta-negative',
    },
    {
      label: 'Savings Rate',
      value: savingsRate,
      format: (v) => `${(v * 100).toFixed(1)}%`,
      accent: savingsRate >= 0.2 ? 'delta-positive' : 'delta-negative',
    },
  ];

  summaryItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'pulse-card';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.label;

    const value = document.createElement('strong');
    value.className = item.accent;
    if (item.format) {
      value.textContent = item.format(item.value);
    } else {
      value.textContent = formatCurrency(item.value);
    }

    card.append(label, value);
    summaryGrid.appendChild(card);
  });
}

function renderFutureForecast() {
  const totalExpensesWeekly = state.categories.reduce(
    (sum, category) => sum + category.weeklyAmount,
    0
  );
  futureGrid.innerHTML = '';

  futureHorizons.forEach((horizon) => {
    const income = state.weeklyIncome * horizon.weeks;
    const expenses = totalExpensesWeekly * horizon.weeks;
    const net = income - expenses;

    const card = document.createElement('div');
    card.className = 'future-card';

    const title = document.createElement('h4');
    title.textContent = horizon.label;

    const incomeRow = document.createElement('div');
    incomeRow.className = 'metric';
    incomeRow.innerHTML = `<span>Income</span><strong>${formatCurrency(income)}</strong>`;

    const expenseRow = document.createElement('div');
    expenseRow.className = 'metric';
    expenseRow.innerHTML = `<span>Expenses</span><strong>${formatCurrency(expenses)}</strong>`;

    const netRow = document.createElement('div');
    netRow.className = 'metric';
    const netClass = net >= 0 ? 'delta-positive' : 'delta-negative';
    netRow.innerHTML = `<span>Net</span><strong class="${netClass}">${formatCurrency(net)}</strong>`;

    card.append(title, incomeRow, expenseRow, netRow);
  futureGrid.appendChild(card);
  });
}

function renderAll() {
  renderIncomeSnapshot();
  renderBudgetTable();
  renderSummary();
  renderFutureForecast();
}

function getCSSVar(name) {
  if (!body) return '';
  return getComputedStyle(body).getPropertyValue(name).trim();
}

function applyTheme(theme) {
  const className = themeClassMap[theme] || themeClassMap.win95;
  state.theme = theme;
  if (!body) return;
  Object.values(themeClassMap).forEach((value) => body.classList.remove(value));
  body.classList.add(className);
  drawSnakeFrame();
}

function updateTaskbarActiveState(activeId) {
  windowRegistry.forEach((record) => {
    if (!record.taskbarButton) return;
    const isActive = Boolean(activeId && record.id === activeId && record.state === 'open');
    record.taskbarButton.classList.toggle('is-active', isActive);
    record.taskbarButton.disabled = record.state === 'closed';
  });
  const activeRecord = activeId ? windowRegistry.get(activeId) : null;
  activeWindowId = activeRecord && activeRecord.state === 'open' ? activeId : null;
}

function buildTaskbarButtons() {
  if (!taskbarButtonsContainer) return;
  taskbarButtonsContainer.innerHTML = '';
  windowRegistry.forEach((record) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'taskbar-button';
    button.dataset.windowId = record.id;
    button.textContent = record.title;
    button.disabled = record.state === 'closed';
    button.addEventListener('click', () => toggleWindowFromTaskbar(record.id));
    record.taskbarButton = button;
    taskbarButtonsContainer.appendChild(button);
  });
  updateTaskbarActiveState(activeWindowId);
}

function updateStartMenuWindowList() {
  if (!startWindowList) return;
  startWindowList.innerHTML = '';
  windowRegistry.forEach((record) => {
    if (record.id === 'snake') {
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'start-menu__item';
    button.dataset.openWindow = record.id;
    const statusLabel =
      record.state === 'open' ? 'Open' : record.state === 'minimized' ? 'Minimized' : 'Closed';
    button.innerHTML = `<span>${record.title}</span><span class="start-menu__status">${statusLabel}</span>`;
    startWindowList.appendChild(button);
  });
}

function registerWindows() {
  if (!appFrame) return;
  const panels = Array.from(appFrame.querySelectorAll('.panel.window'));
  panels.forEach((panel) => {
    const id = panel.dataset.windowId;
    if (!id) return;
    const title =
      panel.dataset.windowTitle ||
      panel.querySelector('.window-title')?.textContent?.trim() ||
      id;
    const initialState = panel.dataset.initialState || (panel.classList.contains('hidden-window') ? 'closed' : 'open');
    const existing = windowRegistry.get(id);
    const record = existing || {
      id,
      title,
      element: panel,
      state: 'open',
      maximized: panel.dataset.maximized === 'true',
      restoreBounds: null,
      taskbarButton: null,
    };
    record.element = panel;
    record.title = title;
    if (initialState === 'closed') {
      panel.classList.add('hidden-window');
      record.state = 'closed';
    } else if (initialState === 'minimized') {
      panel.classList.add('hidden-window');
      record.state = 'minimized';
    } else if (panel.classList.contains('hidden-window')) {
      record.state = 'closed';
    } else if (record.state !== 'minimized') {
      record.state = 'open';
    }
    record.maximized = panel.dataset.maximized === 'true';
    windowRegistry.set(id, record);
  });
  buildTaskbarButtons();
  updateStartMenuWindowList();
}

function openWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  record.state = 'open';
  record.element.classList.remove('hidden-window');
  record.element.dataset.windowState = 'open';
  if (record.taskbarButton) {
    record.taskbarButton.disabled = false;
  }
  bringToFront(record.element);
  if (windowModeActive) {
    const frameRect = appFrame.getBoundingClientRect();
    if (record.element.dataset.maximized === 'true') {
      record.element.style.left = '0px';
      record.element.style.top = '0px';
      record.element.style.width = `${frameRect.width}px`;
      record.element.style.height = `${frameRect.height}px`;
    } else {
      constrainPanelToFrame(record.element, frameRect);
    }
  }
  updateTaskbarActiveState(id);
  updateStartMenuWindowList();
  if (id === 'snake') {
    drawSnakeFrame();
  }
}

function minimizeWindow(id) {
  const record = windowRegistry.get(id);
  if (!record || record.state === 'closed') return;
  record.state = 'minimized';
  record.element.classList.add('hidden-window');
  record.element.dataset.windowState = 'minimized';
  if (record.taskbarButton) {
    record.taskbarButton.disabled = false;
  }
  if (activeWindowId === id) {
    updateTaskbarActiveState(null);
  } else {
    updateTaskbarActiveState(activeWindowId);
  }
  updateStartMenuWindowList();
}

function closeWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  record.state = 'closed';
  record.element.classList.add('hidden-window');
  record.element.dataset.windowState = 'closed';
  if (record.taskbarButton) {
    record.taskbarButton.disabled = true;
  }
  if (activeWindowId === id) {
    updateTaskbarActiveState(null);
  } else {
    updateTaskbarActiveState(activeWindowId);
  }
  updateStartMenuWindowList();
}

function toggleMaximizeWindow(id) {
  const record = windowRegistry.get(id);
  if (!record || !shouldEnableWindowMode()) {
    return;
  }

  const frameRect = appFrame.getBoundingClientRect();
  if (!record.maximized) {
    const currentLeft = Number.parseFloat(record.element.dataset.x) || 0;
    const currentTop = Number.parseFloat(record.element.dataset.y) || 0;
    const currentWidth = Number.parseFloat(record.element.dataset.width) || record.element.offsetWidth;
    const currentHeight = Number.parseFloat(record.element.dataset.height) || record.element.offsetHeight;
    record.restoreBounds = {
      left: currentLeft,
      top: currentTop,
      width: currentWidth,
      height: currentHeight,
    };
    record.maximized = true;
    record.element.dataset.maximized = 'true';
    record.element.style.left = '0px';
    record.element.style.top = '0px';
    record.element.style.width = `${frameRect.width}px`;
    record.element.style.height = `${frameRect.height}px`;
    record.element.dataset.x = '0';
    record.element.dataset.y = '0';
    record.element.dataset.width = String(frameRect.width);
    record.element.dataset.height = String(frameRect.height);
  } else {
    record.maximized = false;
    record.element.dataset.maximized = 'false';
    if (record.restoreBounds) {
      const { left, top, width, height } = record.restoreBounds;
      record.element.style.left = `${left}px`;
      record.element.style.top = `${top}px`;
      record.element.style.width = `${width}px`;
      record.element.style.height = `${height}px`;
      record.element.dataset.x = String(left);
      record.element.dataset.y = String(top);
      record.element.dataset.width = String(width);
      record.element.dataset.height = String(height);
    }
    constrainPanelToFrame(record.element, frameRect);
  }
  bringToFront(record.element);
}

function toggleWindowFromTaskbar(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  if (record.state === 'open') {
    minimizeWindow(id);
  } else if (record.state === 'minimized') {
    openWindow(id);
  }
}

function setStartMenuOpen(isOpen) {
  if (!startMenu || !startButton) return;
  startMenu.classList.toggle('open', isOpen);
  startMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  startButton.classList.toggle('active', isOpen);
}

function closeStartMenu() {
  setStartMenuOpen(false);
}

function startTaskbarClock() {
  if (!taskbarClock) return;
  const updateClock = () => {
    const now = new Date();
    taskbarClock.textContent = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  updateClock();
  if (taskbarClockTimer) {
    window.clearInterval(taskbarClockTimer);
  }
  taskbarClockTimer = window.setInterval(updateClock, 30000);
}

function initializeSnakeGame() {
  if (!snakeCanvas) return;
  const ctx = snakeCanvas.getContext('2d');
  if (!ctx) return;
  snakeGame.ctx = ctx;
  snakeGame.cellSize = Math.floor(snakeCanvas.width / snakeGame.gridSize);
  resetSnakeGame();
}

function resetSnakeGame() {
  if (!snakeGame.ctx) return;
  snakeGame.running = false;
  snakeGame.wasGameOver = false;
  if (snakeGame.loopId) {
    window.clearInterval(snakeGame.loopId);
    snakeGame.loopId = null;
  }
  const mid = Math.floor(snakeGame.gridSize / 2);
  snakeGame.snake = [
    { x: 2, y: mid },
    { x: 1, y: mid },
    { x: 0, y: mid },
  ];
  snakeGame.direction = 'right';
  snakeGame.pendingDirection = 'right';
  snakeGame.food = spawnSnakeFood();
  drawSnakeFrame();
  updateSnakeStatus('Use arrow keys to play.');
}

function spawnSnakeFood() {
  let position;
  do {
    position = {
      x: Math.floor(Math.random() * snakeGame.gridSize),
      y: Math.floor(Math.random() * snakeGame.gridSize),
    };
  } while (snakeGame.snake.some((segment) => segment.x === position.x && segment.y === position.y));
  return position;
}

function drawSnakeFrame() {
  if (!snakeGame.ctx) return;
  const size = snakeGame.cellSize;
  const grid = snakeGame.gridSize;
  const width = grid * size;
  const height = grid * size;
  snakeGame.ctx.clearRect(0, 0, width, height);
  const surface = getCSSVar('--surface-elevated') || '#ffffff';
  snakeGame.ctx.fillStyle = surface;
  snakeGame.ctx.fillRect(0, 0, width, height);

  const gridColor = getCSSVar('--snake-grid') || 'rgba(0,0,0,0.12)';
  snakeGame.ctx.strokeStyle = gridColor;
  snakeGame.ctx.lineWidth = 1;
  snakeGame.ctx.beginPath();
  for (let i = 0; i <= grid; i += 1) {
    snakeGame.ctx.moveTo(i * size + 0.5, 0);
    snakeGame.ctx.lineTo(i * size + 0.5, height);
    snakeGame.ctx.moveTo(0, i * size + 0.5);
    snakeGame.ctx.lineTo(width, i * size + 0.5);
  }
  snakeGame.ctx.stroke();

  if (snakeGame.food) {
    snakeGame.ctx.fillStyle = getCSSVar('--snake-food') || '#ff8c42';
    snakeGame.ctx.beginPath();
    snakeGame.ctx.arc(
      (snakeGame.food.x + 0.5) * size,
      (snakeGame.food.y + 0.5) * size,
      size / 2.5,
      0,
      Math.PI * 2
    );
    snakeGame.ctx.fill();
  }

  snakeGame.ctx.fillStyle = getCSSVar('--snake-snake') || '#0050ef';
  snakeGame.snake.forEach((segment, index) => {
    snakeGame.ctx.fillRect(segment.x * size + 1, segment.y * size + 1, size - 2, size - 2);
    if (index === 0) {
      snakeGame.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      snakeGame.ctx.lineWidth = 1.2;
      snakeGame.ctx.strokeRect(
        segment.x * size + 1,
        segment.y * size + 1,
        size - 2,
        size - 2
      );
    }
  });
}

function updateSnakeStatus(message) {
  if (!snakeStatusEl) return;
  snakeStatusEl.textContent = message;
}

function endSnakeGame(message) {
  snakeGame.running = false;
  snakeGame.wasGameOver = true;
  if (snakeGame.loopId) {
    window.clearInterval(snakeGame.loopId);
    snakeGame.loopId = null;
  }
  const score = Math.max(0, snakeGame.snake.length - 3);
  updateSnakeStatus(`${message} (Score: ${score})`);
}

function stepSnake() {
  if (!snakeGame.running) return;
  const direction = snakeGame.pendingDirection;
  snakeGame.direction = direction;
  const head = { ...snakeGame.snake[0] };
  if (direction === 'up') head.y -= 1;
  if (direction === 'down') head.y += 1;
  if (direction === 'left') head.x -= 1;
  if (direction === 'right') head.x += 1;

  if (
    head.x < 0 ||
    head.x >= snakeGame.gridSize ||
    head.y < 0 ||
    head.y >= snakeGame.gridSize
  ) {
    endSnakeGame('You hit the wall! Press Start to play again.');
    return;
  }

  if (snakeGame.snake.some((segment) => segment.x === head.x && segment.y === head.y)) {
    endSnakeGame('You bit your tail! Press Start to play again.');
    return;
  }

  snakeGame.snake.unshift(head);
  if (snakeGame.food && head.x === snakeGame.food.x && head.y === snakeGame.food.y) {
    snakeGame.food = spawnSnakeFood();
  } else {
    snakeGame.snake.pop();
  }
  drawSnakeFrame();
  const score = Math.max(0, snakeGame.snake.length - 3);
  updateSnakeStatus(`Score: ${score}`);
}

function startSnake() {
  if (!snakeGame.ctx) return;
  if (snakeGame.running) return;
  if (snakeGame.wasGameOver) {
    resetSnakeGame();
  }
  snakeGame.running = true;
  if (snakeGame.loopId) {
    window.clearInterval(snakeGame.loopId);
  }
  snakeGame.loopId = window.setInterval(stepSnake, snakeGame.speed);
  const score = Math.max(0, snakeGame.snake.length - 3);
  updateSnakeStatus(`Score: ${score}`);
}

function pauseSnake() {
  if (!snakeGame.running) return;
  snakeGame.running = false;
  if (snakeGame.loopId) {
    window.clearInterval(snakeGame.loopId);
    snakeGame.loopId = null;
  }
  updateSnakeStatus('Paused. Press Start to resume.');
}

function handleSnakeKeydown(event) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return;
  }
  const snakeWindow = windowRegistry.get('snake');
  if (!snakeWindow || snakeWindow.state !== 'open' || (activeWindowId && activeWindowId !== 'snake')) {
    return;
  }
  event.preventDefault();
  const { direction } = snakeGame;
  if (event.key === 'ArrowUp' && direction !== 'down') {
    snakeGame.pendingDirection = 'up';
  } else if (event.key === 'ArrowDown' && direction !== 'up') {
    snakeGame.pendingDirection = 'down';
  } else if (event.key === 'ArrowLeft' && direction !== 'right') {
    snakeGame.pendingDirection = 'left';
  } else if (event.key === 'ArrowRight' && direction !== 'left') {
    snakeGame.pendingDirection = 'right';
  }

  if (!snakeGame.running) {
    startSnake();
  }
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shouldEnableWindowMode() {
  return window.innerWidth > WINDOW_MODE_BREAKPOINT;
}

function extractPanelConfig(panel) {
  return {
    width: Number.parseFloat(panel.dataset.width) || panel.offsetWidth || 360,
    height: Number.parseFloat(panel.dataset.height) || panel.offsetHeight || 420,
    x: Number.parseFloat(panel.dataset.x) || 0,
    y: Number.parseFloat(panel.dataset.y) || 0,
    minWidth: Number.parseFloat(panel.dataset.minWidth) || 320,
    minHeight: Number.parseFloat(panel.dataset.minHeight) || 320,
  };
}

function attachResizeHandles(panel) {
  if (panel.querySelector('.resize-handle')) {
    return;
  }

  ['right', 'bottom', 'corner'].forEach((direction) => {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.dataset.direction = direction;
    panel.appendChild(handle);
  });
}

function bringToFront(panel) {
  highestZIndex += 1;
  panel.style.zIndex = String(highestZIndex);
  const windowId = panel.dataset.windowId;
  if (windowId) {
    const record = windowRegistry.get(windowId);
    if (record) {
      record.state = 'open';
      panel.classList.remove('hidden-window');
      panel.dataset.windowState = 'open';
      updateTaskbarActiveState(windowId);
      updateStartMenuWindowList();
    }
  }
}

function makePanelDraggable(panel) {
  if (panel.dataset.dragReady === 'true' || !appFrame) {
    return;
  }

  const handle = panel.querySelector('[data-drag-handle]');
  if (!handle) {
    return;
  }

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let frameRect = null;

  const onPointerMove = (event) => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const maxLeft = Math.max(0, frameRect.width - panel.offsetWidth);
    const maxTop = Math.max(0, frameRect.height - panel.offsetHeight);
    const nextLeft = clamp(startLeft + dx, 0, maxLeft);
    const nextTop = clamp(startTop + dy, 0, maxTop);
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
    panel.dataset.x = String(nextLeft);
    panel.dataset.y = String(nextTop);
  };

  const onPointerUp = (event) => {
    if (event.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    panel.classList.remove('dragging');
    try {
      handle.releasePointerCapture(pointerId);
    } catch (error) {
      // Safari may throw when pointer capture already released.
    }
    pointerId = null;
  };

  handle.addEventListener('pointerdown', (event) => {
    if (!shouldEnableWindowMode()) return;
    if (panel.dataset.maximized === 'true') return;
    pointerId = event.pointerId;
    frameRect = appFrame.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left - frameRect.left;
    startTop = rect.top - frameRect.top;
    panel.classList.add('dragging');
    bringToFront(panel);
    handle.setPointerCapture(pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  });

  panel.dataset.dragReady = 'true';
}

function makePanelResizable(panel) {
  if (panel.dataset.resizeReady === 'true' || !appFrame) {
    return;
  }

  const handles = panel.querySelectorAll('.resize-handle');
  if (!handles.length) {
    return;
  }

  handles.forEach((handle) => {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startLeft = 0;
    let startTop = 0;
    let frameRect = null;
    const direction = handle.dataset.direction;

    const onPointerMove = (event) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const minWidth = Number.parseFloat(panel.dataset.minWidth) || 320;
      const minHeight = Number.parseFloat(panel.dataset.minHeight) || 320;
      const maxWidth = Math.max(minWidth, frameRect.width - startLeft);
      const maxHeight = Math.max(minHeight, frameRect.height - startTop);

      if (direction === 'right' || direction === 'corner') {
        const nextWidth = clamp(startWidth + dx, minWidth, maxWidth);
        panel.style.width = `${nextWidth}px`;
        panel.dataset.width = String(nextWidth);
      }

      if (direction === 'bottom' || direction === 'corner') {
        const nextHeight = clamp(startHeight + dy, minHeight, maxHeight);
        panel.style.height = `${nextHeight}px`;
        panel.dataset.height = String(nextHeight);
      }
    };

    const onPointerUp = (event) => {
      if (event.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      panel.classList.remove('resizing');
      try {
        handle.releasePointerCapture(pointerId);
      } catch (error) {
        // Ignore capture release issues on unsupported browsers.
      }
      pointerId = null;
      const frameRectAfter = appFrame.getBoundingClientRect();
      constrainPanelToFrame(panel, frameRectAfter);
    };

    handle.addEventListener('pointerdown', (event) => {
      if (!shouldEnableWindowMode()) return;
      if (panel.dataset.maximized === 'true') return;
      pointerId = event.pointerId;
      frameRect = appFrame.getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left - frameRect.left;
      startTop = rect.top - frameRect.top;
      panel.classList.add('resizing');
      bringToFront(panel);
      handle.setPointerCapture(pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  });

  panel.dataset.resizeReady = 'true';
}

function constrainPanelToFrame(panel, frameRect) {
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const currentLeft = Number.parseFloat(panel.dataset.x) || Number.parseFloat(panel.style.left) || 0;
  const currentTop = Number.parseFloat(panel.dataset.y) || Number.parseFloat(panel.style.top) || 0;
  const maxLeft = Math.max(0, frameRect.width - width);
  const maxTop = Math.max(0, frameRect.height - height);
  const nextLeft = clamp(currentLeft, 0, maxLeft);
  const nextTop = clamp(currentTop, 0, maxTop);
  panel.style.left = `${nextLeft}px`;
  panel.style.top = `${nextTop}px`;
  panel.dataset.x = String(nextLeft);
  panel.dataset.y = String(nextTop);
}

function initializeWindowSystem() {
  if (!appFrame || !shouldEnableWindowMode()) {
    windowModeActive = false;
    return;
  }

  const panels = Array.from(appFrame.querySelectorAll('.panel.window'));
  const frameRect = appFrame.getBoundingClientRect();
  let registeredNewPanel = false;

  panels.forEach((panel, index) => {
    const config = extractPanelConfig(panel);

    if (!panel.dataset.windowReady) {
      panel.style.width = `${config.width}px`;
      panel.style.height = `${config.height}px`;
      panel.style.left = `${config.x}px`;
      panel.style.top = `${config.y}px`;
      panel.dataset.width = String(config.width);
      panel.dataset.height = String(config.height);
      panel.dataset.x = String(config.x);
      panel.dataset.y = String(config.y);
      panel.dataset.minWidth = String(config.minWidth);
      panel.dataset.minHeight = String(config.minHeight);
      panel.style.zIndex = String(highestZIndex + index);
      attachResizeHandles(panel);
      makePanelDraggable(panel);
      makePanelResizable(panel);
      if (panel.dataset.pointerReady !== 'true') {
        panel.addEventListener('pointerdown', () => bringToFront(panel));
        panel.dataset.pointerReady = 'true';
      }
      panel.dataset.windowReady = 'true';
      registeredNewPanel = true;
    }

    if (panel.dataset.maximized === 'true') {
      panel.style.left = '0px';
      panel.style.top = '0px';
      panel.style.width = `${frameRect.width}px`;
      panel.style.height = `${frameRect.height}px`;
      panel.dataset.width = String(frameRect.width);
      panel.dataset.height = String(frameRect.height);
      panel.dataset.x = '0';
      panel.dataset.y = '0';
    } else if (!panel.classList.contains('hidden-window')) {
      constrainPanelToFrame(panel, frameRect);
    }
  });

  if (registeredNewPanel) {
    highestZIndex += panels.length;
  }

  windowModeActive = true;
}

function handleWindowResize() {
  if (!appFrame) return;
  if (!shouldEnableWindowMode()) {
    windowModeActive = false;
    return;
  }
  initializeWindowSystem();
}

function updateCategoryEntryAmount(id, entryAmount) {
  if (!Number.isFinite(entryAmount) || entryAmount < 0) {
    return null;
  }

  let updatedCategory = null;
  state.categories = state.categories.map((category) => {
    if (category.id !== id) return category;
    const frequency = entryFrequencies.includes(category.entryFrequency)
      ? category.entryFrequency
      : 'weekly';
    const weeklyAmount = convertToWeekly(entryAmount, frequency);
    updatedCategory = {
      ...category,
      entryAmount,
      weeklyAmount,
      customized: true,
    };
    return updatedCategory;
  });
  renderSummary();
  renderFutureForecast();
  return updatedCategory;
}

function updateCategoryFrequency(id, frequency) {
  if (!entryFrequencies.includes(frequency)) {
    return null;
  }

  let updatedCategory = null;
  state.categories = state.categories.map((category) => {
    if (category.id !== id) return category;
    const entryAmount = convertFromWeekly(category.weeklyAmount, frequency);
    updatedCategory = {
      ...category,
      entryFrequency: frequency,
      entryAmount,
    };
    return updatedCategory;
  });
  return updatedCategory;
}

function updateCategoryNotes(id, notes) {
  state.categories = state.categories.map((category) =>
    category.id === id ? { ...category, notes } : category
  );
}

function addCustomCategory(name, amount, frequency, notes) {
  const cleanFrequency = entryFrequencies.includes(frequency)
    ? frequency
    : 'weekly';
  const weeklyAmount = convertToWeekly(amount, cleanFrequency);
  state.categories.push({
    id: `custom-${crypto.randomUUID()}`,
    name,
    weeklyAmount,
    entryFrequency: cleanFrequency,
    entryAmount: amount,
    notes,
    recommended: false,
    customized: true,
  });
  renderAll();
}

function handleWeeklyIncomeChange(value) {
  const amount = Number.parseFloat(value);
  if (Number.isNaN(amount) || amount < 0) {
    return;
  }
  state.weeklyIncome = amount;
  state.categories = state.categories.map((category) => {
    if (category.recommended && !category.customized) {
      const frequency = entryFrequencies.includes(category.entryFrequency)
        ? category.entryFrequency
        : 'weekly';
      const weeklyAmount = state.weeklyIncome * category.percent;
      return {
        ...category,
        weeklyAmount,
        entryAmount: convertFromWeekly(weeklyAmount, frequency),
      };
    }
    return category;
  });
  renderAll();
}

scopeChooser.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-scope]');
  if (!button) return;

  const newScope = button.dataset.scope;
  if (newScope === state.scope) return;

  scopeChooser.querySelectorAll('.chip').forEach((chip) =>
    chip.classList.toggle('active', chip.dataset.scope === newScope)
  );
  state.scope = newScope;
  renderBudgetTable();
  renderSummary();
});

budgetBody.addEventListener('input', (event) => {
  const target = event.target;
  if (target.matches('[data-field="amount"]')) {
    const id = target.dataset.id;
    const value = Number.parseFloat(target.value);
    if (Number.isNaN(value) || value < 0) {
      return;
    }
    const updatedCategory = updateCategoryEntryAmount(id, value);
    if (updatedCategory) {
      const row = target.closest('tr');
      const equivalentCell = row?.querySelector('[data-field="equivalent"]');
      if (equivalentCell) {
        equivalentCell.textContent = formatCurrency(
          convertFromWeekly(updatedCategory.weeklyAmount, state.scope)
        );
      }
    }
  }

  if (target.matches('[data-field="notes"]')) {
    const id = target.dataset.id;
    updateCategoryNotes(id, target.value);
  }
});

budgetBody.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('[data-field="frequency"]')) {
    const id = target.dataset.id;
    const updatedCategory = updateCategoryFrequency(id, target.value);
    if (updatedCategory) {
      const row = target.closest('tr');
      const amountInput = row?.querySelector('[data-field="amount"]');
      if (amountInput) {
        amountInput.value = updatedCategory.entryAmount.toFixed(2);
      }
      const equivalentCell = row?.querySelector('[data-field="equivalent"]');
      if (equivalentCell) {
        equivalentCell.textContent = formatCurrency(
          convertFromWeekly(updatedCategory.weeklyAmount, state.scope)
        );
      }
    }
  }
});

budgetBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button || button.disabled) return;

  const id = button.dataset.id;
  state.categories = state.categories.filter((category) => category.id !== id);
  renderAll();
});

if (startButton) {
  startButton.addEventListener('click', () => {
    const isOpen = startMenu?.classList.contains('open');
    setStartMenuOpen(!isOpen);
  });
}

if (startMenu) {
  startMenu.addEventListener('click', (event) => {
    const button = event.target.closest('.start-menu__item');
    if (!button) return;
    const windowId = button.dataset.openWindow;
    const theme = button.dataset.theme;
    if (windowId) {
      openWindow(windowId);
      if (windowId === 'snake') {
        drawSnakeFrame();
      }
      closeStartMenu();
    } else if (theme) {
      applyTheme(theme);
      closeStartMenu();
    }
  });
}

document.addEventListener('click', (event) => {
  if (!startMenu || !startMenu.classList.contains('open')) return;
  if (
    !startMenu.contains(event.target) &&
    !(startButton && startButton.contains(event.target))
  ) {
    closeStartMenu();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeStartMenu();
  }
  handleSnakeKeydown(event);
});

document.addEventListener('click', (event) => {
  const control = event.target.closest('[data-window-action]');
  if (!control) return;
  event.preventDefault();
  const panel = control.closest('.panel.window');
  if (!panel) return;
  const id = panel.dataset.windowId;
  if (!id) return;
  const action = control.dataset.windowAction;
  if (action === 'minimize') {
    minimizeWindow(id);
  } else if (action === 'close') {
    closeWindow(id);
  } else if (action === 'maximize') {
    toggleMaximizeWindow(id);
  }
});

if (snakeStartBtn) {
  snakeStartBtn.addEventListener('click', () => {
    openWindow('snake');
    startSnake();
  });
}

if (snakePauseBtn) {
  snakePauseBtn.addEventListener('click', () => {
    pauseSnake();
  });
}

if (snakeResetBtn) {
  snakeResetBtn.addEventListener('click', () => {
    resetSnakeGame();
    openWindow('snake');
  });
}

weeklyIncomeInput.addEventListener('input', (event) => {
  handleWeeklyIncomeChange(event.target.value);
});

customForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.querySelector('#customName').value.trim();
  const amount = Number.parseFloat(document.querySelector('#customAmount').value);
  const frequency = document.querySelector('#customFrequency').value;
  const notes = document.querySelector('#customNotes').value.trim();

  if (!name || Number.isNaN(amount) || amount < 0) {
    return;
  }

  addCustomCategory(name, amount, frequency, notes);
  customForm.reset();
  const customFrequencySelect = document.querySelector('#customFrequency');
  if (customFrequencySelect) {
    customFrequencySelect.value = 'weekly';
  }
});

init();
initializeWindowSystem();
window.addEventListener('resize', handleWindowResize);
