const weeklyIncomeInput = document.querySelector('#weeklyIncome');
const budgetBody = document.querySelector('#budgetBody');
const scopeChooser = document.querySelector('#scopeChooser');
const incomeSnapshot = document.querySelector('#incomeSnapshot');
const summaryGrid = document.querySelector('#summaryGrid');
const futureGrid = document.querySelector('#futureGrid');
const customForm = document.querySelector('#customCategoryForm');
const rowTemplate = document.querySelector('#rowTemplate');
const desktop = document.querySelector('.app-frame');
const windowPanels = Array.from(document.querySelectorAll('[data-window]'));

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

const MIN_PANEL_WIDTH = 280;
const MIN_PANEL_HEIGHT = 240;
const windowStates = new Map();
let zIndexCounter = 100;
let windowsInitialized = false;

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
  requestAnimationFrame(() => {
    setupWindowSystem();
  });
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getNumeric(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDesktopBounds() {
  if (!desktop) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const rect = desktop.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function activatePanel(panel) {
  windowPanels.forEach((item) => {
    if (item === panel) {
      item.classList.add('window-active');
      zIndexCounter += 1;
      item.style.zIndex = zIndexCounter;
    } else {
      item.classList.remove('window-active');
    }
  });
}

function updatePanelState(panel) {
  const state = windowStates.get(panel) ?? {};
  state.left = getNumeric(panel.style.left, state.left ?? 0);
  state.top = getNumeric(panel.style.top, state.top ?? 0);
  state.width = panel.offsetWidth;
  state.height = panel.offsetHeight;
  windowStates.set(panel, state);
}

function clampPanelToDesktop(panel) {
  const bounds = getDesktopBounds();
  const currentState = windowStates.get(panel) ?? {};
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const maxLeft = Math.max(0, bounds.width - width);
  const maxTop = Math.max(0, bounds.height - height);
  const left = clamp(getNumeric(panel.style.left, currentState.left ?? 0), 0, maxLeft);
  const top = clamp(getNumeric(panel.style.top, currentState.top ?? 0), 0, maxTop);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  updatePanelState(panel);
}

function attachDrag(panel) {
  const handle = panel.querySelector('[data-drag-handle]');
  if (!handle) return;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    activatePanel(panel);
    panel.classList.add('no-transition');
    const panelRect = panel.getBoundingClientRect();
    const offsetX = event.clientX - panelRect.left;
    const offsetY = event.clientY - panelRect.top;

    function handlePointerMove(moveEvent) {
      const bounds = getDesktopBounds();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      let nextLeft = moveEvent.clientX - bounds.left - offsetX;
      let nextTop = moveEvent.clientY - bounds.top - offsetY;
      const maxLeft = Math.max(0, bounds.width - width);
      const maxTop = Math.max(0, bounds.height - height);
      nextLeft = clamp(nextLeft, 0, maxLeft);
      nextTop = clamp(nextTop, 0, maxTop);
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    }

    function handlePointerUp() {
      updatePanelState(panel);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      requestAnimationFrame(() => panel.classList.remove('no-transition'));
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
    try {
      handle.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore
    }
  });
}

function attachResize(panel) {
  const handle = panel.querySelector('[data-resize-handle]');
  if (!handle) return;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    activatePanel(panel);
    panel.classList.add('no-transition');
    const startWidth = panel.offsetWidth;
    const startHeight = panel.offsetHeight;
    const startX = event.clientX;
    const startY = event.clientY;

    function handlePointerMove(moveEvent) {
      const bounds = getDesktopBounds();
      const currentState = windowStates.get(panel) ?? {};
      const left = getNumeric(panel.style.left, currentState.left ?? 0);
      const top = getNumeric(panel.style.top, currentState.top ?? 0);
      const maxWidth = Math.max(MIN_PANEL_WIDTH, bounds.width - left);
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, bounds.height - top);
      let nextWidth = startWidth + (moveEvent.clientX - startX);
      let nextHeight = startHeight + (moveEvent.clientY - startY);
      nextWidth = clamp(nextWidth, MIN_PANEL_WIDTH, maxWidth);
      nextHeight = clamp(nextHeight, MIN_PANEL_HEIGHT, maxHeight);
      panel.style.width = `${nextWidth}px`;
      panel.style.height = `${nextHeight}px`;
    }

    function handlePointerUp() {
      updatePanelState(panel);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      requestAnimationFrame(() => panel.classList.remove('no-transition'));
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
    try {
      handle.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore
    }
  });
}

function setupWindowSystem() {
  if (windowsInitialized || !desktop) return;
  windowsInitialized = true;

  windowPanels.forEach((panel, index) => {
    const defaultLeft = getNumeric(panel.dataset.defaultLeft, 24);
    const defaultTop = getNumeric(panel.dataset.defaultTop, 24 + index * 40);
    const defaultWidth = getNumeric(panel.dataset.defaultWidth, panel.offsetWidth || MIN_PANEL_WIDTH);
    const defaultHeight = getNumeric(panel.dataset.defaultHeight, panel.offsetHeight || MIN_PANEL_HEIGHT);
    const bounds = getDesktopBounds();
    const width = clamp(defaultWidth, MIN_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, bounds.width - defaultLeft));
    const height = clamp(defaultHeight, MIN_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, bounds.height - defaultTop));

    panel.style.left = `${clamp(defaultLeft, 0, Math.max(0, bounds.width - width))}px`;
    panel.style.top = `${clamp(defaultTop, 0, Math.max(0, bounds.height - height))}px`;
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    panel.style.zIndex = zIndexCounter + index;

    windowStates.set(panel, {
      left: getNumeric(panel.style.left, defaultLeft),
      top: getNumeric(panel.style.top, defaultTop),
      width,
      height,
    });

    attachDrag(panel);
    attachResize(panel);
    panel.addEventListener('mousedown', () => activatePanel(panel));
  });

  zIndexCounter += windowPanels.length;
  if (windowPanels.length) {
    activatePanel(windowPanels[windowPanels.length - 1]);
  }

  window.addEventListener('resize', () => {
    windowPanels.forEach((panel) => clampPanelToDesktop(panel));
  });
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
    card.className = 'card';
    const label = document.createElement('span');
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
    card.className = 'card';

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
