import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove, set } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js"

/* ---- FIREBASE CONFIG ---- */
const appSettings = {
    databaseURL: "https://finia-app-a26f6-default-rtdb.asia-southeast1.firebasedatabase.app/"
}

const app = initializeApp(appSettings)
const database = getDatabase(app)

const transactionsRef = ref(database, "finia/transactions")
const budgetsRef = ref(database, "finia/budgets")
const categoriesRef = ref(database, "finia/categories")

/* ---- DEFAULTS & MAPS ---- */
const DEFAULT_CATEGORIES = [
    "Food & Dining", "Transport", "Shopping",
    "Bills & Utilities", "Entertainment", "Health", "Education", "Other"
]

const SMART_KEYWORD_MAP = {
    "food": "Food & Dining", "lunch": "Food & Dining", "dinner": "Food & Dining",
    "breakfast": "Food & Dining", "coffee": "Food & Dining", "cafe": "Food & Dining",
    "uber": "Transport", "bus": "Transport", "train": "Transport", "taxi": "Transport",
    "groceries": "Shopping", "amazon": "Shopping", "clothes": "Shopping",
    "rent": "Bills & Utilities", "electricity": "Bills & Utilities", "wifi": "Bills & Utilities",
    "movie": "Entertainment", "netflix": "Entertainment", "game": "Entertainment"
}

/* ---- STATE ---- */
let currency = localStorage.getItem("finia_currency") || "¥"
let transactions = {}
let budgets = {}
let categories = []
let previousBalance = null
let isFirstLoad = true
let previousCategoriesJSON = ""

/* ---- ELEMENTS ---- */
const currencyTag = document.getElementById("currencyTag")
const balanceAmount = document.getElementById("balanceAmount")
const totalIncome = document.getElementById("totalIncome")
const totalExpenses = document.getElementById("totalExpenses")

const expenseDescInput = document.getElementById("expenseDescInput")
const expenseAmountInput = document.getElementById("expenseAmountInput")
const expenseCategorySelect = document.getElementById("expenseCategorySelect")
const addExpenseBtn = document.getElementById("addExpenseBtn")
const expenseFormMsg = document.getElementById("expenseFormMsg")

const incomeDescInput = document.getElementById("incomeDescInput")
const incomeAmountInput = document.getElementById("incomeAmountInput")
const incomeCategorySelect = document.getElementById("incomeCategorySelect")
const addIncomeBtn = document.getElementById("addIncomeBtn")
const incomeFormMsg = document.getElementById("incomeFormMsg")

const transactionList = document.getElementById("transactionList")
const filterType = document.getElementById("filterType")
const filterCategory = document.getElementById("filterCategory")
const exportBtn = document.getElementById("exportBtn")

const budgetList = document.getElementById("budgetList")
const budgetCategorySelect = document.getElementById("budgetCategorySelect")
const budgetAmountInput = document.getElementById("budgetAmount")
const setBudgetBtn = document.getElementById("setBudgetBtn")
const budgetAlerts = document.getElementById("budgetAlerts")

const settingsBtn = document.getElementById("settingsBtn")
const settingsModal = document.getElementById("settingsModal")
const closeSettings = document.getElementById("closeSettings")
const categoryList = document.getElementById("categoryList")
const newCategoryInput = document.getElementById("newCategoryInput")
const addCategoryBtn = document.getElementById("addCategoryBtn")
const saveCurrencyBtn = document.getElementById("saveCurrencyBtn")
const resetBtn = document.getElementById("resetBtn")

/* ---- INIT ---- */
currencyTag.textContent = currency
initCategoryListener()
initDataListeners()

/* ---- FIREBASE LISTENERS ---- */
function initDataListeners() {
    onValue(transactionsRef, snapshot => {
        transactions = snapshot.exists() ? snapshot.val() : {}
        isFirstLoad = false
        renderAll()
    })

    onValue(budgetsRef, snapshot => {
        budgets = snapshot.exists() ? snapshot.val() : {}
        renderBudgets()
        renderBudgetAlerts()
    })
}

function initCategoryListener() {
    onValue(categoriesRef, snapshot => {
        const rawCategories = snapshot.exists() ? snapshot.val() : [...DEFAULT_CATEGORIES]
        const currentCategoriesJSON = JSON.stringify(rawCategories)

        if (currentCategoriesJSON !== previousCategoriesJSON) {
            categories = rawCategories
            previousCategoriesJSON = currentCategoriesJSON
            if (!snapshot.exists()) set(categoriesRef, categories)
            renderCategoryDropdowns()
            renderCategoryList()
        }
    }, error => {
        console.error("Firebase Read Error:", error)
        categories = [...DEFAULT_CATEGORIES]
        renderCategoryDropdowns()
    })
}

/* ---- PRESET QUICK CHIPS ---- */
document.querySelectorAll(".preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        expenseDescInput.value = chip.dataset.desc
        if (categories.includes(chip.dataset.cat)) {
            expenseCategorySelect.value = chip.dataset.cat
        }
        expenseAmountInput.focus()
    })
})

/* ---- SMART KEYWORD MATCHING ---- */
expenseDescInput.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase().trim()
    for (const [keyword, cat] of Object.entries(SMART_KEYWORD_MAP)) {
        if (val.includes(keyword) && categories.includes(cat)) {
            expenseCategorySelect.value = cat
            break
        }
    }
})

/* ---- ADD EXPENSE ---- */
addExpenseBtn.addEventListener("click", () => {
    const desc = expenseDescInput.value.trim()
    const amount = parseFloat(expenseAmountInput.value)
    const category = expenseCategorySelect.value

    if (!desc) return showMsg(expenseFormMsg, "Please enter what you spent on", "error")
    if (!amount || amount <= 0) return showMsg(expenseFormMsg, "Please enter a valid amount", "error")

    push(transactionsRef, {
        type: "expense",
        description: desc,
        amount: amount,
        category: category || "Other",
        date: new Date().toISOString().split("T")[0]
    })

    expenseDescInput.value = ""
    expenseAmountInput.value = ""
    showMsg(expenseFormMsg, "Expense logged!", "success")
})

/* ---- ADD INCOME ---- */
addIncomeBtn.addEventListener("click", () => {
    const desc = incomeDescInput.value.trim()
    const amount = parseFloat(incomeAmountInput.value)
    const category = incomeCategorySelect.value

    if (!desc) return showMsg(incomeFormMsg, "Please enter an income description", "error")
    if (!amount || amount <= 0) return showMsg(incomeFormMsg, "Please enter a valid amount", "error")

    push(transactionsRef, {
        type: "income",
        description: desc,
        amount: amount,
        category: category,
        date: new Date().toISOString().split("T")[0]
    })

    incomeDescInput.value = ""
    incomeAmountInput.value = ""
    showMsg(incomeFormMsg, "Income added!", "success")
})

function showMsg(el, text, type) {
    el.textContent = text
    el.className = `form-msg ${type}`
    setTimeout(() => { el.textContent = "" }, 2500)
}

/* ---- RENDER LOGIC ---- */
function renderAll() {
    renderTransactions()
    renderBalance()
    renderBudgets()
    renderBudgetAlerts()
}

function renderTransactions() {
    const typeFilter = filterType.value
    const catFilter = filterCategory.value

    let items = Object.entries(transactions)

    if (typeFilter !== "all") items = items.filter(([, t]) => t.type === typeFilter)
    if (catFilter !== "all") items = items.filter(([, t]) => t.category === catFilter)

    items.sort((a, b) => new Date(b[1].date) - new Date(a[1].date))

    if (!items.length) {
        transactionList.innerHTML = `<li class="empty-state">No transactions found.</li>`
        return
    }

    transactionList.innerHTML = ""
    items.forEach(([id, t]) => {
        const li = document.createElement("li")
        li.className = "transaction-item"
        li.innerHTML = `
            <div class="txn-icon ${t.type}">${t.type === "income" ? "↑" : "↓"}</div>
            <div class="txn-info">
                <div class="txn-desc">${escapeHTML(t.description)}</div>
                <div class="txn-meta">${t.category} · ${formatDate(t.date)}</div>
            </div>
            <div class="txn-amount ${t.type}">${t.type === "income" ? "+" : "-"}${currency}${t.amount.toFixed(2)}</div>
            <span class="txn-delete">✕</span>
        `
        li.querySelector(".txn-delete").addEventListener("click", (e) => {
            e.stopPropagation()
            remove(ref(database, `finia/transactions/${id}`))
        })
        transactionList.append(li)
    })
}

function renderBalance() {
    let income = 0, expenses = 0
    Object.values(transactions).forEach(t => {
        if (t.type === "income") income += t.amount
        else expenses += t.amount
    })

    const balance = income - expenses
    previousBalance = balance

    balanceAmount.textContent = balance < 0
        ? `-${currency}${Math.abs(balance).toFixed(2)}`
        : `${currency}${balance.toFixed(2)}`

    balanceAmount.className = "balance-amount " + (balance < 0 ? "negative" : balance > 0 ? "positive" : "")
    totalIncome.textContent = `${currency}${income.toFixed(2)}`
    totalExpenses.textContent = `${currency}${expenses.toFixed(2)}`
}

function renderBudgets() {
    if (!Object.keys(budgets).length) {
        budgetList.innerHTML = `<p style="color:var(--brown-light);font-size:13px;">No budgets configured.</p>`
        return
    }

    budgetList.innerHTML = ""
    Object.entries(budgets).forEach(([category, limit]) => {
        const spent = getCategorySpending(category)
        const pct = Math.min((spent / limit) * 100, 100)
        const fillClass = pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok"

        const div = document.createElement("div")
        div.className = "budget-item"
        div.innerHTML = `
            <div class="budget-item-header">
                <span class="budget-item-name">${escapeHTML(category)}</span>
                <span class="budget-item-amounts">${currency}${spent.toFixed(2)} / ${currency}${limit.toFixed(2)}</span>
            </div>
            <div class="budget-bar-bg">
                <div class="budget-bar-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
        `
        budgetList.append(div)
    })
}

function renderBudgetAlerts() {
    budgetAlerts.innerHTML = ""
    Object.entries(budgets).forEach(([category, limit]) => {
        const spent = getCategorySpending(category)
        const ratio = spent / limit

        if (ratio >= 1) {
            const div = document.createElement("div")
            div.className = "alert exceeded"
            div.textContent = `⚠️ Exceeded ${category} budget! (${currency}${spent.toFixed(2)} / ${currency}${limit.toFixed(2)})`
            budgetAlerts.append(div)
        } else if (ratio >= 0.8) {
            const div = document.createElement("div")
            div.className = "alert warning"
            div.textContent = `⚡ Approaching ${category} budget limit (${currency}${spent.toFixed(2)} spent)`
            budgetAlerts.append(div)
        }
    })
}

function getCategorySpending(category) {
    const now = new Date()
    return Object.values(transactions)
        .filter(t => {
            const d = new Date(t.date)
            return t.type === "expense" &&
                t.category === category &&
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
        })
        .reduce((sum, t) => sum + t.amount, 0)
}

/* ---- DROPDOWN HANDLERS ---- */
function renderCategoryDropdowns() {
    const dropdowns = [expenseCategorySelect, budgetCategorySelect, filterCategory]

    dropdowns.forEach(sel => {
        if (!sel) return
        const isFilter = sel === filterCategory
        const currVal = sel.value

        sel.innerHTML = isFilter ? `<option value="all">All Categories</option>` : ""
        categories.forEach(cat => {
            const opt = document.createElement("option")
            opt.value = cat
            opt.textContent = cat
            sel.append(opt)
        })

        if (currVal && Array.from(sel.options).some(o => o.value === currVal)) {
            sel.value = currVal
        } else if (!isFilter && categories.length > 0) {
            sel.value = categories[0]
        }
    })
}

/* ---- EVENT HANDLERS & SETTINGS ---- */
setBudgetBtn.addEventListener("click", () => {
    const category = budgetCategorySelect.value
    const amount = parseFloat(budgetAmountInput.value)
    if (!category || !amount || amount <= 0) return
    set(ref(database, `finia/budgets/${category}`), amount)
    budgetAmountInput.value = ""
})

filterType.addEventListener("change", renderTransactions)
filterCategory.addEventListener("change", renderTransactions)

settingsBtn.addEventListener("click", () => settingsModal.classList.add("show"))
closeSettings.addEventListener("click", () => settingsModal.classList.remove("show"))

function renderCategoryList() {
    categoryList.innerHTML = ""
    categories.forEach((cat, i) => {
        const li = document.createElement("li")
        li.className = "category-tag"
        li.innerHTML = `
            <span>${escapeHTML(cat)}</span>
            <button class="cat-delete" title="Remove">✕</button>
        `
        li.querySelector(".cat-delete").addEventListener("click", () => {
            categories.splice(i, 1)
            set(categoriesRef, categories)
        })
        categoryList.append(li)
    })
}

addCategoryBtn.addEventListener("click", () => {
    const name = newCategoryInput.value.trim()
    if (!name || categories.includes(name)) return
    categories.push(name)
    set(categoriesRef, categories)
    newCategoryInput.value = ""
})

/* ---- CURRENCY SETUP ---- */
let selectedCurrency = currency
document.querySelectorAll(".modal .currency-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".modal .currency-btn").forEach(b => b.classList.remove("active"))
        btn.classList.add("active")
        selectedCurrency = btn.dataset.symbol
    })
})

saveCurrencyBtn.addEventListener("click", () => {
    if (!selectedCurrency) return
    currency = selectedCurrency
    localStorage.setItem("finia_currency", currency)
    currencyTag.textContent = currency
    renderAll()
    settingsModal.classList.remove("show")
})

/* ---- RESET ---- */
resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all transactions and budgets?")) return
    remove(transactionsRef)
    remove(budgetsRef)
})

/* ---- CSV EXPORT ---- */
exportBtn.addEventListener("click", () => {
    const rows = [["Type", "Description", "Category", "Amount", "Date"]]
    Object.values(transactions).forEach(t => {
        rows.push([t.type, t.description, t.category, t.amount.toFixed(2), t.date])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `finia-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
})

/* ---- UTILS ---- */
function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}