const weeklyIncomeInput = document.querySelector('#weeklyIncome');
const budgetBody = document.querySelector('#budgetBody');
const scopeChooser = document.querySelector('#scopeChooser');
const incomeSnapshot = document.querySelector('#incomeSnapshot');
const summaryGrid = document.querySelector('#summaryGrid');
const futureGrid = document.querySelector('#futureGrid');
const customForm = document.querySelector('#customCategoryForm');
const rowTemplate = document.querySelector('#rowTemplate');
const appFrame = document.querySelector('.app-frame');

const scopeFactors = {
  daily: 1 / 7,
  weekly: 1,
  monthly: 4.345,
  yearly: 52,
};

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
};

const WINDOW_MODE_BREAKPOINT = 860;
let highestZIndex = 100;
let windowModeActive = false;

function init() {
  weeklyIncomeInput.value = state.weeklyIncome.toFixed(2);
  state.categories = recommendedBlueprint.map((item, index) => ({
    id: `rec-${index}`,
    ...item,
    weeklyAmount: state.weeklyIncome * item.percent,
    recommended: true,
    customized: false,
  }));
  renderAll();
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
  const fragment = document.createDocumentFragment();

  state.categories.forEach((category) => {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-field="name"]').textContent = category.name;

    const amountInput = row.querySelector('[data-field="amount"]');
    amountInput.value = convertFromWeekly(category.weeklyAmount, state.scope).toFixed(2);
    amountInput.dataset.id = category.id;
    amountInput.dataset.recommended = category.recommended;

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

    constrainPanelToFrame(panel, frameRect);
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

function updateCategoryAmount(id, newValue) {
  state.categories = state.categories.map((category) => {
    if (category.id !== id) return category;
    return {
      ...category,
      weeklyAmount: newValue,
      customized: true,
    };
  });
  renderSummary();
  renderFutureForecast();
}

function updateCategoryNotes(id, notes) {
  state.categories = state.categories.map((category) =>
    category.id === id ? { ...category, notes } : category
  );
}

function addCustomCategory(name, weeklyAmount, notes) {
  state.categories.push({
    id: `custom-${crypto.randomUUID()}`,
    name,
    weeklyAmount,
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
      return {
        ...category,
        weeklyAmount: state.weeklyIncome * category.percent,
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
    const weeklyValue = convertToWeekly(value, state.scope);
    updateCategoryAmount(id, weeklyValue);
  }

  if (target.matches('[data-field="notes"]')) {
    const id = target.dataset.id;
    updateCategoryNotes(id, target.value);
  }
});

budgetBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button || button.disabled) return;

  const id = button.dataset.id;
  state.categories = state.categories.filter((category) => category.id !== id);
  renderAll();
});

weeklyIncomeInput.addEventListener('input', (event) => {
  handleWeeklyIncomeChange(event.target.value);
});

customForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.querySelector('#customName').value.trim();
  const amount = Number.parseFloat(document.querySelector('#customAmount').value);
  const notes = document.querySelector('#customNotes').value.trim();

  if (!name || Number.isNaN(amount) || amount < 0) {
    return;
  }

  addCustomCategory(name, amount, notes);
  customForm.reset();
});

init();
initializeWindowSystem();
window.addEventListener('resize', handleWindowResize);
