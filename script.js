/* =========================================================
 *  奶茶咖啡 & 账单记录器  -  script.js
 *  后端：Supabase   前端：原生 JS + Chart.js
 * ========================================================= */

/* ---------- 1. Supabase 配置 ---------- */
const SUPABASE_URL  = "https://kfaxlarxwyzhwexsthvu.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYXhsYXJ4d3l6aHdleHN0aHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5ODczMjEsImV4cCI6MjA5MjU2MzMyMX0.OcD0KNl2dGSbFc3Wg-qrHhLKvrcsXjDci_0JgKpKq7s";

// 使用 sb 作为客户端实例名称，避免与全局 window.supabase 库对象冲突
let sb;

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
  const tabBtns = $$(".tab-btn");
  const tabContents = $$(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = "tab-" + btn.dataset.tab;
      
      // 切换按钮状态
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // 切换内容显隐
      tabContents.forEach(c => {
        if (c.id === targetId) {
          c.classList.add("active");
        } else {
          c.classList.remove("active");
        }
      });

      // 如果是图表页，触发重绘
      if (btn.dataset.tab === "chart") renderCharts();
    });
  });
}

/* ---------- 4. 饮品记录 ---------- */
async function loadDrinks() {
  if (!sb) return;
  const { data, error } = await sb
    .from("drinks")
    .select("*")
    .order("date", { ascending: false });
  
  if (error) return toast("加载失败：" + error.message, "error");

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
}

function initDrinkForm() {
  const drinkForm = $("#drink-form");
  const drinkDate = $("#drink-date");
  
  if (drinkDate) drinkDate.value = today();

  if (drinkForm) {
    drinkForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!sb) return toast("数据库未连接", "error");

      const payload = {
        type:  $("#drink-type").value,
        name:  $("#drink-name").value.trim(),
        price: parseFloat($("#drink-price").value),
        date:  $("#drink-date").value
      };

      const { error } = await sb.from("drinks").insert(payload);
      if (error) return toast("添加失败：" + error.message, "error");
      
      toast("添加成功 ✅", "success");
      e.target.reset();
      if (drinkDate) drinkDate.value = today();
      loadDrinks();
    });
  }
}

/* ---------- 5. 账单记录 ---------- */
async function loadBills() {
  if (!sb) return;
  const { data, error } = await sb
    .from("bills")
    .select("*")
    .order("date", { ascending: false });
  
  if (error) return toast("加载失败：" + error.message, "error");

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
}

function initBillForm() {
  const billForm = $("#bill-form");
  const billDate = $("#bill-date");

  if (billDate) billDate.value = today();

  if (billForm) {
    billForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!sb) return toast("数据库未连接", "error");

      const payload = {
        category: $("#bill-category").value,
        desc:     $("#bill-desc").value.trim(),
        amount:   parseFloat($("#bill-amount").value),
        date:     $("#bill-date").value
      };

      const { error } = await sb.from("bills").insert(payload);
      if (error) return toast("添加失败：" + error.message, "error");
      
      toast("添加成功 ✅", "success");
      e.target.reset();
      if (billDate) billDate.value = today();
      loadBills();
    });
  }
}

/* ---------- 6. 删除（事件委托） ---------- */
function initDeleteHandler() {
  document.addEventListener("click", async e => {
    const btn = e.target.closest(".btn-del");
    if (!btn) return;
    if (!sb) return;
    
    if (!confirm("确认删除该条记录？")) return;
    
    const { error } = await sb.from(btn.dataset.t).delete().eq("id", btn.dataset.id);
    if (error) return toast("删除失败：" + error.message, "error");
    
    toast("已删除", "success");
    btn.dataset.t === "drinks" ? loadDrinks() : loadBills();
  });
}

/* ---------- 7. 图表 ---------- */
let chartDrink, chartBill, chartTrend;

async function renderCharts() {
  if (!sb || !window.Chart) return;

  try {
    const [{ data: drinks = [] }, { data: bills = [] }] = await Promise.all([
      sb.from("drinks").select("*"),
      sb.from("bills").select("*")
    ]);

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
    console.error("图表渲染出错:", err);
  }
}

/* ---------- 8. 初始化 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // 初始化 Supabase 客户端
  if (window.supabase) {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } catch (e) {
      console.error("Supabase 初始化失败:", e);
      toast("数据库初始化失败，请检查配置", "error");
    }
  } else {
    console.error("Supabase 库未加载");
    toast("网络异常：无法加载数据库组件", "error");
  }

  initTabs();
  initDrinkForm();
  initBillForm();
  initDeleteHandler();
  
  if (sb) {
    loadDrinks();
    loadBills();
  }
});
