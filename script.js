import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js"
import { getDatabase, ref, push, onValue, remove, set } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js"

/* ---- FIREBASE CONFIG ---- */
const appSettings = {
    databaseURL: "https://finia-app-a26f6-default-rtdb.asia-southeast1.firebasedatabase.app/"
}

const app = initializeApp(appSettings)
const database = getDatabase(app)

/* ---- DB REFS ---- */
const transactionsRef = ref(database, "finia/transactions")
const budgetsRef = ref(database, "finia/budgets")
const categoriesRef = ref(database, "finia/categories")

/* ---- DEFAULT CATEGORIES ---- */
const DEFAULT_CATEGORIES = [
    "Food & Dining", "Transport", "Shopping",
    "Bills & Utilities", "Entertainment", "Health", "Education", "Other"
]

/* ---- STATE ---- */
let currency = localStorage.getItem("finia_currency") || "¥"
let transactions = {}
let budgets = {}
let categories = []
let activeType = "income"
let previousBalance = null
let isFirstLoad = true

/* ---- ELEMENTS ---- */
const appEl = document.getElementById("app")
const currencyTag = document.getElementById("currencyTag")
const balanceAmount = document.getElementById("balanceAmount")
const totalIncome = document.getElementById("totalIncome")
const totalExpenses = document.getElementById("totalExpenses")
const descInput = document.getElementById("descInput")
const amountInput = document.getElementById("amountInput")
const categorySelect = document.getElementById("categorySelect")
const addBtn = document.getElementById("addBtn")
const formMsg = document.getElementById("formMsg")
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
const stickerOverlay = document.getElementById("stickerOverlay")
const stickerImg = document.getElementById("stickerImg")

/* ---- STICKER SYSTEM ---- */
let stickerTimeout = null

function showSticker(filename) {
    if (stickerTimeout) {
        clearTimeout(stickerTimeout)
        stickerOverlay.classList.remove("show")
    }

    stickerImg.src = `pfp/${filename}`
    stickerOverlay.classList.add("show")

    stickerTimeout = setTimeout(() => {
        stickerOverlay.classList.remove("show")
    }, 3000)
}

/* ---- INIT ---- */
currencyTag.textContent = currency
loadCategories()
listenToData()

/* ---- FIREBASE LISTENERS ---- */
function listenToData() {
    onValue(transactionsRef, snapshot => {
        const oldCount = Object.keys(transactions).length
        transactions = snapshot.exists() ? snapshot.val() : {}
        const newCount = Object.keys(transactions).length

        // First transaction ever
        if (oldCount === 0 && newCount === 1 && !isFirstLoad) {
            showSticker("sticker-first.png")
        }

        isFirstLoad = false
        renderAll()
    })

    onValue(budgetsRef, snapshot => {
        budgets = snapshot.exists() ? snapshot.val() : {}
        renderBudgets()
        renderBudgetAlerts()
    })
}

function loadCategories() {
    onValue(categoriesRef, snapshot => {
        if (snapshot.exists()) {
            categories = snapshot.val()
        } else {
            categories = [...DEFAULT_CATEGORIES]
            set(categoriesRef, categories)
        }
        renderCategorySelects()
        renderCategoryList()
    })
}

/* ---- TYPE TOGGLE ---- */
document.getElementById("incomeBtn").addEventListener("click", () => setType("income"))
document.getElementById("expenseBtn").addEventListener("click", () => setType("expense"))

function setType(type) {
    activeType = type
    document.getElementById("incomeBtn").classList.toggle("active", type === "income")
    document.getElementById("expenseBtn").classList.toggle("active", type === "expense")
}

/* ---- ADD TRANSACTION ---- */
addBtn.addEventListener("click", addTransaction)
amountInput.addEventListener("keydown", e => { if (e.key === "Enter") addTransaction() })

function addTransaction() {
    const desc = descInput.value.trim()
    const amount = parseFloat(amountInput.value)
    const category = categorySelect.value

    formMsg.className = "form-msg"
    formMsg.textContent = ""

    if (!desc) { showMsg("Please enter a description", "error"); return }
    if (!amount || amount <= 0) { showMsg("Please enter a valid amount", "error"); return }
    if (!category) { showMsg("Please select a category", "error"); return }

    const transaction = {
        type: activeType,
        description: desc,
        amount: amount,
        category: category,
        date: new Date().toISOString().split("T")[0]
    }

    push(transactionsRef, transaction)
    descInput.value = ""
    amountInput.value = ""
    showMsg("Added!", "success")

    // Sticker for income added
    if (activeType === "income") {
        showSticker("sticker-income.png")
    }

    setTimeout(() => { formMsg.textContent = "" }, 2000)
}

function showMsg(text, type) {
    formMsg.textContent = text
    formMsg.className = `form-msg ${type}`
}

/* ---- RENDER ALL ---- */
function renderAll() {
    renderTransactions()
    renderBalance()
    renderBudgets()
    renderBudgetAlerts()
}

/* ---- RENDER TRANSACTIONS ---- */
function renderTransactions() {
    const typeFilter = filterType.value
    const catFilter = filterCategory.value

    let items = Object.entries(transactions)

    if (typeFilter !== "all") {
        items = items.filter(([, t]) => t.type === typeFilter)
    }
    if (catFilter !== "all") {
        items = items.filter(([, t]) => t.category === catFilter)
    }

    items.sort((a, b) => new Date(b[1].date) - new Date(a[1].date))

    if (items.length === 0) {
        transactionList.innerHTML = `<li class="empty-state">No transactions here yet. Add one above!</li>`
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

/* ---- RENDER BALANCE ---- */
function renderBalance() {
    let income = 0, expenses = 0
    Object.values(transactions).forEach(t => {
        if (t.type === "income") income += t.amount
        else expenses += t.amount
    })

    const balance = income - expenses

    // Sticker triggers based on balance change
    if (previousBalance !== null && !isFirstLoad) {
        if (previousBalance >= 0 && balance < 0) {
            // Just went into debt
            showSticker("sticker-broke.png")
        } else if (previousBalance < 0 && balance >= 0) {
            // Recovered from debt
            showSticker("sticker-raise.png")
        } else if (balance > previousBalance && balance > 0 && income > 0) {
            // New high balance
            showSticker("sticker-raise.png")
        }
    }

    previousBalance = balance

    balanceAmount.textContent = balance < 0
        ? `-${currency}${Math.abs(balance).toFixed(2)}`
        : `${currency}${balance.toFixed(2)}`

    balanceAmount.className = "balance-amount " + (balance < 0 ? "negative" : balance > 0 ? "positive" : "")
    totalIncome.textContent = `${currency}${income.toFixed(2)}`
    totalExpenses.textContent = `${currency}${expenses.toFixed(2)}`
}

/* ---- RENDER BUDGETS ---- */
function renderBudgets() {
    if (!Object.keys(budgets).length) {
        budgetList.innerHTML = `<p style="color:var(--brown-light);font-size:13px;font-weight:300;">No budgets set yet.</p>`
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

/* ---- RENDER BUDGET ALERTS ---- */
function renderBudgetAlerts() {
    budgetAlerts.innerHTML = ""
    Object.entries(budgets).forEach(([category, limit]) => {
        const spent = getCategorySpending(category)
        const ratio = spent / limit

        if (ratio >= 1) {
            const div = document.createElement("div")
            div.className = "alert exceeded"
            div.textContent = `⚠️ Exceeded ${category} budget! Spent ${currency}${spent.toFixed(2)} of ${currency}${limit.toFixed(2)}`
            budgetAlerts.append(div)
            if (!isFirstLoad) showSticker("sticker-exceeded.png")
        } else if (ratio >= 0.8) {
            const div = document.createElement("div")
            div.className = "alert warning"
            div.textContent = `⚡ Nearing ${category} budget — ${currency}${spent.toFixed(2)} of ${currency}${limit.toFixed(2)} spent`
            budgetAlerts.append(div)
            if (!isFirstLoad) showSticker("sticker-warning.png")
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

/* ---- SET BUDGET ---- */
setBudgetBtn.addEventListener("click", () => {
    const category = budgetCategorySelect.value
    const amount = parseFloat(budgetAmountInput.value)
    if (!category || !amount || amount <= 0) return
    set(ref(database, `finia/budgets/${category}`), amount)
    budgetAmountInput.value = ""
})

/* ---- FILTERS ---- */
filterType.addEventListener("change", renderTransactions)
filterCategory.addEventListener("change", renderTransactions)

/* ---- CATEGORY SELECTS ---- */
function renderCategorySelects() {
    ;[categorySelect, budgetCategorySelect, filterCategory].forEach(sel => {
        const isFilter = sel === filterCategory
        sel.innerHTML = isFilter ? `<option value="all">All Categories</option>` : ""
        categories.forEach(cat => {
            const opt = document.createElement("option")
            opt.value = cat
            opt.textContent = cat
            sel.append(opt)
        })
    })
}

/* ---- SETTINGS ---- */
settingsBtn.addEventListener("click", () => settingsModal.classList.add("show"))
closeSettings.addEventListener("click", () => settingsModal.classList.remove("show"))
settingsModal.addEventListener("click", e => { if (e.target === settingsModal) settingsModal.classList.remove("show") })

function renderCategoryList() {
    categoryList.innerHTML = ""
    categories.forEach((cat, i) => {
        const li = document.createElement("li")
        const isDefault = DEFAULT_CATEGORIES.includes(cat)
        li.className = `category-tag ${isDefault ? "default" : ""}`
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

/* ---- CURRENCY IN SETTINGS ---- */
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
    localStorage.setItem("finia_currency", selectedCurrency)
    currency = selectedCurrency
    currencyTag.textContent = currency
    renderAll()
    settingsModal.classList.remove("show")
})

/* ---- RESET ---- */
resetBtn.addEventListener("click", () => {
    if (!confirm("This will delete ALL your transactions and budgets. Are you sure?")) return
    remove(transactionsRef)
    remove(budgetsRef)
})

/* ---- EXPORT CSV ---- */
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
    showSticker("sticker-export.png")
})

/* ---- UTILS ---- */
function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

// Force render categories on load
setTimeout(() => {
    if (categories.length === 0) {
        categories = [...DEFAULT_CATEGORIES]
        renderCategorySelects()
    }
}, 1000)