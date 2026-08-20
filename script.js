/* =========================================================
   WRONGULATOR — Intentionally Wrong Calculator
   ---------------------------------------------------------
   Every calculation deliberately produces an incorrect
   result. This is entertainment software only.
   ========================================================= */

/* ---------- State ---------- */
let expression = "";       // raw string user is building, e.g. "12+7"
let calculationCount = 0;  // free calculations used
let isSubscribed = false;  // subscription flag (NOT secure — see note below)

/* ---------- DOM refs ---------- */
const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const wrongTagEl = document.getElementById("wrongTag");
const calculatorCard = document.querySelector(".calculator-card");
const historyList = document.getElementById("historyList");

const statusPill = document.getElementById("statusPill");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");

const subModalOverlay = document.getElementById("subModalOverlay");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const monthlyBtn = document.getElementById("monthlyBtn");
const yearlyBtn = document.getElementById("yearlyBtn");
const testSubBtn = document.getElementById("testSubBtn");
const resetUsageBtn = document.getElementById("resetUsageBtn");

/* ---------- Persistence ---------- */
function loadData() {
  calculationCount = parseInt(localStorage.getItem("calculationCount") || "0", 10);
  isSubscribed = localStorage.getItem("isSubscribed") === "true";
}

function saveData() {
  localStorage.setItem("calculationCount", String(calculationCount));
  localStorage.setItem("isSubscribed", String(isSubscribed));
}

/* ---------- UI: status pill / lock state ---------- */
function refreshStatusUI() {
  if (isSubscribed) {
    statusPill.classList.add("premium");
    statusIcon.textContent = "💎";
    statusText.textContent = "Premium — Unlimited Wrong Calculations";
    calculatorCard.classList.remove("locked");
  } else if (calculationCount >= 1) {
    statusPill.classList.remove("premium");
    statusIcon.textContent = "🔒";
    statusText.textContent = "Free calculation used";
    calculatorCard.classList.add("locked");
  } else {
    statusPill.classList.remove("premium");
    statusIcon.textContent = "🔓";
    statusText.textContent = "1 free calculation left";
    calculatorCard.classList.remove("locked");
  }
}

/* ---------- Display helpers ---------- */
function updateExpressionDisplay() {
  expressionEl.textContent = expression || "\u00A0";
}

function updateResultDisplay(value, wasWrong) {
  resultEl.textContent = value;
  resultEl.classList.remove("pop");
  // force reflow so the animation can replay
  void resultEl.offsetWidth;
  resultEl.classList.add("pop");
  wrongTagEl.hidden = !wasWrong;
}

/* ---------- Wrong-answer engine ---------- */

// Evaluate the real expression safely (only digits, . and + - × ÷ %)
function evaluateExpression(expr) {
  const sanitized = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");

  if (!/^[0-9+\-*/.%\s]+$/.test(sanitized)) {
    throw new Error("Invalid expression");
  }
  // eslint-disable-next-line no-new-func
  const value = Function(`"use strict"; return (${sanitized})`)();
  if (typeof value !== "number" || !isFinite(value)) {
    throw new Error("Invalid result");
  }
  return value;
}

// Produce a plausible-looking but definitely wrong number
function generateWrongAnswer(correctResult) {
  let wrong = correctResult;
  let attempts = 0;

  while (wrong === correctResult && attempts < 10) {
    const strategy = Math.floor(Math.random() * 4);
    const magnitude = Math.max(1, Math.abs(correctResult) * 0.15);

    switch (strategy) {
      case 0: // flat random offset
        wrong = correctResult + (Math.floor(Math.random() * 12) + 1) * (Math.random() < 0.5 ? -1 : 1);
        break;
      case 1: // percentage-style skew
        wrong = correctResult + magnitude * (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 2 + 0.5);
        break;
      case 2: // digit swap flavor (round then nudge)
        wrong = Math.round(correctResult) + (Math.floor(Math.random() * 9) + 2);
        break;
      default: // small multiplier drift
        wrong = correctResult * (0.7 + Math.random() * 0.6);
        break;
    }

    // round to a sane number of decimals
    wrong = Math.round(wrong * 100) / 100;
    attempts++;
  }

  // absolute fallback guarantee: never allow equality
  if (wrong === correctResult) {
    wrong = correctResult + 7;
  }

  return wrong;
}

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

/* ---------- History ---------- */
function addHistoryEntry(expr, wrongResult) {
  const emptyMsg = historyList.querySelector(".history-empty");
  if (emptyMsg) emptyMsg.remove();

  const li = document.createElement("li");
  li.innerHTML = `
    <span class="history-expr">${expr} =</span>
    <span class="history-result">${wrongResult}</span>
  `;
  historyList.prepend(li);
}

/* ---------- Modal controls ---------- */
function openSubModal() {
  subModalOverlay.hidden = false;
}

function closeSubModal() {
  subModalOverlay.hidden = true;
}

function activateSubscription() {
  isSubscribed = true;
  saveData();
  refreshStatusUI();
  closeSubModal();
}

/* ---------- Core calculate handler ---------- */
function handleEquals() {
  if (!expression) return;

  // Gate: free calculation already used, not subscribed -> show modal, no calc
  if (!isSubscribed && calculationCount >= 1) {
    openSubModal();
    return;
  }

  let correctResult;
  try {
    correctResult = evaluateExpression(expression);
  } catch (e) {
    updateResultDisplay("Error", false);
    return;
  }

  const wrongResult = generateWrongAnswer(correctResult);
  const displayValue = formatNumber(wrongResult);

  updateResultDisplay(displayValue, true);
  addHistoryEntry(expression, displayValue);

  if (!isSubscribed) {
    calculationCount++;
    saveData();
  }

  expression = "";
  updateExpressionDisplay();
  refreshStatusUI();
}

/* ---------- Keypad input handling ---------- */
function handleNumberInput(num) {
  if (!isSubscribed && calculationCount >= 1) {
    openSubModal();
    return;
  }
  expression += num;
  updateExpressionDisplay();
}

function handleOperatorInput(op) {
  if (!isSubscribed && calculationCount >= 1) {
    openSubModal();
    return;
  }
  if (expression === "" && op !== "-") return; // no leading operator except minus
  expression += op;
  updateExpressionDisplay();
}

function handlePercent() {
  if (!isSubscribed && calculationCount >= 1) {
    openSubModal();
    return;
  }
  expression += "%";
  // convert % to /100 style handling at evaluation time
  updateExpressionDisplay();
}

function handleClear() {
  expression = "";
  updateExpressionDisplay();
  updateResultDisplay("0", false);
}

function handleDelete() {
  expression = expression.slice(0, -1);
  updateExpressionDisplay();
}

/* Support "%" as "value/100" when evaluating */
const originalEvaluate = evaluateExpression;
function evaluateExpressionWithPercent(expr) {
  // turn "20%" trailing or inline percent into (20/100)
  const withPercent = expr.replace(/(\d+(\.\d+)?)%/g, "($1/100)");
  return originalEvaluate(withPercent);
}
// Override reference used inside handleEquals
// (kept simple: reassign the function used above)
// eslint-disable-next-line no-func-assign
evaluateExpression = evaluateExpressionWithPercent;

/* ---------- Event wiring ---------- */
document.querySelectorAll(".key[data-num]").forEach((btn) => {
  btn.addEventListener("click", () => handleNumberInput(btn.dataset.num));
});

document.querySelectorAll(".key[data-op]").forEach((btn) => {
  btn.addEventListener("click", () => handleOperatorInput(btn.dataset.op));
});

document.querySelector('[data-action="equals"]').addEventListener("click", handleEquals);
document.querySelector('[data-action="clear"]').addEventListener("click", handleClear);
document.querySelector('[data-action="delete"]').addEventListener("click", handleDelete);
document.querySelector('[data-action="percent"]').addEventListener("click", handlePercent);

modalCloseBtn.addEventListener("click", closeSubModal);
subModalOverlay.addEventListener("click", (e) => {
  if (e.target === subModalOverlay) closeSubModal();
});

/* ---------------------------------------------------------
   PRODUCTION PAYMENT INTEGRATION NOTE:
   The two buttons below (Monthly / Yearly) are placeholders.
   In production, replace the click handlers with a call to
   your real payment provider's checkout flow (e.g. Razorpay,
   Stripe, etc.), and only set `isSubscribed = true` after
   your BACKEND confirms a successful, verified payment via
   webhook/callback — never trust localStorage alone as proof
   of subscription. localStorage is client-side and can be
   edited by anyone; treat it as a UI convenience/cache only,
   with the source of truth living server-side.
   --------------------------------------------------------- */
monthlyBtn.addEventListener("click", () => {
  // TODO: integrate real payment provider checkout (Monthly ₹99)
  alert("Payment integration not yet connected. Use 'Test Subscription' for development.");
});

yearlyBtn.addEventListener("click", () => {
  // TODO: integrate real payment provider checkout (Yearly ₹799)
  alert("Payment integration not yet connected. Use 'Test Subscription' for development.");
});

testSubBtn.addEventListener("click", () => {
  activateSubscription();
});

resetUsageBtn.addEventListener("click", () => {
  calculationCount = 0;
  isSubscribed = false;
  localStorage.removeItem("calculationCount");
  localStorage.removeItem("isSubscribed");
  refreshStatusUI();
  closeSubModal();
  handleClear();
});

/* ---------- Keyboard support ---------- */
document.addEventListener("keydown", (e) => {
  if (/^[0-9.]$/.test(e.key)) {
    handleNumberInput(e.key);
  } else if (["+", "-"].includes(e.key)) {
    handleOperatorInput(e.key);
  } else if (e.key === "*") {
    handleOperatorInput("×");
  } else if (e.key === "/") {
    e.preventDefault();
    handleOperatorInput("÷");
  } else if (e.key === "Enter" || e.key === "=") {
    handleEquals();
  } else if (e.key === "Backspace") {
    handleDelete();
  } else if (e.key === "Escape") {
    handleClear();
    closeSubModal();
  }
});

/* ---------- Init ---------- */
loadData();
refreshStatusUI();
updateExpressionDisplay();