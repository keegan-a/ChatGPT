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
const finalShowcase = document.querySelector('#finalShowcase');
const finalExportBtn = document.querySelector('#finalExport');
const finalOpenTriggers = document.querySelectorAll('[data-open-final]');
const screensaverOverlay = document.querySelector('#screensaver');
const pipesCanvas = document.querySelector('#pipesCanvas');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const insightsList = document.querySelector('#insightsList');
const resetBlueprintButton = document.querySelector('#resetBlueprint');
const autoThemeToggle = document.querySelector('#autoThemeToggle');
const budgetHealthContainer = document.querySelector('#budgetHealth');
const mapperApiKeyInput = document.querySelector('#mapperApiKey');
const mapperFileInput = document.querySelector('#mapperFile');
const mapperAnalyzeBtn = document.querySelector('#mapperAnalyzeBtn');
const mapperManualInput = document.querySelector('#mapperManualInput');
const mapperParseBtn = document.querySelector('#mapperParseBtn');
const mapperClearBtn = document.querySelector('#mapperClearBtn');
const mapperApplyAllBtn = document.querySelector('#mapperApplyAllBtn');
const mapperStatus = document.querySelector('#mapperStatus');
const mapperResultsBody = document.querySelector('#mapperResultsBody');
const mapperRowTemplate = document.querySelector('#mapperRowTemplate');
const mapperAiNotice = document.querySelector('#mapperAiNotice');
const mapperRememberToggle = document.querySelector('#mapperRememberKey');
const mapperForgetKeyBtn = document.querySelector('#mapperForgetKey');
const startFocusToggle = document.querySelector('[data-action="toggle-focus"]');
const body = document.body;

const scopeFactors = {
  daily: 1 / 7,
  weekly: 1,
  monthly: 4.345,
  yearly: 52,
};

const themeClassMap = {
  win95: 'theme-win95',
  xp: 'theme-xp',
  vista: 'theme-vista',
  mac: 'theme-mac',
};

const themeColorMap = {
  win95: '#008080',
  xp: '#1a4ba8',
  vista: '#0b1f3f',
  mac: '#5a7aff',
};

const themeDisplayNames = {
  win95: 'Windows 95 Classic',
  xp: 'Windows XP Bliss',
  vista: 'Windows Vista Aurora',
  mac: '2000s Macintosh',
};

const themeTaglines = {
  win95: 'Dial-up dreams funded.',
  xp: 'Where the sky meets your savings.',
  vista: 'Glasswave your cashflow.',
  mac: 'Think different about every dollar.',
};

const entryFrequencies = ['daily', 'weekly', 'monthly'];

const scopeOrder = ['daily', 'weekly', 'monthly', 'yearly'];
const STORAGE_KEY = 'budget-builder-95-state-v3';
const MAPPER_KEY_STORAGE = 'budget-builder-95-openai-key';

const themeSequence = ['win95', 'xp', 'vista', 'mac'];

const futureHorizons = [
  { label: '1 Month', weeks: 4.345 },
  { label: '6 Months', weeks: 26.07 },
  { label: '1 Year', weeks: 52 },
  { label: '2 Years', weeks: 104 },
  { label: '5 Years', weeks: 260 },
];

function sanitizeScope(scope) {
  return scopeOrder.includes(scope) ? scope : 'daily';
}

function sanitizeFrequency(frequency) {
  return entryFrequencies.includes(frequency) ? frequency : 'weekly';
}

function normalizePersistedCategory(category, fallbackId) {
  if (!category || typeof category !== 'object') {
    return null;
  }
  const id = typeof category.id === 'string' && category.id.trim() ? category.id : `restore-${fallbackId}`;
  const name = typeof category.name === 'string' && category.name.trim() ? category.name.trim() : `Category ${fallbackId + 1}`;
  const blueprint = recommendedBlueprint.find((item) => item.name === name);
  const recommended = blueprint ? true : Boolean(category.recommended);
  const percent = Number.isFinite(category.percent)
    ? category.percent
    : blueprint
    ? blueprint.percent
    : recommended
    ? 0
    : undefined;
  const entryFrequency = sanitizeFrequency(category.entryFrequency);
  const entryAmount = Number.isFinite(category.entryAmount)
    ? category.entryAmount
    : Number.isFinite(category.weeklyAmount)
    ? convertFromWeekly(category.weeklyAmount, entryFrequency)
    : 0;
  const weeklyAmount = Number.isFinite(category.weeklyAmount)
    ? category.weeklyAmount
    : convertToWeekly(entryAmount, entryFrequency);
  return {
    id,
    name,
    percent,
    weeklyAmount,
    entryFrequency,
    entryAmount,
    notes: typeof category.notes === 'string' ? category.notes : '',
    recommended,
    customized: Boolean(category.customized),
  };
}

function loadPersistedState() {
  if (!('localStorage' in window)) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories
          .map((category, index) => normalizePersistedCategory(category, index))
          .filter(Boolean)
      : [];
    return {
      weeklyIncome: Number.isFinite(parsed.weeklyIncome) ? parsed.weeklyIncome : undefined,
      scope: sanitizeScope(parsed.scope),
      theme: themeClassMap[parsed.theme] ? parsed.theme : undefined,
      autoThemeCycle: Boolean(parsed.autoThemeCycle),
      categories,
    };
  } catch (error) {
    console.warn('Unable to load saved budget state:', error);
    return null;
  }
}

function persistState() {
  if (!('localStorage' in window)) {
    return;
  }
  try {
    const payload = {
      weeklyIncome: state.weeklyIncome,
      scope: state.scope,
      theme: state.theme,
      autoThemeCycle: state.autoThemeCycle,
      categories: state.categories.map((category) => ({
        id: category.id,
        name: category.name,
        percent: category.percent,
        weeklyAmount: category.weeklyAmount,
        entryFrequency: category.entryFrequency,
        entryAmount: category.entryAmount,
        notes: category.notes,
        recommended: category.recommended,
        customized: category.customized,
      })),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to save budget state:', error);
  }
}

function scheduleStateSave() {
  if (stateSaveTimer) {
    window.clearTimeout(stateSaveTimer);
  }
  stateSaveTimer = window.setTimeout(() => {
    stateSaveTimer = null;
    persistState();
  }, 350);
}

function getStoredMapperKey() {
  if (!('localStorage' in window)) {
    return '';
  }
  try {
    const encoded = window.localStorage.getItem(MAPPER_KEY_STORAGE);
    if (!encoded) {
      return '';
    }
    return atob(encoded);
  } catch (error) {
    console.warn('Unable to read stored API key:', error);
    return '';
  }
}

function persistMapperKey(key) {
  if (!('localStorage' in window)) {
    return;
  }
  try {
    if (key) {
      window.localStorage.setItem(MAPPER_KEY_STORAGE, btoa(key));
    } else {
      window.localStorage.removeItem(MAPPER_KEY_STORAGE);
    }
  } catch (error) {
    console.warn('Unable to store API key preference:', error);
  }
}

function getNextTheme(current) {
  const index = themeSequence.indexOf(current);
  if (index === -1) {
    return themeSequence[0];
  }
  return themeSequence[(index + 1) % themeSequence.length];
}

function startThemeCycle() {
  if (themeCycleTimer) {
    return;
  }
  themeCycleTimer = window.setInterval(() => {
    const next = getNextTheme(state.theme);
    applyTheme(next);
  }, 45000);
}

function stopThemeCycle() {
  if (!themeCycleTimer) {
    return;
  }
  window.clearInterval(themeCycleTimer);
  themeCycleTimer = null;
}

function syncAutoThemeToggle() {
  if (!autoThemeToggle) {
    return;
  }
  autoThemeToggle.checked = Boolean(state.autoThemeCycle);
  if (state.autoThemeCycle) {
    startThemeCycle();
  } else {
    stopThemeCycle();
  }
}

const SCREENSAVER_INACTIVITY_MS = 120000;
const PIPE_SEGMENT_LENGTH = 0.14;
const PIPE_MAX_POINTS = 280;
const PIPE_TURN_PROBABILITY = 0.18;
const PIPE_DIRECTIONS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
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
  autoThemeCycle: false,
};

const spendingImportState = {
  entries: [],
  busy: false,
  message: '',
};

const WINDOW_MODE_BREAKPOINT = 860;
let highestZIndex = 100;
let windowModeActive = false;

let focusModeEnabled = false;

const windowRegistry = new Map();
let activeWindowId = null;
let taskbarClockTimer = null;
let themeCycleTimer = null;
let stateSaveTimer = null;

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

const screensaverState = {
  ctx: null,
  width: 0,
  height: 0,
  pipes: [],
  animationId: null,
  active: false,
  lastTimestamp: 0,
  inactivityTimer: null,
  cameraAngle: 0,
  cameraPitch: 0.22,
  cameraPitchPhase: 0,
  rotationSpeed: 0.22,
  trailColor: 'rgba(0, 0, 0, 0.22)',
  lightDirection: { x: 0.35, y: 0.55, z: 0.72 },
};

function createRecommendedCategories(weeklyIncome) {
  return recommendedBlueprint.map((item, index) => {
    const weeklyAmount = weeklyIncome * item.percent;
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
}

function buildInitialCategories(weeklyIncome, persistedCategories) {
  const defaults = createRecommendedCategories(weeklyIncome);
  if (!Array.isArray(persistedCategories) || !persistedCategories.length) {
    return defaults;
  }

  const merged = defaults.map((category) => {
    const saved = persistedCategories.find(
      (item) => item.recommended && item.name === category.name
    );
    if (!saved) {
      return category;
    }
    const frequency = sanitizeFrequency(saved.entryFrequency);
    const entryAmount = Number.isFinite(saved.entryAmount)
      ? saved.entryAmount
      : convertFromWeekly(saved.weeklyAmount, frequency);
    const weeklyAmount = Number.isFinite(saved.weeklyAmount)
      ? saved.weeklyAmount
      : convertToWeekly(entryAmount, frequency);
    return {
      ...category,
      weeklyAmount,
      entryFrequency: frequency,
      entryAmount,
      notes: typeof saved.notes === 'string' ? saved.notes : '',
      customized: Boolean(saved.customized),
    };
  });

  const customCategories = persistedCategories
    .filter((item) => !item.recommended && typeof item.name === 'string' && item.name.trim())
    .map((item, index) => {
      const frequency = sanitizeFrequency(item.entryFrequency);
      const entryAmount = Number.isFinite(item.entryAmount)
        ? item.entryAmount
        : convertFromWeekly(item.weeklyAmount, frequency);
      const weeklyAmount = Number.isFinite(item.weeklyAmount)
        ? item.weeklyAmount
        : convertToWeekly(entryAmount, frequency);
      const id = typeof item.id === 'string' && item.id.trim() ? item.id : `restore-custom-${index}`;
      return {
        id,
        name: item.name.trim(),
        percent: Number.isFinite(item.percent) ? item.percent : undefined,
        weeklyAmount,
        entryFrequency: frequency,
        entryAmount,
        notes: typeof item.notes === 'string' ? item.notes : '',
        recommended: false,
        customized: item.customized !== false,
      };
    });

  return merged.concat(customCategories);
}

function normalizeCategoryAmounts(category) {
  const frequency = sanitizeFrequency(category.entryFrequency);
  const weeklyAmount = Number.isFinite(category.weeklyAmount)
    ? category.weeklyAmount
    : convertToWeekly(Number.isFinite(category.entryAmount) ? category.entryAmount : 0, frequency);
  const entryAmount = Number.isFinite(category.entryAmount)
    ? category.entryAmount
    : convertFromWeekly(weeklyAmount, frequency);
  return {
    ...category,
    entryFrequency: frequency,
    weeklyAmount,
    entryAmount,
  };
}

function syncAllCategoryAmounts() {
  state.categories = state.categories.map((category) => normalizeCategoryAmounts(category));
}

function init() {
  const persisted = loadPersistedState();
  if (persisted) {
    if (Number.isFinite(persisted.weeklyIncome)) {
      state.weeklyIncome = persisted.weeklyIncome;
    }
    if (persisted.scope) {
      state.scope = sanitizeScope(persisted.scope);
    }
    if (persisted.theme) {
      state.theme = persisted.theme;
    }
    state.autoThemeCycle = Boolean(persisted.autoThemeCycle);
    state.categories = buildInitialCategories(state.weeklyIncome, persisted.categories);
  } else {
    state.categories = createRecommendedCategories(state.weeklyIncome);
  }
  if (weeklyIncomeInput) {
    weeklyIncomeInput.value = state.weeklyIncome.toFixed(2);
  }
  setActiveScopeChip(state.scope);
  applyTheme(state.theme);
  syncAutoThemeToggle();
  syncAllCategoryAmounts();
  updateFocusToggleLabel();
  renderAll();
  if (mapperRememberToggle) {
    mapperRememberToggle.checked = false;
  }
  if (mapperApiKeyInput) {
    const storedKey = getStoredMapperKey();
    if (storedKey) {
      mapperApiKeyInput.value = storedKey;
      if (mapperRememberToggle) {
        mapperRememberToggle.checked = true;
      }
    }
  }
  updateMapperStatus('Upload a statement image or paste text to start mapping.');
  initializeSnakeGame();
  initializeScreensaver();
  registerWindows();
  startTaskbarClock();
  scheduleStateSave();
}

function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function hexToRgb(hex) {
  if (!hex) return null;
  const value = hex.trim();
  const match = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }
  let normalized = match[1];
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const intValue = Number.parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function rgbToString(rgb, alpha = 1) {
  if (!rgb) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  const { r, g, b } = rgb;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function mixHexColor(color, target, amount) {
  const baseRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  if (!baseRgb || !targetRgb) {
    return color;
  }
  return rgbToString(mixRgb(baseRgb, targetRgb, clamp(amount, 0, 1)));
}

function lightenColor(color, amount = 0.35) {
  return mixHexColor(color, '#ffffff', amount);
}

function darkenColor(color, amount = 0.35) {
  return mixHexColor(color, '#000000', amount);
}

function blendColors(colorA, colorB, amount = 0.5) {
  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);
  if (!rgbA || !rgbB) {
    return colorA;
  }
  return rgbToString(mixRgb(rgbA, rgbB, clamp(amount, 0, 1)));
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

function setActiveScopeChip(scope) {
  if (!scopeChooser) {
    return;
  }
  scopeChooser.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.scope === scope);
  });
}

function changeScope(newScope) {
  const resolvedScope = sanitizeScope(newScope);
  if (resolvedScope === state.scope) {
    return;
  }
  setActiveScopeChip(resolvedScope);
  state.scope = resolvedScope;
  renderBudgetTable();
  renderSummary();
  renderFinalShowcase();
  renderInsights();
  scheduleStateSave();
}

function stepScope(delta) {
  const currentIndex = scopeOrder.indexOf(state.scope);
  if (currentIndex === -1) {
    changeScope(scopeOrder[0]);
    return;
  }
  const nextIndex = (currentIndex + delta + scopeOrder.length) % scopeOrder.length;
  changeScope(scopeOrder[nextIndex]);
}

function formatFrequencyLabel(frequency) {
  if (!frequency) return '';
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>'"]/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[char] || char;
  });
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

function getThemeDisplayName(theme) {
  return themeDisplayNames[theme] || themeDisplayNames.win95;
}

function getThemeTagline(theme) {
  return themeTaglines[theme] || themeTaglines.win95;
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

  if (budgetHealthContainer) {
    const expenseRatio = state.weeklyIncome === 0 ? 0 : totalExpensesWeekly / state.weeklyIncome;
    const clampedRatio = Math.max(0, Math.min(expenseRatio, 1.5));
    const goalRatio = 0.8;
    let healthMessage = 'Dial in your categories to stay below 80% of income.';
    if (expenseRatio <= 0.75) {
      healthMessage = 'Fantastic! Your plan keeps plenty of cash free each week.';
    } else if (expenseRatio <= 1) {
      healthMessage = 'Close to balanced—trim a category or two to grow savings.';
    } else {
      healthMessage = 'Over budget—consider scaling back or increasing income inputs.';
    }
    const leftoverDescriptor = leftoverWeekly >= 0 ? 'weekly buffer' : 'overage';
    budgetHealthContainer.hidden = false;
    budgetHealthContainer.innerHTML = `
      <div class="budget-health__label">
        <span>Planned spending coverage</span>
        <strong>${(expenseRatio * 100).toFixed(1)}%</strong>
      </div>
      <div class="budget-health__meter">
        <div class="budget-health__fill" style="transform: scaleX(${clampedRatio});"></div>
        <div class="budget-health__goal" style="left: ${goalRatio * 100}%;"></div>
      </div>
      <div class="budget-health__label">
        <span>${healthMessage}</span>
        <span>${formatCurrency(Math.abs(leftoverWeekly))} ${leftoverDescriptor}</span>
      </div>
    `;
  }
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

function renderInsights() {
  if (!insightsList) {
    return;
  }

  insightsList.innerHTML = '';
  if (!state.categories.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'insights-empty';
    emptyItem.textContent = 'Add categories to unlock personalized insights.';
    insightsList.appendChild(emptyItem);
    return;
  }

  const totalExpensesWeekly = state.categories.reduce(
    (sum, category) => sum + category.weeklyAmount,
    0
  );
  const leftoverWeekly = state.weeklyIncome - totalExpensesWeekly;
  const savingsRate = state.weeklyIncome === 0 ? 0 : leftoverWeekly / state.weeklyIncome;
  const scopeLabel = formatScopeLabel(state.scope);
  const largestCategory = state.categories.reduce((winner, category) => {
    if (!winner || category.weeklyAmount > winner.weeklyAmount) {
      return category;
    }
    return winner;
  }, null);
  const largestShare =
    state.weeklyIncome > 0 && largestCategory
      ? (largestCategory.weeklyAmount / state.weeklyIncome) * 100
      : 0;

  const blueprintPercents = new Map(
    recommendedBlueprint.map((item) => [item.name, item.percent])
  );
  const recommendedDeltas = state.categories
    .filter((category) => category.recommended && blueprintPercents.has(category.name))
    .map((category) => {
      const target = state.weeklyIncome * blueprintPercents.get(category.name);
      return {
        name: category.name,
        delta: category.weeklyAmount - target,
      };
    });

  const largestDelta = recommendedDeltas.reduce(
    (winner, entry) => {
      if (!winner) return entry;
      return Math.abs(entry.delta) > Math.abs(winner.delta) ? entry : winner;
    },
    null
  );

  const customCount = state.categories.filter((category) => !category.recommended).length;

  const insights = [];
  if (largestCategory) {
    insights.push(
      `${largestCategory.name} is your biggest plan at ${largestShare.toFixed(1)}% of weekly income.`
    );
  }

  insights.push(
    leftoverWeekly >= 0
      ? `You're freeing up ${formatCurrency(leftoverWeekly)} each week — stash it for future goals!`
      : `You're overspending by ${formatCurrency(Math.abs(leftoverWeekly))} per week. Consider trimming a category.`
  );

  insights.push(`Savings rate: ${(savingsRate * 100).toFixed(1)}% in the ${scopeLabel} view.`);

  if (largestDelta && Math.abs(largestDelta.delta) > 1) {
    insights.push(
      `${largestDelta.name} is ${largestDelta.delta > 0 ? 'over' : 'under'} its starter target by ${formatCurrency(Math.abs(largestDelta.delta))} each week.`
    );
  }

  if (customCount > 0) {
    insights.push(
      `You've added ${customCount} custom ${customCount === 1 ? 'category' : 'categories'} to personalize the plan.`
    );
  } else {
    insights.push('Try adding a custom category to capture unique spending or saving goals.');
  }

  insights.push(`Theme vibe: ${getThemeDisplayName(state.theme)} — ${getThemeTagline(state.theme)}`);

  insights.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = entry;
    insightsList.appendChild(item);
  });
}

function ensureMapperTarget(entry) {
  if (!entry) return '';
  if (entry.targetId && state.categories.some((category) => category.id === entry.targetId)) {
    return entry.targetId;
  }
  const guess = guessMapperTarget(entry);
  entry.targetId = guess || '';
  return entry.targetId;
}

function renderMapperEntries() {
  if (!mapperResultsBody) {
    return;
  }

  mapperResultsBody.innerHTML = '';
  const hasEntries = spendingImportState.entries.length > 0;
  if (!hasEntries) {
    const emptyRow = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'mapper-empty';
    cell.textContent = spendingImportState.busy
      ? 'Analyzing your statement…'
      : 'No imported entries yet. Upload a statement or paste text to begin.';
    emptyRow.appendChild(cell);
    mapperResultsBody.appendChild(emptyRow);
    if (mapperApplyAllBtn) {
      mapperApplyAllBtn.disabled = true;
    }
    return;
  }

  const categories = state.categories
    .slice()
    .sort((a, b) => {
      if (a.recommended === b.recommended) {
        return a.name.localeCompare(b.name);
      }
      return a.recommended ? -1 : 1;
    });

  const fragment = document.createDocumentFragment();
  spendingImportState.entries.forEach((entry) => {
    ensureMapperTarget(entry);
    const templateRow = mapperRowTemplate?.content?.firstElementChild;
    const row = templateRow ? templateRow.cloneNode(true) : document.createElement('tr');
    row.dataset.entryId = entry.id;

    const labelCell =
      row.querySelector('.mapper-col--label') || row.cells?.[0] || row.appendChild(document.createElement('td'));
    labelCell.textContent = entry.label;

    const amountCell =
      row.querySelector('.mapper-col--amount') || row.cells?.[1] || row.appendChild(document.createElement('td'));
    amountCell.textContent = formatCurrency(entry.amount);

    const frequencySelect = row.querySelector('.mapper-frequency');
    if (frequencySelect) {
      frequencySelect.value = entry.frequency;
      frequencySelect.dataset.entryId = entry.id;
      frequencySelect.disabled = spendingImportState.busy;
    }

    const targetSelect = row.querySelector('.mapper-target');
    if (targetSelect) {
      targetSelect.dataset.entryId = entry.id;
      populateMapperTargetOptions(targetSelect, entry, categories);
      targetSelect.disabled = spendingImportState.busy;
    }

    const applyButton = row.querySelector('.mapper-apply');
    if (applyButton) {
      applyButton.dataset.entryId = entry.id;
      applyButton.disabled = spendingImportState.busy;
    }

    fragment.appendChild(row);
  });

  mapperResultsBody.appendChild(fragment);
  if (mapperApplyAllBtn) {
    mapperApplyAllBtn.disabled = spendingImportState.busy;
  }
}

function updateMapperStatus(message, tone = 'info') {
  if (!mapperStatus) return;
  mapperStatus.textContent = message || '';
  if (message) {
    mapperStatus.dataset.tone = tone;
  } else {
    mapperStatus.removeAttribute('data-tone');
  }
}

function setMapperBusy(isBusy) {
  spendingImportState.busy = isBusy;
  if (mapperAnalyzeBtn) mapperAnalyzeBtn.disabled = isBusy;
  if (mapperFileInput) mapperFileInput.disabled = isBusy;
  if (mapperParseBtn) mapperParseBtn.disabled = isBusy;
  if (mapperClearBtn) mapperClearBtn.disabled = isBusy;
  if (mapperApplyAllBtn) mapperApplyAllBtn.disabled = isBusy || spendingImportState.entries.length === 0;
  if (mapperApiKeyInput) mapperApiKeyInput.disabled = isBusy;
  if (mapperRememberToggle) mapperRememberToggle.disabled = isBusy;
  if (mapperForgetKeyBtn) mapperForgetKeyBtn.disabled = isBusy;
  renderMapperEntries();
}

function generateImportId() {
  if (window.crypto?.randomUUID) {
    return `import-${crypto.randomUUID()}`;
  }
  return `import-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeImportEntry(entry) {
  if (!entry) return null;
  const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : 'Imported item';
  const amount = Math.abs(Number.parseFloat(entry.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const frequency = sanitizeFrequency(entry.frequency);
  return {
    id: generateImportId(),
    label,
    amount,
    frequency,
    targetId: entry.targetId || '',
    notes: typeof entry.notes === 'string' ? entry.notes : '',
  };
}

function guessMapperTarget(entry) {
  if (!entry || !entry.label) {
    return '';
  }
  const label = entry.label.toLowerCase();
  let bestMatch = '';
  let bestScore = 0;
  state.categories.forEach((category) => {
    const name = category.name.toLowerCase();
    if (name === label) {
      bestMatch = category.id;
      bestScore = 3;
      return;
    }
    if (bestScore < 2 && (label.includes(name) || name.includes(label))) {
      bestMatch = category.id;
      bestScore = 2;
      return;
    }
    if (bestScore < 1) {
      const labelTokens = label.split(/\s+/).filter((token) => token.length >= 4);
      if (labelTokens.some((token) => name.includes(token))) {
        bestMatch = category.id;
        bestScore = 1;
      }
    }
  });
  return bestMatch;
}

function populateMapperTargetOptions(select, entry, categories) {
  if (!select) return;
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose destination';
  select.appendChild(placeholder);

  const trimmedLabel = entry.label.length > 28 ? `${entry.label.slice(0, 26)}…` : entry.label;
  const createOption = document.createElement('option');
  createOption.value = '__new__';
  createOption.textContent = `Create new “${trimmedLabel}”`;
  select.appendChild(createOption);

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.recommended ? `★ ${category.name}` : category.name;
    select.appendChild(option);
  });

  if (entry.targetId && (entry.targetId === '__new__' || categories.some((cat) => cat.id === entry.targetId))) {
    select.value = entry.targetId;
  } else {
    select.value = '';
  }
}

function addImportEntries(entries, sourceLabel) {
  if (!Array.isArray(entries) || !entries.length) {
    updateMapperStatus('No recognizable spending entries were found.', 'error');
    return;
  }
  const normalized = entries
    .map((entry) => normalizeImportEntry(entry))
    .filter(Boolean);
  if (!normalized.length) {
    updateMapperStatus('Entries were detected but no valid amounts were found.', 'error');
    return;
  }
  normalized.forEach((entry) => {
    ensureMapperTarget(entry);
    spendingImportState.entries.push(entry);
  });
  renderMapperEntries();
  updateMapperStatus(`Loaded ${normalized.length} entr${normalized.length === 1 ? 'y' : 'ies'} from ${sourceLabel}.`, 'success');
}

function clearImportEntries() {
  spendingImportState.entries = [];
  renderMapperEntries();
  updateMapperStatus('Cleared imported spending entries.');
}

function removeImportEntry(entryId) {
  spendingImportState.entries = spendingImportState.entries.filter((entry) => entry.id !== entryId);
  renderMapperEntries();
}

function applyImportEntry(entryId) {
  const entry = spendingImportState.entries.find((item) => item.id === entryId);
  if (!entry) {
    updateMapperStatus('Entry not found. Refresh and try again.', 'error');
    return false;
  }
  if (!entry.targetId) {
    updateMapperStatus('Choose a destination before applying this entry.', 'error');
    return false;
  }

  if (entry.targetId === '__new__') {
    addCustomCategory(entry.label, entry.amount, entry.frequency, entry.notes || 'Imported via Spending Mapper');
    removeImportEntry(entryId);
    updateMapperStatus(`Added ${entry.label} to your budget.`, 'success');
    return true;
  }

  const category = state.categories.find((item) => item.id === entry.targetId);
  if (!category) {
    updateMapperStatus('The selected category no longer exists. Pick another destination.', 'error');
    return false;
  }

  updateCategoryFrequency(category.id, entry.frequency);
  const updated = updateCategoryEntryAmount(category.id, entry.amount);
  if (updated) {
    renderBudgetTable();
    removeImportEntry(entryId);
    updateMapperStatus(`Updated ${category.name} with ${formatCurrency(entry.amount)} ${entry.frequency}.`, 'success');
    return true;
  }
  updateMapperStatus('Unable to update that category. Try again.', 'error');
  return false;
}

function applyAllImportEntries() {
  if (!spendingImportState.entries.length) {
    updateMapperStatus('No entries to apply. Import data first.', 'error');
    return;
  }
  const pending = [...spendingImportState.entries];
  let appliedCount = 0;
  pending.forEach((entry) => {
    const success = applyImportEntry(entry.id);
    if (success) {
      appliedCount += 1;
    }
  });
  if (appliedCount) {
    updateMapperStatus(`Applied ${appliedCount} entr${appliedCount === 1 ? 'y' : 'ies'} to your budget.`, 'success');
  }
}

function parseManualSpending(text) {
  if (!text) return [];
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/[\u2013\u2014]/g, '-').trim())
    .filter(Boolean);
  const entries = [];
  lines.forEach((line) => {
    const amountMatch = line.match(/-?\$?\s*([0-9][0-9.,]*)/);
    if (!amountMatch) {
      return;
    }
    const rawAmount = amountMatch[0];
    const numericAmount = Math.abs(Number.parseFloat(rawAmount.replace(/[^0-9.-]/g, '')));
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      return;
    }

    let workingLine = line.replace(rawAmount, ' ');
    const frequencyTokens = [
      { regex: /(biweekly|fortnight)/i, frequency: 'weekly', adjust: (value) => value / 2 },
      { regex: /(daily|per\s*day)/i, frequency: 'daily', adjust: (value) => value },
      { regex: /(weekly|per\s*week|\bweek\b)/i, frequency: 'weekly', adjust: (value) => value },
      { regex: /(monthly|per\s*month|\bmonth\b|mo\b)/i, frequency: 'monthly', adjust: (value) => value },
      { regex: /(yearly|annual|per\s*year|\byear\b)/i, frequency: 'monthly', adjust: (value) => value / 12 },
    ];

    let frequency = 'monthly';
    let adjustedAmount = numericAmount;
    frequencyTokens.some((token) => {
      if (token.regex.test(workingLine)) {
        workingLine = workingLine.replace(token.regex, ' ');
        frequency = token.frequency;
        adjustedAmount = token.adjust(numericAmount);
        return true;
      }
      return false;
    });

    workingLine = workingLine.replace(/[-:,]+/g, ' ');
    const label = workingLine.replace(/\s+/g, ' ').trim();
    entries.push({
      label: label || 'Imported item',
      amount: adjustedAmount,
      frequency,
      notes: 'Manual mapper import',
    });
  });
  return entries;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? result.split(',').pop() : '';
      if (!base64) {
        reject(new Error('Unable to read the selected file.'));
      } else {
        resolve(base64);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function isPdfFile(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (type === 'application/pdf') return true;
  return file.name?.toLowerCase().endsWith('.pdf');
}

async function readPdfAsText(file) {
  if (!file) return '';
  if (!window.pdfjsLib) {
    throw new Error('PDF support is unavailable. Check your internet connection and refresh.');
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.GlobalWorkerOptions.workerSrc || '';
    }
    if (typeof window.pdfjsLib.disableWorker !== 'undefined') {
      window.pdfjsLib.disableWorker = true;
    }
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    const limit = Math.min(pdf.numPages, 12);
    const parts = [];
    for (let pageIndex = 1; pageIndex <= limit; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      if (pageText.trim()) {
        parts.push(`[Page ${pageIndex}] ${pageText.trim()}`);
      }
    }
    return parts.join('\n\n');
  } catch (error) {
    console.warn('Unable to extract PDF text:', error);
    throw new Error('Could not read the PDF. Try a smaller file or use manual entry.');
  }
}

function truncateForModel(text, limit = 8000) {
  if (!text || text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 120)}… (truncated)`;
}

async function analyzeStatementWithAI(files, apiKey) {
  const uploadFiles = Array.isArray(files) ? files : files ? [files] : [];
  if (!uploadFiles.length) {
    throw new Error('Choose at least one statement file before analyzing.');
  }
  if (!apiKey) {
    throw new Error('Provide an OpenAI API key to analyze statements.');
  }
  if (typeof fetch !== 'function') {
    throw new Error('This browser cannot make the required API request. Try manual entry instead.');
  }

  const imagePayloads = [];
  const pdfSnippets = [];
  const unsupported = [];

  for (const file of uploadFiles) {
    if (!file) continue;
    if (isPdfFile(file)) {
      const text = await readPdfAsText(file);
      if (text) {
        const prefix = file.name ? `File: ${file.name}\n` : '';
        pdfSnippets.push(`${prefix}${text}`);
      }
    } else if ((file.type || '').toLowerCase().startsWith('image/')) {
      const base64 = await readFileAsBase64(file);
      const detail = uploadFiles.length > 1 ? 'low' : 'high';
      imagePayloads.push({
        type: 'image_url',
        image_url: {
          detail,
          url: `data:${file.type || 'image/png'};base64,${base64}`,
        },
      });
    } else {
      unsupported.push(file.name || file.type || 'Unknown file');
    }
  }

  if (unsupported.length) {
    throw new Error(`Unsupported file type: ${unsupported.join(', ')}. Use images or PDFs.`);
  }

  if (!imagePayloads.length && !pdfSnippets.length) {
    throw new Error('No readable content was found. Try different files or manual entry.');
  }

  const requestBody = {
    model: 'gpt-4o-mini',
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'statement_summary',
        schema: {
          type: 'object',
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  amount: { type: 'number' },
                  cadence: {
                    type: 'string',
                    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
                    nullable: true,
                  },
                  notes: { type: 'string', nullable: true },
                },
                required: ['label', 'amount'],
                additionalProperties: false,
              },
            },
          },
          required: ['transactions'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'You extract personal budget categories from bank statements and receipts. Return concise categories and total amounts.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Identify recurring spending categories and their amounts from these statements. Prioritize weekly or monthly cadences when possible.',
          },
          ...imagePayloads,
          ...(pdfSnippets.length
            ? [
                {
                  type: 'text',
                  text: truncateForModel(
                    `Here are text excerpts from PDF statements:\n\n${pdfSnippets.join('\n\n---\n\n')}`,
                    9000
                  ),
                },
              ]
            : []),
        ],
      },
    ],
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API responded with ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not include any content.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error('Unable to parse OpenAI response.');
  }

  if (!parsed?.transactions || !Array.isArray(parsed.transactions)) {
    throw new Error('OpenAI response did not include recognizable transactions.');
  }

  return parsed.transactions.map((transaction) => {
    const frequency = (() => {
      const raw = typeof transaction.cadence === 'string' ? transaction.cadence.toLowerCase() : '';
      if (raw === 'biweekly') {
        return 'weekly';
      }
      if (raw === 'yearly' || raw === 'annual') {
        return 'monthly';
      }
      if (entryFrequencies.includes(raw)) {
        return raw;
      }
      return 'monthly';
    })();
    let amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    if (typeof transaction.cadence === 'string' && transaction.cadence.toLowerCase() === 'biweekly') {
      amount = amount / 2;
    } else if (typeof transaction.cadence === 'string' && transaction.cadence.toLowerCase().includes('year')) {
      amount = amount / 12;
    }
    return {
      label: transaction.label,
      amount,
      frequency,
      notes: transaction.notes || 'AI-assisted import',
    };
  }).filter(Boolean);
}

function renderFinalShowcase() {
  if (!finalShowcase) return;

  if (!state.categories.length) {
    finalShowcase.innerHTML =
      '<div class="final-no-data">Add categories to craft your showcase-ready budget.</div>';
    return;
  }

  const totalExpensesWeekly = state.categories.reduce(
    (sum, category) => sum + category.weeklyAmount,
    0
  );
  const leftoverWeekly = state.weeklyIncome - totalExpensesWeekly;
  const savingsRate = state.weeklyIncome === 0 ? 0 : leftoverWeekly / state.weeklyIncome;
  const mintedOn = new Date().toLocaleDateString();
  const themeName = getThemeDisplayName(state.theme);
  const themeTagline = getThemeTagline(state.theme);

  const summaryCards = [
    {
      label: 'Daily Spend Plan',
      sublabel: 'Expenses',
      value: convertFromWeekly(totalExpensesWeekly, 'daily'),
      format: formatCurrency,
    },
    {
      label: 'Weekly Net',
      sublabel: leftoverWeekly >= 0 ? 'Surplus' : 'Shortfall',
      value: leftoverWeekly,
      format: formatCurrency,
      accent: leftoverWeekly >= 0 ? 'delta-positive' : 'delta-negative',
    },
    {
      label: 'Monthly Income',
      sublabel: 'Gross',
      value: convertFromWeekly(state.weeklyIncome, 'monthly'),
      format: formatCurrency,
    },
    {
      label: 'Savings Rate',
      sublabel: 'Aim for 20%',
      value: savingsRate,
      format: formatPercentage,
      accent: savingsRate >= 0.2 ? 'delta-positive' : 'delta-negative',
    },
  ];

  const categories = [...state.categories].sort(
    (a, b) => b.weeklyAmount - a.weeklyAmount
  );

  const categoryMarkup = categories
    .map((category) => {
      const share =
        state.weeklyIncome > 0
          ? Math.max(0, category.weeklyAmount / state.weeklyIncome)
          : 0;
      const monthlyAmount = convertFromWeekly(category.weeklyAmount, 'monthly');
      const notes = category.notes?.trim?.();
      const entryLabel = formatFrequencyLabel(category.entryFrequency);
      return `
        <article class="final-category">
          <header class="final-category__header">
            <h4>${escapeHtml(category.name)}</h4>
            <span class="final-category__percent">${formatPercentage(share)}</span>
          </header>
          <div class="final-category__meta">
            <span>Entry: ${formatCurrency(category.entryAmount)} ${escapeHtml(entryLabel)}</span>
            <span>Weekly: ${formatCurrency(category.weeklyAmount)}</span>
            <span>Monthly: ${formatCurrency(monthlyAmount)}</span>
          </div>
          ${notes ? `<p class="final-category__notes">${escapeHtml(notes)}</p>` : ''}
        </article>
      `;
    })
    .join('');

  finalShowcase.innerHTML = `
    <article class="final-card">
      <div class="final-hero">
        <div class="final-logo">Budget Builder 95</div>
        <div class="final-info">
          <span>Theme</span>
          <strong>${escapeHtml(themeName)}</strong>
        </div>
        <div class="final-info">
          <span>Minted</span>
          <strong>${escapeHtml(mintedOn)}</strong>
        </div>
        <div class="final-info">
          <span>Active Scope</span>
          <strong>${escapeHtml(formatScopeLabel(state.scope))}</strong>
        </div>
      </div>
      <div class="final-summary-grid">
        ${summaryCards
          .map((card) => {
            const valueText = card.format ? card.format(card.value) : formatCurrency(card.value);
            const accentClass = card.accent ? ` ${card.accent}` : '';
            return `
              <div class="final-summary-card">
                <span class="label">${escapeHtml(card.label)}</span>
                <strong class="${accentClass.trim()}">${escapeHtml(valueText)}</strong>
                ${card.sublabel ? `<span class="final-summary-sub">${escapeHtml(card.sublabel)}</span>` : ''}
              </div>
            `;
          })
          .join('')}
      </div>
      <div class="final-divider"></div>
      <div class="final-categories">
        <h3>Category Mix</h3>
        <div class="final-category-list">
          ${categoryMarkup}
        </div>
      </div>
      <footer class="final-footer">
        <span class="final-badge">Net Weekly ${formatCurrency(leftoverWeekly)}</span>
        <span class="final-signoff">${escapeHtml(themeTagline)}</span>
      </footer>
    </article>
  `;
}

function exportFinalShowcase() {
  if (!finalShowcase) return;
  const showcaseHTML = finalShowcase.innerHTML;
  const themeName = getThemeDisplayName(state.theme);
  const computedBody = body ? window.getComputedStyle(body) : null;
  const backgroundColor = computedBody?.backgroundColor || '#f4f6f8';
  const backgroundImage = computedBody?.backgroundImage || 'linear-gradient(135deg, #7ec0ee, #2f6c32)';
  const textColor = computedBody?.color || '#111111';
  const fontFamily = computedBody?.fontFamily || "'Segoe UI', sans-serif";
  const printWindow = window.open('', '_blank', 'noopener');
  if (!printWindow) {
    window.alert('Please enable pop-ups to save the PDF showcase.');
    return;
  }

  const styleBlock = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 48px 32px;
      background-color: ${backgroundColor};
      background-image: ${backgroundImage};
      background-size: cover;
      background-attachment: fixed;
      color: ${textColor};
      font-family: ${fontFamily};
    }
    .print-wrapper {
      max-width: 960px;
      margin: 0 auto;
    }
    .final-showcase {
      border-radius: 24px;
      padding: 32px 36px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.6);
    }
    .final-card { gap: 28px; }
    .final-hero { gap: 24px; }
    .final-logo { font-size: 26px; }
    .final-summary-grid { gap: 20px; }
    .final-summary-card { border-radius: 18px; padding: 20px; }
    .final-category-list { gap: 16px; }
    .final-category { border-radius: 16px; padding: 18px 20px; }
    .final-footer { font-size: 14px; }
    .final-badge { font-size: 14px; padding: 8px 16px; }
    .final-signoff { font-size: 14px; }
    .final-summary-sub { font-size: 12px; letter-spacing: 0.6px; text-transform: uppercase; color: rgba(70, 70, 90, 0.9); }
    .delta-positive { color: #0a7d00; }
    .delta-negative { color: #9f0000; }
    @page { margin: 18mm; }
  `;

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(themeName)} Budget Showcase</title>
        <style>${styleBlock}</style>
      </head>
      <body>
        <div class="print-wrapper">
          <div class="final-showcase">
            ${showcaseHTML}
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}

function renderAll() {
  syncAllCategoryAmounts();
  renderIncomeSnapshot();
  renderBudgetTable();
  renderSummary();
  renderFutureForecast();
  renderFinalShowcase();
  renderInsights();
  renderMapperEntries();
  scheduleStateSave();
}

function getCSSVar(name) {
  if (!body) return '';
  return getComputedStyle(body).getPropertyValue(name).trim();
}

function applyTheme(theme) {
  const resolvedTheme = themeClassMap[theme] ? theme : 'win95';
  const className = themeClassMap[resolvedTheme];
  state.theme = resolvedTheme;
  if (!body) return;
  Object.values(themeClassMap).forEach((value) => body.classList.remove(value));
  body.classList.add(className);
  body.dataset.theme = resolvedTheme;
  if (themeMeta) {
    themeMeta.setAttribute('content', themeColorMap[resolvedTheme] || themeColorMap.win95);
  }
  drawSnakeFrame();
  renderFinalShowcase();
  renderInsights();
  scheduleStateSave();
}

function updateFocusToggleLabel() {
  if (!startFocusToggle) return;
  startFocusToggle.textContent = focusModeEnabled ? '🎯 Disable focus mode' : '🎯 Enable focus mode';
}

function setFocusMode(enabled) {
  focusModeEnabled = Boolean(enabled);
  if (body) {
    body.classList.toggle('focus-mode-active', focusModeEnabled);
  }
  updateFocusToggleLabel();
  updateTaskbarActiveState(activeWindowId);
}

function updateTaskbarActiveState(activeId) {
  windowRegistry.forEach((record) => {
    if (!record.taskbarButton) return;
    const isActive = Boolean(activeId && record.id === activeId && record.state === 'open');
    record.taskbarButton.classList.toggle('is-active', isActive);
    record.taskbarButton.disabled = record.state === 'closed';
    record.taskbarButton.dataset.windowState = record.state;
    const stateLabel =
      record.state === 'open' ? 'Open' : record.state === 'minimized' ? 'Minimized' : 'Closed';
    record.taskbarButton.title = `${record.title} — ${stateLabel}`;
    record.taskbarButton.setAttribute('aria-label', `${record.title} window (${stateLabel})`);
    if (record.element) {
      record.element.classList.toggle('is-active-window', isActive);
    }
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
    button.innerHTML = `
      <span class="taskbar-button__dot" aria-hidden="true"></span>
      <span class="taskbar-button__label">${record.title}</span>
    `;
    button.disabled = record.state === 'closed';
    const stateLabel =
      record.state === 'open' ? 'Open' : record.state === 'minimized' ? 'Minimized' : 'Closed';
    button.title = `${record.title} — ${stateLabel}`;
    button.setAttribute('aria-label', `${record.title} window (${stateLabel})`);
    button.addEventListener('click', () => toggleWindowFromTaskbar(record.id));
    record.taskbarButton = button;
    taskbarButtonsContainer.appendChild(button);
  });
  updateTaskbarActiveState(activeWindowId);
}

function setControlGlyph(button, glyph) {
  if (!button) return;
  const glyphSpan = button.querySelector('.window-control__icon') || button.querySelector('span');
  if (glyphSpan) {
    glyphSpan.textContent = glyph;
  } else {
    button.textContent = glyph;
  }
}

function getPanelTitle(panel) {
  if (!panel) return 'window';
  return (
    panel.dataset.windowTitle ||
    panel.querySelector('.window-title')?.textContent?.trim() ||
    'window'
  );
}

function updateWindowControlIcons(panel) {
  if (!panel) return;
  const minimizeButton = panel.querySelector('[data-window-action="minimize"]');
  const maximizeButton = panel.querySelector('[data-window-action="maximize"]');
  const closeButton = panel.querySelector('[data-window-action="close"]');
  const panelTitle = getPanelTitle(panel);
  setControlGlyph(minimizeButton, '–');
  const isMaximized = panel.dataset.maximized === 'true';
  setControlGlyph(maximizeButton, isMaximized ? '🗗' : '▢');
  if (maximizeButton) {
    const label = isMaximized
      ? `Restore ${panelTitle} window`
      : `Maximize ${panelTitle} window`;
    maximizeButton.setAttribute('aria-label', label);
    maximizeButton.title = label;
  }
  if (minimizeButton) {
    const minLabel = `Minimize ${panelTitle} window`;
    minimizeButton.setAttribute('aria-label', minLabel);
    minimizeButton.title = minLabel;
  }
  setControlGlyph(closeButton, '✕');
  if (closeButton) {
    const closeLabel = `Close ${panelTitle} window`;
    closeButton.setAttribute('aria-label', closeLabel);
    closeButton.title = closeLabel;
  }
}

function updateAllWindowControlIcons() {
  windowRegistry.forEach((record) => updateWindowControlIcons(record.element));
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
    panel.dataset.windowState = record.state;
    panel.dataset.maximized = record.maximized ? 'true' : 'false';
    windowRegistry.set(id, record);
    updateWindowControlIcons(panel);
  });
  buildTaskbarButtons();
  updateStartMenuWindowList();
}

function openWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  record.state = 'open';
  const panel = record.element;
  panel.classList.remove('hidden-window');
  panel.dataset.windowState = 'open';
  panel.dataset.maximized = record.maximized ? 'true' : 'false';
  if (record.taskbarButton) {
    record.taskbarButton.disabled = false;
  }
  if (windowModeActive) {
    const frameRect = appFrame.getBoundingClientRect();
    if (record.maximized) {
      panel.style.left = '0px';
      panel.style.top = '0px';
      panel.style.width = `${frameRect.width}px`;
      panel.style.height = `${frameRect.height}px`;
      panel.dataset.x = '0';
      panel.dataset.y = '0';
      panel.dataset.width = String(frameRect.width);
      panel.dataset.height = String(frameRect.height);
    } else if (record.restoreBounds) {
      const { left, top, width, height } = record.restoreBounds;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
      panel.dataset.x = String(left);
      panel.dataset.y = String(top);
      panel.dataset.width = String(width);
      panel.dataset.height = String(height);
      constrainPanelToFrame(panel, frameRect);
    } else {
      constrainPanelToFrame(panel, frameRect);
    }
  }
  bringToFront(panel);
  updateWindowControlIcons(panel);
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
  const panel = record.element;
  panel.classList.add('hidden-window');
  panel.dataset.windowState = 'minimized';
  if (record.taskbarButton) {
    record.taskbarButton.disabled = false;
  }
  if (activeWindowId === id) {
    updateTaskbarActiveState(null);
  } else {
    updateTaskbarActiveState(activeWindowId);
  }
  updateWindowControlIcons(panel);
  updateStartMenuWindowList();
}

function closeWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  record.state = 'closed';
  const panel = record.element;
  panel.classList.add('hidden-window');
  panel.classList.remove('mobile-maximized');
  panel.dataset.windowState = 'closed';
  if (record.maximized && record.restoreBounds) {
    const { left, top, width, height } = record.restoreBounds;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.dataset.x = String(left);
    panel.dataset.y = String(top);
    panel.dataset.width = String(width);
    panel.dataset.height = String(height);
  }
  if (!record.maximized) {
    const currentBounds = {
      left: Number.parseFloat(panel.dataset.x) || panel.offsetLeft || 0,
      top: Number.parseFloat(panel.dataset.y) || panel.offsetTop || 0,
      width: Number.parseFloat(panel.dataset.width) || panel.offsetWidth || 0,
      height: Number.parseFloat(panel.dataset.height) || panel.offsetHeight || 0,
    };
    record.restoreBounds = currentBounds;
  }
  record.maximized = false;
  panel.dataset.maximized = 'false';
  if (record.taskbarButton) {
    record.taskbarButton.disabled = true;
  }
  if (activeWindowId === id) {
    updateTaskbarActiveState(null);
  } else {
    updateTaskbarActiveState(activeWindowId);
  }
  updateWindowControlIcons(panel);
  updateStartMenuWindowList();
}

function toggleMaximizeWindow(id) {
  const record = windowRegistry.get(id);
  if (!record) {
    return;
  }

  if (!shouldEnableWindowMode()) {
    const isMaximized = record.element.dataset.maximized === 'true';
    const nextState = !isMaximized;
    record.maximized = nextState;
    record.element.dataset.maximized = nextState ? 'true' : 'false';
    record.element.classList.toggle('mobile-maximized', nextState);
    if (nextState) {
      bringToFront(record.element);
    }
    updateWindowControlIcons(record.element);
    updateTaskbarActiveState(id);
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
  updateWindowControlIcons(record.element);
  bringToFront(record.element);
  updateTaskbarActiveState(id);
}

function getOpenWindowRecords() {
  return Array.from(windowRegistry.values()).filter((record) => record.state === 'open');
}

function cascadeWindows() {
  if (!appFrame || !shouldEnableWindowMode()) {
    return;
  }
  initializeWindowSystem();
  const openWindows = getOpenWindowRecords();
  if (!openWindows.length) {
    return;
  }
  const frameRect = appFrame.getBoundingClientRect();
  const stepX = 36;
  const stepY = 30;
  const baseLeft = 32;
  const baseTop = 40;
  openWindows.forEach((record, index) => {
    const panel = record.element;
    if (!panel) return;
    const minWidth = Number(panel.dataset.minWidth) || 320;
    const minHeight = Number(panel.dataset.minHeight) || 260;
    const width = Math.max(minWidth, Math.min(frameRect.width - baseLeft, Number(panel.dataset.width) || panel.offsetWidth));
    const height = Math.max(minHeight, Math.min(frameRect.height - baseTop, Number(panel.dataset.height) || panel.offsetHeight));
    const left = clamp(baseLeft + stepX * index, 0, Math.max(0, frameRect.width - width));
    const top = clamp(baseTop + stepY * index, 0, Math.max(0, frameRect.height - height));
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.dataset.width = String(width);
    panel.dataset.height = String(height);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.dataset.x = String(left);
    panel.dataset.y = String(top);
    panel.dataset.maximized = 'false';
    record.maximized = false;
    record.state = 'open';
  });
  updateTaskbarActiveState(activeWindowId);
}

function tileWindows() {
  if (!appFrame || !shouldEnableWindowMode()) {
    return;
  }
  initializeWindowSystem();
  const openWindows = getOpenWindowRecords();
  if (!openWindows.length) {
    return;
  }
  const frameRect = appFrame.getBoundingClientRect();
  const total = openWindows.length;
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / columns));
  const cellWidth = frameRect.width / columns;
  const cellHeight = frameRect.height / rows;
  openWindows.forEach((record, index) => {
    const panel = record.element;
    if (!panel) return;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const minWidth = Number(panel.dataset.minWidth) || 320;
    const minHeight = Number(panel.dataset.minHeight) || 260;
    const width = Math.max(minWidth, Math.min(cellWidth - 20, frameRect.width));
    const height = Math.max(minHeight, Math.min(cellHeight - 24, frameRect.height));
    const left = clamp(col * cellWidth + (cellWidth - width) / 2, 0, Math.max(0, frameRect.width - width));
    const top = clamp(row * cellHeight + (cellHeight - height) / 2, 0, Math.max(0, frameRect.height - height));
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.dataset.width = String(width);
    panel.dataset.height = String(height);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.dataset.x = String(left);
    panel.dataset.y = String(top);
    panel.dataset.maximized = 'false';
    record.maximized = false;
    record.state = 'open';
    constrainPanelToFrame(panel, frameRect);
  });
  updateTaskbarActiveState(activeWindowId);
}

function toggleWindowFromTaskbar(id) {
  const record = windowRegistry.get(id);
  if (!record) return;
  if (record.state === 'open') {
    if (activeWindowId === id) {
      minimizeWindow(id);
    } else {
      bringToFront(record.element);
      updateTaskbarActiveState(id);
    }
  } else {
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

function getPipePalette() {
  const defaults = ['#0f71c7', '#8ff0ff', '#f2ff9a'];
  return [getCSSVar('--pipes-a'), getCSSVar('--pipes-b'), getCSSVar('--pipes-c')].map(
    (color, index) => color || defaults[index]
  );
}

function getScreensaverTrailColor() {
  return getCSSVar('--screensaver-trail') || 'rgba(0, 0, 0, 0.22)';
}

function initializeScreensaver() {
  if (!pipesCanvas || !screensaverOverlay) return;
  const ctx = pipesCanvas.getContext('2d');
  if (!ctx) return;
  screensaverState.ctx = ctx;
  screensaverState.cameraAngle = 0;
  screensaverState.cameraPitch = 0.22;
  screensaverState.cameraPitchPhase = Math.random() * Math.PI * 2;
  screensaverState.rotationSpeed = 0.24;
  screensaverState.trailColor = getScreensaverTrailColor();
  resizeScreensaverCanvas();
  window.addEventListener('resize', resizeScreensaverCanvas);
  ['mousemove', 'pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((eventName) => {
    document.addEventListener(eventName, handleScreensaverActivity, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      deactivateScreensaverMode();
    }
    resetScreensaverTimer();
  });
  screensaverOverlay.addEventListener('click', deactivateScreensaverMode);
  resetScreensaverTimer();
}

function resizeScreensaverCanvas() {
  if (!screensaverOverlay || !pipesCanvas || !screensaverState.ctx) return;
  const rect = screensaverOverlay.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(240, Math.floor(rect.height));
  pipesCanvas.width = width * dpr;
  pipesCanvas.height = height * dpr;
  pipesCanvas.style.width = `${width}px`;
  pipesCanvas.style.height = `${height}px`;
  screensaverState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  screensaverState.width = width;
  screensaverState.height = height;
}

function handleScreensaverActivity() {
  if (screensaverState.active) {
    deactivateScreensaverMode();
  }
  resetScreensaverTimer();
}

function resetScreensaverTimer() {
  if (screensaverState.inactivityTimer) {
    window.clearTimeout(screensaverState.inactivityTimer);
  }
  screensaverState.inactivityTimer = window.setTimeout(() => {
    activateScreensaverMode();
  }, SCREENSAVER_INACTIVITY_MS);
}

function activateScreensaverMode() {
  if (!screensaverOverlay || !screensaverState.ctx) return;
  if (screensaverState.active) return;
  screensaverOverlay.classList.add('active');
  screensaverOverlay.setAttribute('aria-hidden', 'false');
  screensaverState.trailColor = getScreensaverTrailColor();
  screensaverState.cameraAngle = Math.random() * Math.PI * 2;
  screensaverState.cameraPitchPhase = Math.random() * Math.PI * 2;
  screensaverState.cameraPitch = 0.18 + Math.random() * 0.16;
  screensaverState.rotationSpeed = 0.22 + Math.random() * 0.08;
  const initialLightAngle = screensaverState.cameraAngle * 0.85;
  screensaverState.lightDirection = {
    x: Math.cos(initialLightAngle) * 0.6,
    y: 0.55,
    z: Math.sin(initialLightAngle) * 0.6 + 0.4,
  };
  spawnScreensaverPipes();
  screensaverState.active = true;
  screensaverState.lastTimestamp = performance.now();
  screensaverLoop(screensaverState.lastTimestamp);
}

function deactivateScreensaverMode() {
  if (!screensaverState.active) return;
  screensaverState.active = false;
  screensaverOverlay.classList.remove('active');
  screensaverOverlay.setAttribute('aria-hidden', 'true');
  if (screensaverState.animationId) {
    window.cancelAnimationFrame(screensaverState.animationId);
    screensaverState.animationId = null;
  }
  screensaverState.cameraAngle = 0;
  screensaverState.cameraPitch = 0.22;
  screensaverState.cameraPitchPhase = Math.random() * Math.PI * 2;
  screensaverState.lightDirection = { x: 0.35, y: 0.55, z: 0.72 };
  resetScreensaverTimer();
}

function spawnScreensaverPipes() {
  const palette = getPipePalette();
  const pipeCount = Math.max(3, palette.length);
  screensaverState.pipes = [];
  for (let index = 0; index < pipeCount; index += 1) {
    const startColor = palette[index % palette.length];
    const endColor = palette[(index + 1) % palette.length];
    screensaverState.pipes.push(createPipe(startColor, endColor));
  }
}

function createPipe(startColor, endColor) {
  const startPoint = {
    x: Math.random() * 1.2 - 0.6,
    y: Math.random() * 1.2 - 0.6,
    z: Math.random() * 1.2 - 0.6,
  };
  const pipe = {
    points: [startPoint],
    direction: PIPE_DIRECTIONS[Math.floor(Math.random() * PIPE_DIRECTIONS.length)],
    progress: Math.random() * PIPE_SEGMENT_LENGTH,
    speed: 0.45 + Math.random() * 0.35,
    colors: [startColor, endColor],
  };
  const seedSegments = 42 + Math.floor(Math.random() * 24);
  for (let i = 0; i < seedSegments; i += 1) {
    extendPipe(pipe, i > 4);
  }
  return pipe;
}

function chooseNextDirection(current) {
  if (Math.random() < 0.55) {
    return current;
  }
  const choices = PIPE_DIRECTIONS.filter(
    (dir) => !(dir.x === -current.x && dir.y === -current.y && dir.z === -current.z)
  );
  return choices[Math.floor(Math.random() * choices.length)] || current;
}

function advanceScreensaverPipes(delta) {
  screensaverState.pipes.forEach((pipe) => {
    pipe.progress += delta * pipe.speed;
    while (pipe.progress >= PIPE_SEGMENT_LENGTH) {
      pipe.progress -= PIPE_SEGMENT_LENGTH;
      extendPipe(pipe, true);
    }
  });
}

function extendPipe(pipe, allowTurn = true) {
  const bounds = 1.1;
  const lastPoint = pipe.points[pipe.points.length - 1];
  let nextDirection = pipe.direction;
  let nextPoint = {
    x: lastPoint.x + nextDirection.x * PIPE_SEGMENT_LENGTH,
    y: lastPoint.y + nextDirection.y * PIPE_SEGMENT_LENGTH,
    z: lastPoint.z + nextDirection.z * PIPE_SEGMENT_LENGTH,
  };

  if (
    Math.abs(nextPoint.x) > bounds ||
    Math.abs(nextPoint.y) > bounds ||
    Math.abs(nextPoint.z) > bounds
  ) {
    nextDirection = chooseNextDirection(nextDirection);
    nextPoint = {
      x: clamp(lastPoint.x + nextDirection.x * PIPE_SEGMENT_LENGTH, -1, 1),
      y: clamp(lastPoint.y + nextDirection.y * PIPE_SEGMENT_LENGTH, -1, 1),
      z: clamp(lastPoint.z + nextDirection.z * PIPE_SEGMENT_LENGTH, -1, 1),
    };
  }

  pipe.direction = nextDirection;
  pipe.points.push(nextPoint);
  if (pipe.points.length > PIPE_MAX_POINTS) {
    pipe.points.shift();
  }

  if (allowTurn && Math.random() < PIPE_TURN_PROBABILITY) {
    pipe.direction = chooseNextDirection(pipe.direction);
  }
}

function projectPoint(point) {
  const angle = screensaverState.cameraAngle || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const xRot = point.x * cos - point.z * sin;
  const zRot = point.x * sin + point.z * cos;
  const pitch = screensaverState.cameraPitch || 0;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const yRot = point.y * cosPitch - zRot * sinPitch;
  const depthRot = point.y * sinPitch + zRot * cosPitch;
  const depthScale = 0.72;
  const perspective = 3.6;
  const scale = perspective / (perspective - depthRot * depthScale);
  const x = screensaverState.width / 2 + xRot * scale * (screensaverState.width * 0.26);
  const y = screensaverState.height / 2 - yRot * scale * (screensaverState.height * 0.26);
  return { x, y, scale, depth: depthRot };
}

function drawScreensaverFrame() {
  if (!screensaverState.ctx) return;
  const ctx = screensaverState.ctx;
  const { width, height } = screensaverState;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = screensaverState.trailColor || 'rgba(0, 0, 0, 0.24)';
  ctx.fillRect(0, 0, width, height);
  const palette = getPipePalette();
  const light = screensaverState.lightDirection || { x: 0.35, y: 0.55, z: 0.72 };
  const lightLength = Math.hypot(light.x, light.y, light.z) || 1;
  const segments = [];
  screensaverState.pipes.forEach((pipe, index) => {
    const startColor = palette[index % palette.length] || pipe.colors[0];
    const endColor = palette[(index + 1) % palette.length] || pipe.colors[1];
    for (let i = 0; i < pipe.points.length - 1; i += 1) {
      const startPoint = pipe.points[i];
      const endPoint = pipe.points[i + 1];
      const start = projectPoint(startPoint);
      const end = projectPoint(endPoint);
      const direction = {
        x: endPoint.x - startPoint.x,
        y: endPoint.y - startPoint.y,
        z: endPoint.z - startPoint.z,
      };
      const dirLength = Math.hypot(direction.x, direction.y, direction.z) || 1;
      const lightDot =
        (direction.x * light.x + direction.y * light.y + direction.z * light.z) /
        (dirLength * lightLength);
      const highlight = clamp((lightDot + 1) / 2, 0, 1);
      const thickness = Math.max(4, 16 * ((start.scale + end.scale) / 2));
      const dx2d = end.x - start.x;
      const dy2d = end.y - start.y;
      const len2d = Math.hypot(dx2d, dy2d) || 1;
      const nx = (-dy2d / len2d) * (thickness * 0.24);
      const ny = (dx2d / len2d) * (thickness * 0.24);
      segments.push({
        start,
        end,
        startColor,
        endColor,
        highlight,
        thickness,
        nx,
        ny,
        depth: (start.depth + end.depth) / 2,
      });
    }
  });

  segments.sort((a, b) => a.depth - b.depth);

  segments.forEach((segment) => {
    const { start, end, startColor, endColor, highlight, thickness, nx, ny } = segment;
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    const midBlend = blendColors(startColor, endColor, 0.5);
    gradient.addColorStop(0, lightenColor(startColor, 0.25 + highlight * 0.25));
    gradient.addColorStop(0.45, lightenColor(midBlend, 0.18 + highlight * 0.12));
    gradient.addColorStop(1, darkenColor(endColor, 0.2 + (1 - highlight) * 0.25));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = gradient;
    ctx.lineWidth = thickness;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
    ctx.shadowBlur = Math.max(6, thickness * 0.6);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = clamp(0.42 + highlight * 0.38, 0.42, 0.88);
    ctx.strokeStyle = lightenColor(startColor, 0.6 + highlight * 0.25);
    ctx.lineWidth = thickness * 0.45;
    ctx.beginPath();
    ctx.moveTo(start.x + nx, start.y + ny);
    ctx.lineTo(end.x + nx, end.y + ny);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = lightenColor(startColor, 0.32 + highlight * 0.28);
    ctx.beginPath();
    ctx.arc(start.x, start.y, thickness / 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = lightenColor(endColor, 0.4 + highlight * 0.3);
    ctx.beginPath();
    ctx.arc(end.x, end.y, thickness / 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function screensaverLoop(timestamp) {
  if (!screensaverState.active) return;
  const delta = (timestamp - screensaverState.lastTimestamp) / 1000;
  screensaverState.lastTimestamp = timestamp;
  const clampedDelta = Math.min(delta, 0.06);
  advanceScreensaverPipes(clampedDelta);
  screensaverState.cameraAngle += clampedDelta * screensaverState.rotationSpeed;
  screensaverState.cameraPitchPhase += clampedDelta * 0.55;
  screensaverState.cameraPitch = 0.2 + Math.sin(screensaverState.cameraPitchPhase) * 0.12;
  const lightAngle = screensaverState.cameraAngle * 0.85;
  const lightRise = 0.5 + Math.sin(screensaverState.cameraPitchPhase * 0.6) * 0.25;
  screensaverState.lightDirection = {
    x: Math.cos(lightAngle) * 0.6,
    y: lightRise,
    z: Math.sin(lightAngle) * 0.6 + 0.4,
  };
  drawScreensaverFrame();
  screensaverState.animationId = window.requestAnimationFrame(screensaverLoop);
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
  if (!panel) return;
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
      updateWindowControlIcons(panel);
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
    if (event.target.closest('.window-controls')) {
      return;
    }
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

  handle.addEventListener('dblclick', (event) => {
    if (event.target.closest('.window-controls')) {
      return;
    }
    if (!shouldEnableWindowMode()) {
      return;
    }
    const windowId = panel.dataset.windowId;
    if (!windowId) return;
    event.preventDefault();
    toggleMaximizeWindow(windowId);
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
        panel.addEventListener('pointerdown', (event) => {
          if (event.target.closest('.window-controls')) {
            return;
          }
          bringToFront(panel);
        });
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

  updateAllWindowControlIcons();
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
  renderFinalShowcase();
  renderInsights();
  scheduleStateSave();
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
  renderSummary();
  renderFutureForecast();
  renderFinalShowcase();
  renderInsights();
  scheduleStateSave();
  return updatedCategory;
}

function updateCategoryNotes(id, notes) {
  state.categories = state.categories.map((category) =>
    category.id === id ? { ...category, notes } : category
  );
  renderFinalShowcase();
  renderInsights();
  scheduleStateSave();
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

function resetToStarterBlueprint() {
  state.categories = createRecommendedCategories(state.weeklyIncome);
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
  changeScope(newScope);
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
    const activateScreensaver = button.hasAttribute('data-activate-screensaver');
    const resetBudget = button.hasAttribute('data-reset-budget');
    const action = button.dataset.action;
    if (windowId) {
      openWindow(windowId);
      if (windowId === 'snake') {
        drawSnakeFrame();
      }
      closeStartMenu();
    } else if (resetBudget) {
      resetToStarterBlueprint();
      closeStartMenu();
    } else if (theme) {
      state.autoThemeCycle = false;
      syncAutoThemeToggle();
      applyTheme(theme);
      closeStartMenu();
      scheduleStateSave();
    } else if (activateScreensaver) {
      closeStartMenu();
      activateScreensaverMode();
    } else if (action === 'cascade-windows') {
      cascadeWindows();
      closeStartMenu();
    } else if (action === 'tile-windows') {
      tileWindows();
      closeStartMenu();
    } else if (action === 'toggle-focus') {
      setFocusMode(!focusModeEnabled);
      closeStartMenu();
    }
  });
}

if (mapperParseBtn) {
  mapperParseBtn.addEventListener('click', () => {
    if (spendingImportState.busy) return;
    const text = mapperManualInput?.value || '';
    const entries = parseManualSpending(text);
    if (entries.length) {
      addImportEntries(entries, 'manual entry');
    } else {
      updateMapperStatus('No recognizable lines were found. Try “Groceries - 125 - weekly”.', 'error');
    }
  });
}

if (mapperClearBtn) {
  mapperClearBtn.addEventListener('click', () => {
    if (spendingImportState.busy) return;
    clearImportEntries();
  });
}

if (mapperApplyAllBtn) {
  mapperApplyAllBtn.addEventListener('click', () => {
    if (spendingImportState.busy) return;
    applyAllImportEntries();
  });
}

if (mapperResultsBody) {
  mapperResultsBody.addEventListener('change', (event) => {
    if (spendingImportState.busy) return;
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      const entryId = target.dataset.entryId;
      if (!entryId) return;
      const entry = spendingImportState.entries.find((item) => item.id === entryId);
      if (!entry) return;
      if (target.classList.contains('mapper-frequency')) {
        entry.frequency = sanitizeFrequency(target.value);
        renderMapperEntries();
      } else if (target.classList.contains('mapper-target')) {
        entry.targetId = target.value;
      }
    }
  });

  mapperResultsBody.addEventListener('click', (event) => {
    const button = event.target.closest('.mapper-apply');
    if (!button || spendingImportState.busy) return;
    const entryId = button.dataset.entryId;
    if (entryId) {
      applyImportEntry(entryId);
    }
  });
}

if (mapperAnalyzeBtn) {
  mapperAnalyzeBtn.addEventListener('click', async () => {
    if (spendingImportState.busy) return;
    try {
      setMapperBusy(true);
      updateMapperStatus('Contacting OpenAI for analysis…');
      const files = Array.from(mapperFileInput?.files || []);
      const apiKey = mapperApiKeyInput?.value?.trim();
      const entries = await analyzeStatementWithAI(files, apiKey);
      setMapperBusy(false);
      if (mapperRememberToggle) {
        if (mapperRememberToggle.checked && apiKey) {
          persistMapperKey(apiKey);
        } else if (!mapperRememberToggle.checked) {
          persistMapperKey('');
        }
      }
      if (entries.length) {
        addImportEntries(entries, 'AI analysis');
      } else {
        updateMapperStatus('OpenAI did not detect recurring categories in those statements.', 'error');
      }
    } catch (error) {
      setMapperBusy(false);
      updateMapperStatus(error.message, 'error');
      if (mapperAiNotice) {
        mapperAiNotice.textContent =
          'AI import requires an active internet connection, a valid OpenAI API key, and compatible files (images or PDFs). Manual entry always works offline.';
      }
    }
  });
}

if (mapperRememberToggle) {
  mapperRememberToggle.addEventListener('change', () => {
    if (spendingImportState.busy) {
      return;
    }
    if (mapperRememberToggle.checked) {
      const key = mapperApiKeyInput?.value?.trim();
      if (key) {
        persistMapperKey(key);
      } else {
        mapperRememberToggle.checked = false;
        updateMapperStatus('Enter an API key before enabling “Remember this key”.', 'error');
      }
    } else {
      persistMapperKey('');
    }
  });
}

if (mapperForgetKeyBtn) {
  mapperForgetKeyBtn.addEventListener('click', () => {
    if (spendingImportState.busy) {
      return;
    }
    persistMapperKey('');
    if (mapperApiKeyInput) {
      mapperApiKeyInput.value = '';
    }
    if (mapperRememberToggle) {
      mapperRememberToggle.checked = false;
    }
    updateMapperStatus('Saved API key cleared from this device.');
  });
}

if (mapperApiKeyInput) {
  mapperApiKeyInput.addEventListener('change', () => {
    if (mapperRememberToggle?.checked) {
      const key = mapperApiKeyInput.value.trim();
      if (key) {
        persistMapperKey(key);
      }
    }
  });
}

if (resetBlueprintButton) {
  resetBlueprintButton.addEventListener('click', () => {
    resetToStarterBlueprint();
  });
}

if (autoThemeToggle) {
  autoThemeToggle.addEventListener('change', (event) => {
    state.autoThemeCycle = event.target.checked;
    if (state.autoThemeCycle) {
      startThemeCycle();
    } else {
      stopThemeCycle();
    }
    scheduleStateSave();
  });
}

if (finalOpenTriggers.length) {
  finalOpenTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      openWindow('final');
      renderFinalShowcase();
    });
  });
}

if (finalExportBtn) {
  finalExportBtn.addEventListener('click', () => {
    openWindow('final');
    exportFinalShowcase();
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

  const usingCtrl = event.ctrlKey && !event.altKey;
  if (usingCtrl && !event.metaKey) {
    if (!event.shiftKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      stepScope(-1);
    } else if (!event.shiftKey && event.key === 'ArrowRight') {
      event.preventDefault();
      stepScope(1);
    } else if (event.shiftKey && (event.key === 'F' || event.key === 'f')) {
      event.preventDefault();
      openWindow('final');
      renderFinalShowcase();
    }
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

if ('serviceWorker' in navigator) {
  const isLocalEnvironment =
    location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.endsWith('.local');

  window.addEventListener('load', () => {
    if (isLocalEnvironment) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch((error) => console.warn('Service worker cleanup failed:', error));
    } else {
      navigator.serviceWorker
        .register('./sw.js')
        .catch((error) => console.error('Service worker registration failed:', error));
    }
  });
}
