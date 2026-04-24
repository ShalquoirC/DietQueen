/* =========================================================
 *  奶茶咖啡 & 账单记录器  -  script.js
 *  后端：Supabase   前端：原生 JS + Chart.js
 * ========================================================= */

/* ---------- 1. Supabase 配置（替换成你自己的） ---------- */
const SUPABASE_URL  = "https://kfaxlarxwyzhwexsthvu.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYXhsYXJ4d3l6aHdleHN0aHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5ODczMjEsImV4cCI6MjA5MjU2MzMyMX0.OcD0KNl2dGSbFc3Wg-qrHhLKvrcsXjDci_0JgKpKq7s";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

try {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  } else {
    console.error("Supabase library not loaded");
  }
} catch (e) {
  console.error("Supabase initialization error:", e);
}

/* ---------- 2. 通用工具 ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => r.querySelectorAll(s);

function toast(msg, type = "info") {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => (t.className = "toast"), 2200);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- 3. Tab 切换 ---------- */
function initTabs() {
  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      const targetContent = $("#tab-" + tabId);
      
      if (!targetContent) return;

      $$(".tab-btn").forEach(b => b.classList.remove("active"));
      $$(".tab-content").forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      targetContent.classList.add("active");
      
      if (tabId === "chart") renderCharts();
    });
  });
}

/* ---------- 4. 饮品记录 ---------- */
function initDrinkForm() {
  const drinkDate = $("#drink-date");
  if (drinkDate) drinkDate.value = today();

  const drinkForm = $("#drink-form");
  if (drinkForm) {
    drinkForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!supabase) return toast("Supabase 未初始化", "error");
      
      const payload = {
        type:  $("#drink-type").value,
        name:  $("#drink-name").value.trim(),
        price: parseFloat($("#drink-price").value),
        date:  $("#drink-date").value
      };
      
      try {
        const { error } = await supabase.from("drinks").insert(payload);
        if (error) throw error;
        toast("添加成功 ✅", "success");
        e.target.reset();
        $("#drink-date").value = today();
        loadDrinks();
      } catch (err) {
        toast("添加失败：" + err.message, "error");
      }
    });
  }
}

async function loadDrinks() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from("drinks")
      .select("*")
      .order("date", { ascending: false });
    if (error) throw error;

    const tbody = $("#drink-table tbody");
    if (!tbody) return;
    
    tbody.innerHTML = (data || []).map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.type === "milktea" ? "🧋 奶茶" : "☕ 咖啡"}</td>
        <td>${r.name}</td>
        <td>¥${Number(r.price).toFixed(2)}</td>
        <td><button class="btn-del" data-id="${r.id}" data-t="drinks">删除</button></td>
      </tr>`).join("") || `<tr><td colspan="5" class="empty">暂无数据</td></tr>`;
  } catch (err) {
    toast("加载饮品失败：" + err.message, "error");
  }
}

/* ---------- 5. 账单记录 ---------- */
function initBillForm() {
  const billDate = $("#bill-date");
  if (billDate) billDate.value = today();

  const billForm = $("#bill-form");
  if (billForm) {
    billForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!supabase) return toast("Supabase 未初始化", "error");

      const payload = {
        category: $("#bill-category").value,
        desc:     $("#bill-desc").value.trim(),
        amount:   parseFloat($("#bill-amount").value),
        date:     $("#bill-date").value
      };
      
      try {
        const { error } = await supabase.from("bills").insert(payload);
        if (error) throw error;
        toast("添加成功 ✅", "success");
        e.target.reset();
        $("#bill-date").value = today();
        loadBills();
      } catch (err) {
        toast("添加失败：" + err.message, "error");
      }
    });
  }
}

async function loadBills() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .order("date", { ascending: false });
    if (error) throw error;

    const tbody = $("#bill-table tbody");
    if (!tbody) return;

    tbody.innerHTML = (data || []).map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.category}</td>
        <td>${r.desc}</td>
        <td>¥${Number(r.amount).toFixed(2)}</td>
        <td><button class="btn-del" data-id="${r.id}" data-t="bills">删除</button></td>
      </tr>`).join("") || `<tr><td colspan="5" class="empty">暂无数据</td></tr>`;
  } catch (err) {
    toast("加载账单失败：" + err.message, "error");
  }
}

/* ---------- 6. 删除（事件委托） ---------- */
function initDeleteHandler() {
  document.addEventListener("click", async e => {
    const btn = e.target.closest(".btn-del");
    if (!btn) return;
    if (!supabase) return toast("Supabase 未初始化", "error");
    
    if (!confirm("确认删除该条记录？")) return;
    
    try {
      const { error } = await supabase.from(btn.dataset.t).delete().eq("id", btn.dataset.id);
      if (error) throw error;
      toast("已删除", "success");
      btn.dataset.t === "drinks" ? loadDrinks() : loadBills();
    } catch (err) {
      toast("删除失败：" + err.message, "error");
    }
  });
}

/* ---------- 7. 图表 ---------- */
let chartDrink, chartBill, chartTrend;

async function renderCharts() {
  if (!supabase) return;
  
  try {
    const [{ data: drinksRaw }, { data: billsRaw }] = await Promise.all([
      supabase.from("drinks").select("*"),
      supabase.from("bills").select("*")
    ]);

    const drinks = drinksRaw || [];
    const bills = billsRaw || [];

    /* 7.1 饮品类型金额 */
    const drinkSum = { milktea: 0, coffee: 0 };
    drinks.forEach(d => (drinkSum[d.type] += Number(d.price) || 0));
    
    const ctxDrink = $("#chart-drink");
    if (ctxDrink) {
      chartDrink?.destroy();
      chartDrink = new Chart(ctxDrink, {
        type: "bar",
        data: {
          labels: ["🧋 奶茶", "☕ 咖啡"],
          datasets: [{
            label: "消费金额 (¥)",
            data: [drinkSum.milktea, drinkSum.coffee],
            backgroundColor: ["#f6a5c0", "#8b5a2b"]
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }

    /* 7.2 账单分类占比 */
    const cat = {};
    bills.forEach(b => (cat[b.category] = (cat[b.category] || 0) + Number(b.amount)));
    
    const ctxBill = $("#chart-bill");
    if (ctxBill) {
      chartBill?.destroy();
      chartBill = new Chart(ctxBill, {
        type: "doughnut",
        data: {
          labels: Object.keys(cat),
          datasets: [{
            data: Object.values(cat),
            backgroundColor: ["#ff6b6b", "#feca57", "#48dbfb", "#1dd1a1", "#a29bfe"]
          }]
        },
        options: { responsive: true }
      });
    }

    /* 7.3 近 30 天趋势 */
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const drinkMap = Object.fromEntries(days.map(d => [d, 0]));
    const billMap  = Object.fromEntries(days.map(d => [d, 0]));
    drinks.forEach(r => drinkMap[r.date] !== undefined && (drinkMap[r.date] += Number(r.price)));
    bills .forEach(r => billMap [r.date] !== undefined && (billMap [r.date] += Number(r.amount)));

    const ctxTrend = $("#chart-trend");
    if (ctxTrend) {
      chartTrend?.destroy();
      chartTrend = new Chart(ctxTrend, {
        type: "line",
        data: {
          labels: days.map(d => d.slice(5)),
          datasets: [
            { label: "饮品", data: Object.values(drinkMap), borderColor: "#f6a5c0", tension: .3, fill: false },
            { label: "账单", data: Object.values(billMap),  borderColor: "#48dbfb", tension: .3, fill: false }
          ]
        },
        options: { responsive: true }
      });
    }
  } catch (err) {
    console.error("Render charts error:", err);
  }
}

/* ---------- 8. 初始化 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initDrinkForm();
  initBillForm();
  initDeleteHandler();
  
  if (supabase) {
    loadDrinks();
    loadBills();
  }
});

