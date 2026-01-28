// app.js
import { auth, dbCloud, fb } from "./firebase.js";

let db = {
  trans: [],
  recurring: [],
  config: {
    cats: { exp: ["طعام","مواصلات","ماركت","فواتير","ترفيه","علاج","ملابس"], inc: ["راتب","فري لانس","أرباح","أخرى"] },
    wallets: ["كاش","فيزا","بنك","فودافون"]
  }
};

let charts = {};
let currentFilter = "all";
const LOCAL_KEY = "MoneyApp_Moumen_V13";
let currentUser = null;

// ---------- Cloud (Firestore) ----------
function userDocRef(uid){
  return fb.doc(dbCloud, "users", uid, "app", "main"); // users/{uid}/app/main
}

let syncTimer = null;
function scheduleCloudSync(){
  if(!currentUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await fb.setDoc(userDocRef(currentUser.uid), {
        data: db,
        updatedAt: fb.serverTimestamp()
      }, { merge: true });
    } catch (e){
      console.warn("Cloud sync failed:", e);
    }
  }, 600);
}

async function pullFromCloud(uid){
  try {
    const snap = await fb.getDoc(userDocRef(uid));
    if(snap.exists()){
      const cloudData = snap.data()?.data;
      if(cloudData && cloudData.trans && cloudData.config){
        db = cloudData;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
        Swal.fire({ toast:true, position:"top", timer:1500, showConfirmButton:false, icon:"success", title:"Synced from cloud ☁️" });
      }
    } else {
      // first time: upload local DB
      await fb.setDoc(userDocRef(uid), {
        data: db,
        createdAt: fb.serverTimestamp(),
        updatedAt: fb.serverTimestamp()
      }, { merge: true });
    }
  } catch(e){
    console.warn("Pull from cloud failed:", e);
  }
}

// ---------- Auth UI ----------
function setAuthStatus(){
  const el = document.getElementById("authStatus");
  if(!el) return;
  if(currentUser){
    el.innerHTML = `Logged in: <b>${currentUser.email}</b> (sync ON ☁️)`;
  } else {
    el.textContent = "Not logged in (local only)";
  }
}

window.authRegister = async function(){
  const email = document.getElementById("authEmail").value.trim();
  const pass  = document.getElementById("authPass").value.trim();
  if(!email || !pass) return Swal.fire("Warning", "Enter email & password", "warning");
  try{
    await fb.createUserWithEmailAndPassword(auth, email, pass);
    Swal.fire({ toast:true, position:"top", timer:1500, showConfirmButton:false, icon:"success", title:"Account created ✅" });
  }catch(e){
    Swal.fire("Error", e.message, "error");
  }
}

window.authLogin = async function(){
  const email = document.getElementById("authEmail").value.trim();
  const pass  = document.getElementById("authPass").value.trim();
  if(!email || !pass) return Swal.fire("Warning", "Enter email & password", "warning");
  try{
    await fb.signInWithEmailAndPassword(auth, email, pass);
    Swal.fire({ toast:true, position:"top", timer:1500, showConfirmButton:false, icon:"success", title:"Logged in ✅" });
  }catch(e){
    Swal.fire("Error", e.message, "error");
  }
}

window.authLogout = async function(){
  try{
    await fb.signOut(auth);
    Swal.fire({ toast:true, position:"top", timer:1200, showConfirmButton:false, icon:"success", title:"Logged out" });
  }catch(e){
    Swal.fire("Error", e.message, "error");
  }
}

fb.onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  setAuthStatus();
  if(currentUser){
    await pullFromCloud(currentUser.uid);
    renderDropdowns();
    refreshUI();
  } else {
    // keep local-only
    renderDropdowns();
    refreshUI();
  }
});

// ---------- App start ----------
window.addEventListener("load", () => {
  const saved = localStorage.getItem(LOCAL_KEY);
  if(saved) db = JSON.parse(saved);

  if(localStorage.getItem("darkMode") === "true") document.body.classList.add("dark-mode");

  document.getElementById("inpDate").valueAsDate = new Date();
  document.getElementById("monthName").innerText = new Date().toLocaleString("ar-EG", { month: "long" });

  renderDropdowns();
  refreshUI();

  // optional PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
});

// ---------- Your existing functions (with small edits) ----------
window.saveData = function(){
  localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
  refreshUI();
  scheduleCloudSync(); // <--- sync to Firestore if logged in
}

window.toggleDarkMode = function() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
  updateCharts();
}

window.showTab = function(id, nav) {
  document.querySelectorAll(".tab-section").forEach(t => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(nav){
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    nav.classList.add("active");
  }
  if(id === "tab-stats") updateCharts();
}

window.toggleFormMode = function() {
  const type = document.querySelector('input[name="opType"]:checked').value;
  document.getElementById("normalMode").style.display = (type === "trans") ? "none" : "flex";
  document.getElementById("transferMode").style.display = (type === "trans") ? "flex" : "none";
  renderDropdowns();
}

window.renderDropdowns = function() {
  const type = document.getElementById("radioInc").checked ? "inc" : "exp";
  const cats = db.config.cats[type];
  const wallets = db.config.wallets;
  const fill = (id, data) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = "";
    data.forEach(x => el.innerHTML += `<option value="${x}">${x}</option>`);
  };
  fill("inpCat", cats);
  fill("inpWallet", wallets);
  fill("walletFrom", wallets);
  fill("walletTo", wallets);
}

window.saveTrans = function() {
  const id = document.getElementById("editId").value;
  const amt = parseFloat(document.getElementById("inpAmount").value);
  if(!amt) return Swal.fire("تنبيه", "أدخل المبلغ", "warning");

  const type = document.querySelector('input[name="opType"]:checked').value;
  const date = document.getElementById("inpDate").value;
  const note = document.getElementById("inpNote").value;
  const isRec = document.getElementById("isRec").checked;

  let transData = { id: id ? parseInt(id) : Date.now(), type, amt, date, note };

  if(type === "trans") {
    transData.walletFrom = document.getElementById("walletFrom").value;
    transData.walletTo = document.getElementById("walletTo").value;
    transData.cat = "تحويل";
  } else {
    transData.cat = document.getElementById("inpCat").value;
    transData.wallet = document.getElementById("inpWallet").value;
    if(isRec && !id) db.recurring.push({ id: Date.now(), type, amt, cat: transData.cat, wallet: transData.wallet, note });
  }

  if(id) {
    const idx = db.trans.findIndex(t => t.id == id);
    if(idx !== -1) db.trans[idx] = transData;
    cancelEdit();
  } else {
    db.trans.push(transData);
    document.getElementById("inpAmount").value = "";
    document.getElementById("inpNote").value = "";
    Swal.fire({ toast:true, position:"bottom", timer:1500, showConfirmButton:false, icon:"success", title:"تم الحفظ" });
  }
  saveData();
}

window.refreshUI = function() {
  let total = 0, incSum = 0, expSum = 0;
  let wallets = {}; db.config.wallets.forEach(w => wallets[w] = 0);

  db.trans.forEach(t => {
    if(t.type === "inc") { total += t.amt; wallets[t.wallet] += t.amt; incSum += t.amt; }
    else if(t.type === "exp") { total -= t.amt; wallets[t.wallet] -= t.amt; expSum += t.amt; }
    else { wallets[t.walletFrom] -= t.amt; wallets[t.walletTo] += t.amt; }
  });

  document.getElementById("netBalance").innerText = total.toLocaleString();
  document.getElementById("totalInc").innerText = incSum.toLocaleString();
  document.getElementById("totalExp").innerText = expSum.toLocaleString();

  const ratio = incSum > 0 ? (expSum / incSum) * 100 : 0;
  const bar = document.getElementById("budgetBar");
  bar.style.width = Math.min(ratio, 100) + "%";
  bar.style.backgroundColor = ratio > 90 ? "#ef4444" : (ratio > 50 ? "#f59e0b" : "#ffffff");

  const recent = [...db.trans].reverse().slice(0, 3);
  const recList = document.getElementById("recentList");
  recList.innerHTML = "";
  recent.forEach(t => recList.innerHTML += `<div class="p-3 border-bottom d-flex justify-content-between"><span class="small">${t.cat}</span><span class="small fw-bold">${t.amt}</span></div>`);
  if(recent.length === 0) recList.innerHTML = '<div class="p-3 text-center small text-muted">لا يوجد حركات حديثة</div>';

  const wDiv = document.getElementById("walletStats");
  if(wDiv){
    wDiv.innerHTML = "";
    for(let w in wallets) wDiv.innerHTML += `<div class="d-flex justify-content-between border-bottom p-2"><span>${w}</span><strong>${wallets[w].toLocaleString()}</strong></div>`;
  }

  renderDynamicHistory();
}

window.filterHistory = function(type, btn) {
  currentFilter = type;
  document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  renderDynamicHistory();
}

window.renderDynamicHistory = function() {
  const list = document.getElementById("historyListContainer");
  list.innerHTML = "";

  // 🔒 Optional: block history until login
  // If you want history visible even without login, comment out this block.
  if(!currentUser){
    list.innerHTML = `<div class="text-center text-muted py-5">
      <i class="fa-solid fa-lock fs-1 mb-2"></i><br>
      Please login from Settings to see your history
    </div>`;
    return;
  }

  let filtered = [...db.trans].reverse();
  if(currentFilter !== "all") filtered = filtered.filter(t => t.type === currentFilter);

  const grouped = {};
  filtered.forEach(t => { if(!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });
  const dates = Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a));

  if(dates.length === 0) {
    list.innerHTML = `<div class="text-center text-muted py-5"><i class="fa-solid fa-wind fs-1 mb-2"></i><br>No data</div>`;
    return;
  }

  dates.forEach(date => {
    let dateName = date;
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 864e5).toISOString().split("T")[0];
    if(date === today) dateName = "اليوم";
    else if(date === yesterday) dateName = "أمس";
    else dateName = new Date(date).toLocaleDateString("ar-EG", {weekday:"long", day:"numeric", month:"long"});

    let groupHTML = `<div class="date-header">${dateName}</div><div class="card p-0 overflow-hidden mb-3">`;

    grouped[date].forEach(t => {
      let color = "text-main", sign = "", icon = "fa-circle-dot";
      if(t.type === "inc") { color = "money-plus"; sign = "+"; icon = "fa-arrow-down"; }
      else if(t.type === "exp") { color = "money-minus"; sign = "-"; icon = "fa-arrow-up"; }
      else { color = "money-trans"; sign = ""; icon = "fa-right-left"; }

      groupHTML += `
        <div class="d-flex justify-content-between align-items-center p-3 trans-item">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; background: var(--input-bg); color: var(--text-main);">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div>
              <div class="fw-bold" style="font-size: 0.95rem;">${t.cat}</div>
              <div class="small text-muted" style="font-size: 0.75rem;">${t.walletFrom||t.wallet} ${t.note?'- '+t.note:''}</div>
            </div>
          </div>
          <div class="text-end">
            <div class="fw-bold ${color}">${sign}${t.amt.toLocaleString()}</div>
            <div class="small text-muted cursor-pointer" onclick="startEdit(${t.id})">Edit</div>
          </div>
        </div>`;
    });

    groupHTML += `</div>`;
    list.innerHTML += groupHTML;
  });
}

window.startEdit = function(id) {
  const t = db.trans.find(x => x.id === id); if(!t) return;
  document.getElementById("editId").value = t.id;
  document.getElementById("inpAmount").value = t.amt;
  document.getElementById("inpDate").value = t.date;
  document.getElementById("inpNote").value = t.note || "";

  if(t.type === "trans") document.getElementById("radioTrans").click();
  else if(t.type === "inc") document.getElementById("radioInc").click();
  else document.getElementById("radioExp").click();

  document.getElementById("saveBtn").innerHTML = 'تحديث <i class="fa-solid fa-rotate ms-2"></i>';
  document.getElementById("cancelBtn").classList.remove("d-none");
  showTab("tab-home");
}

window.cancelEdit = function() {
  document.getElementById("editId").value = "";
  document.getElementById("inpAmount").value = "";
  document.getElementById("inpNote").value = "";
  document.getElementById("saveBtn").innerHTML = 'حفظ <i class="fa-solid fa-check ms-2"></i>';
  document.getElementById("cancelBtn").classList.add("d-none");
}

window.clearAll = function() {
  if(confirm("Clear all?")) {
    localStorage.removeItem(LOCAL_KEY);
    location.reload();
  }
}

window.addCustomItem = function(type) {
  const val = prompt("الاسم:");
  if(val) {
    if(type === "cat") db.config.cats.exp.push(val);
    else db.config.wallets.push(val);
    saveData();
    renderDropdowns();
  }
}

window.exportToCSV = function() {
  let csv = "\uFEFFالتاريخ,النوع,التصنيف,المبلغ,ملاحظات\n";
  db.trans.forEach(t => csv += `${t.date},${t.type},${t.cat},${t.amt},${t.note||""}\n`);
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "Moumen_Money.csv";
  a.click();
}

window.backupData = function(){
  const a=document.createElement("a");
  a.href="data:json;charset=utf-8,"+encodeURIComponent(JSON.stringify(db));
  a.download="Moumen_Backup.json";
  a.click();
}
window.restoreData = function(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if(data.trans && data.config) {
        db = data;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
        scheduleCloudSync();
        Swal.fire({title:"Restored", icon:"success", timer:1500}).then(()=>location.reload());
      } else {
        Swal.fire("Invalid file", "", "error");
      }
    } catch(err) {
      Swal.fire("Bad JSON", "", "error");
    }
  };
  reader.readAsText(file);
}

// calculator
let cStr="";
window.openCalc = function(){document.getElementById("calcModal").classList.add("show");cStr="";document.getElementById("calcDisp").value="";}
window.closeCalc = function(){document.getElementById("calcModal").classList.remove("show")}
window.cIn = function(v){cStr+=v;document.getElementById("calcDisp").value=cStr}
window.cEq = function(){try{document.getElementById("inpAmount").value=eval(cStr);closeCalc()}catch{}}
window.cClr = function(){cStr="";document.getElementById("calcDisp").value=""}
