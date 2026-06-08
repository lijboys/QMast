// 手滑了 v3.0 — 云端同步 · 动效 · 周报
(function() {
  "use strict";

  const API_BASE = "api/";
  const STORAGE_KEY = "hsl_data";
  const QUOTES = [
    "每一次觉察，都是改变的开始。","自律不是束缚，而是通往自由的桥梁。",
    "你比你以为的更强大。","千里之行，始于足下。","君子慎独。",
    "克制是力量的象征，而非软弱。","今天的小克制，是明天的大自由。",
    "觉察呼吸，回到当下。","你值得过一种更清醒的生活。"
  ];
  const TRIGGERS = ["无聊","压力","失眠","刷手机","焦虑","独处","疲劳","其他"];
  const ICONS = {
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    "alert-circle": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'
  };

  function pad(n) { return n < 10 ? "0"+n : ""+n; }
  function fmtDate(d) { return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function fmtTime(d) { return pad(d.getHours())+":"+pad(d.getMinutes()); }
  function todayStr() { return fmtDate(new Date()); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function(ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }
  function getWeekStart(d) {
    var ws = new Date(d);
    var day = ws.getDay() || 7;
    ws.setDate(ws.getDate() - day + 1);
    ws.setHours(0,0,0,0);
    return ws;
  }

  // ====== 数据层 ======
  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { records: [], settings: getDefaultSettings(), lastSync: 0, user: null, pendingDeletes: [] };
  }
  function saveLocal(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function getDefaultSettings() { return { theme: "light", dailyThreshold: 2, weeklyThreshold: 4, weeklyGoal: 2, weeklyTs: 0 }; }
  function getRecords() { return loadLocal().records || []; }
  function getSettings() { var d=loadLocal(); return Object.assign(getDefaultSettings(), d.settings); }
  function setSettings(s) { var d=loadLocal(); d.settings=s; saveLocal(d); }
  function getUser() { return loadLocal().user; }
  function getPendingDeletes() { return loadLocal().pendingDeletes || []; }
  function queueDeletes(timestamps) {
    var data = loadLocal();
    var set = {};
    (data.pendingDeletes || []).concat(timestamps).forEach(function(ts) {
      if (ts) set[ts] = true;
    });
    data.pendingDeletes = Object.keys(set).map(function(ts) { return parseInt(ts, 10); });
    saveLocal(data);
  }
  function clearQueuedDeletes(timestamps) {
    var data = loadLocal();
    var removed = {};
    timestamps.forEach(function(ts) { removed[ts] = true; });
    data.pendingDeletes = (data.pendingDeletes || []).filter(function(ts) { return !removed[ts]; });
    saveLocal(data);
  }

  // ====== 云端 API ======
  function api(path, data, method) {
    var user = getUser();
    var opts = { method: method || "POST", headers: { "Content-Type": "application/json" } };
    if (user && user.token) opts.headers["Authorization"] = "Bearer " + user.token;
    if (data) opts.body = JSON.stringify(data);
    return fetch(API_BASE + path, opts).then(function(r) { return r.json(); });
  }

  function pushRecords(records) {
    if (!getUser()) return Promise.resolve();
    setSyncStatus("syncing");
    return api("sync.php", { records: records }).then(function(r) {
      if (r.error) throw r.error;
      var d = loadLocal();
      d.lastSync = Date.now();
      saveLocal(d);
      setSyncStatus("online");
      return r;
    }).catch(function(e) {
      setSyncStatus("offline");
      console.warn("sync push fail:", e);
    });
  }

  function pullRecords() {
    if (!getUser()) return Promise.resolve([]);
    setSyncStatus("syncing");
    return api("sync.php?since=0", null, "GET").then(function(r) {
      if (r.error) throw r.error;
      if (r.records && r.records.length > 0) {
        var local = getRecords();
        var byTs = {};
        var pendingDeletes = {};
        getPendingDeletes().forEach(function(ts) { pendingDeletes[ts] = true; });
        local.forEach(function(l, idx) { byTs[l.timestamp] = idx; });
        r.records.forEach(function(rem) {
          if (pendingDeletes[rem.timestamp]) return;
          if (typeof byTs[rem.timestamp] === "number") {
            local[byTs[rem.timestamp]] = { timestamp: rem.timestamp, date: rem.date, time: rem.time, triggers: rem.triggers || [] };
          } else {
            local.push({ timestamp: rem.timestamp, date: rem.date, time: rem.time, triggers: rem.triggers || [] });
          }
        });
        local.sort(function(a,b) { return a.timestamp - b.timestamp; });
        var nd = loadLocal();
        nd.records = local;
        nd.lastSync = Date.now();
        saveLocal(nd);
      } else {
        var nd = loadLocal();
        nd.lastSync = Date.now();
        saveLocal(nd);
      }
      setSyncStatus("online");
      return r;
    }).catch(function(e) {
      setSyncStatus("offline");
      console.warn("sync pull fail:", e);
    });
  }

  function attemptSync() {
    if (!getUser()) return;
    deleteRemote(getPendingDeletes()).then(function() {
      return pushRecords(getRecords());
    }).then(function() { return pullRecords(); });
  }

  // ====== 统计 ======
  function calcStats(records) {
    var now = new Date(), today = todayStr();
    var ws = getWeekStart(now);

    var todayCount = 0, weekCount = 0, cleanDays = 0, dates = {};
    records.forEach(function(r) {
      if (r.date === today) todayCount++;
      if (new Date(r.timestamp) >= ws) weekCount++;
      dates[r.date] = true;
    });

    for (var i = 0; i < 365; i++) {
      var d = new Date(now); d.setDate(d.getDate() - i);
      if (!dates[fmtDate(d)]) cleanDays++;
      else break;
    }

    var settings = getSettings();
    var weekGoal = Math.max(parseInt(settings.weeklyGoal, 10) || 0, 0);
    return { todayCount: todayCount, weekCount: weekCount, cleanDays: cleanDays, weekGoal: weekGoal };
  }

  // ====== 警告 ======
  function getWarning(records) {
    var now = new Date(), today = todayStr();
    var ws = getWeekStart(now);
    var settings = getSettings();
    var todayR = records.filter(function(r) { return r.date === today; });
    var weekR = records.filter(function(r) { return new Date(r.timestamp) >= ws; });
    if (todayR.length >= Math.max(settings.dailyThreshold || 2, 2)) {
      return "今日已记录 " + todayR.length + " 次，适度为宜。过度可能影响精力，建议转移注意力。";
    }
    if (weekR.length >= settings.weeklyThreshold) {
      return "本周已记录 " + weekR.length + " 次，频率较高。建议增加运动、社交来调节。";
    }
    return null;
  }

  // ====== 周报 ======
  function showWeeklyIfNeeded() {
    var settings = getSettings();
    var now = new Date();
    var weekNum = now.getFullYear() * 100 + now.getWeek();
    if (settings.weeklyTs >= weekNum) return;
    var records = getRecords();
    var ws = getWeekStart(now);
    var weekR = records.filter(function(r) { return new Date(r.timestamp) >= ws; });
    var prevWeekStart = new Date(ws); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    var prevWeekR = records.filter(function(r) {
      var t = new Date(r.timestamp);
      return t >= prevWeekStart && t < ws;
    });

    settings.weeklyTs = weekNum;
    setSettings(settings);

    var html = "本周共记录 <strong>" + weekR.length + "</strong> 次";
    if (prevWeekR.length > 0) {
      var diff = weekR.length - prevWeekR.length;
      var emoji = diff <= 0 ? "👍" : "📈";
      html += "（上周 " + prevWeekR.length + " 次，" + emoji + (diff > 0 ? "+" : "") + diff + "）";
    }
    html += "<br>当前清净 <strong>" + calcStats(records).cleanDays + "</strong> 天，继续加油 💪";
    document.getElementById("weeklyContent").innerHTML = html;
    document.getElementById("weeklyModal").classList.remove("hidden");
  }

  Date.prototype.getWeek = function() {
    var d = new Date(this); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    var week1 = new Date(d.getFullYear(), 0, 4);
    return Math.ceil(((d - week1) / 86400000 + week1.getDay() + 1) / 7);
  };

  // ====== UI 渲染 ======
  function renderAll() {
    var records = getRecords();
    var stats = calcStats(records);
    var s = getSettings();

    document.getElementById("todayCount").textContent = stats.todayCount;
    document.getElementById("weekCount").textContent = stats.weekCount;
    document.getElementById("cleanDays").textContent = stats.cleanDays;

    document.getElementById("goalText").textContent = stats.weekCount + "/" + stats.weekGoal;
    var pct = stats.weekGoal > 0 ? Math.min(stats.weekCount / stats.weekGoal * 100, 100) : 0;
    document.getElementById("goalFill").style.width = pct + "%";

    renderHistory(records);
    showLastRecord(records);
    replaceIcons();
  }

  function renderHistory(records) {
    var list = document.getElementById("historyList");
    if (records.length === 0) {
      list.innerHTML = '<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>暂无记录</p></div>';
      return;
    }
    var html = "";
    var latest = records.slice(-30).reverse();
    latest.forEach(function(r, i) {
      var trig = (r.triggers && r.triggers.length) ? " · " + r.triggers.map(escapeHtml).join(" ") : "";
      var realIdx = records.length - 1 - i;
      html += '<div class="history-item"><span class="history-dot"></span><span class="history-date">' + escapeHtml(r.date) + '</span><span class="history-time">' + escapeHtml(r.time) + trig + '</span><span class="history-del" data-idx="' + realIdx + '">✕</span></div>';
    });
    list.innerHTML = html;

    // 删除
    list.querySelectorAll(".history-del").forEach(function(el) {
      el.addEventListener("click", function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute("data-idx"));
        var data = loadLocal();
        var removed = data.records.splice(idx, 1);
        saveLocal(data);
        renderAll();
        deleteRemote(removed.map(function(r) { return r.timestamp; }));
      });
    });
  }

  function showLastRecord(records) {
    var bar = document.getElementById("lastRecordBar");
    if (records.length === 0) { bar.classList.add("hidden"); return; }
    var last = records[records.length - 1];
    var now = Date.now();
    if (now - last.timestamp > 60000 * 60) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    document.getElementById("lastRecordTime").textContent = last.date + " " + last.time;
    document.getElementById("lastRecordTriggers").textContent = (last.triggers && last.triggers.length) ? "(" + last.triggers.join(", ") + ")" : "";
  }

  // ====== 打卡 ======
  function doCheckin() {
    var now = new Date();
    var r = { timestamp: now.getTime(), date: fmtDate(now), time: fmtTime(now), triggers: [] };
    var data = loadLocal();
    data.records.push(r);
    saveLocal(data);

    // 按钮动画
    var btn = document.getElementById("checkInBtn");
    btn.classList.add("success");
    var orig = btn.innerHTML;
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 已记录';
    setTimeout(function() { btn.classList.remove("success"); btn.innerHTML = orig; }, 1200);

    // 涟漪
    var rect = btn.getBoundingClientRect();
    var rip = document.createElement("span");
    rip.className = "ripple";
    var sz = Math.max(rect.width, rect.height);
    rip.style.cssText = "width:"+sz+"px;height:"+sz+"px;left:"+(rect.width/2-sz/2)+"px;top:"+(rect.height/2-sz/2)+"px";
    btn.appendChild(rip);
    setTimeout(function() { rip.remove(); }, 600);

    // 数字弹跳
    document.querySelectorAll(".stat-num").forEach(function(el) {
      el.classList.remove("bounce");
      void el.offsetWidth;
      el.classList.add("bounce");
    });

    renderAll();

    // 警告
    var records = getRecords();
    var w = getWarning(records);
    if (w) {
      document.getElementById("warningMsg").textContent = w;
      document.getElementById("warningModal").classList.remove("hidden");
    }

    // 云端同步
    pushRecords([r]);

    // 周报检查
    showWeeklyIfNeeded();
  }

  // ====== 编辑触发因素 ======
  var editIdx = -1;
  function openEdit(idx) {
    editIdx = idx;
    var records = getRecords();
    var r = records[idx];
    if (!r) return;
    document.getElementById("editTargetTime").textContent = r.date + " " + r.time;
    var tags = document.querySelectorAll("#editTriggersGrid .trigger-tag");
    tags.forEach(function(t) {
      t.classList.toggle("active", (r.triggers || []).indexOf(t.getAttribute("data-trigger")) >= 0);
    });
    document.getElementById("editModal").classList.remove("hidden");
  }
  function saveEdit() {
    if (editIdx < 0) return;
    var data = loadLocal();
    var r = data.records[editIdx];
    if (!r) return;
    var active = [];
    document.querySelectorAll("#editTriggersGrid .trigger-tag.active").forEach(function(t) {
      active.push(t.getAttribute("data-trigger"));
    });
    r.triggers = active;
    saveLocal(data);
    editIdx = -1;
    document.getElementById("editModal").classList.add("hidden");
    renderAll();
    attemptSync();
  }

  // ====== 设置同步状态指示 ======
  function setSyncStatus(state) {
    var el = document.getElementById("syncStatus");
    el.className = "sync-status " + state;
  }

  // ====== Lucide 图标 ======
  function replaceIcons() {
    if (window.lucide && lucide.createIcons) {
      lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
      return;
    }
    document.querySelectorAll("[data-lucide]").forEach(function(el) {
      var name = el.getAttribute("data-lucide");
      if (!ICONS[name] || el.getAttribute("data-icon-ready") === "1") return;
      el.innerHTML = ICONS[name];
      el.setAttribute("data-icon-ready", "1");
    });
  }

  function deleteRemote(timestamps) {
    if (!getUser() || !timestamps.length) return Promise.resolve();
    queueDeletes(timestamps);
    setSyncStatus("syncing");
    return api("sync.php", { timestamps: timestamps }, "DELETE").then(function(r) {
      if (r.error) throw r.error;
      clearQueuedDeletes(timestamps);
      setSyncStatus("online");
      return r;
    }).catch(function(e) {
      setSyncStatus("offline");
      console.warn("sync delete fail:", e);
    });
  }

  // ====== 安装向导 ======
  var setupStep = 1;

  function showSetup() {
    document.getElementById("setupScreen").classList.remove("hidden");
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("app").classList.add("hidden");
  }

  function showAuth() {
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
  }

  function showApp() {
    document.getElementById("setupScreen").classList.add("hidden");
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
  }

  function goSetupStep(n) {
    setupStep = n;
    [1,2,3].forEach(function(i) {
      var el = document.getElementById("setupStep" + i);
      if (el) el.classList.toggle("hidden", i !== n);
      var dot = document.querySelector('.step-dot[data-step="' + i + '"]');
      if (dot) {
        dot.classList.toggle("active", i === n);
        dot.classList.toggle("done", i < n);
      }
    });
    document.getElementById("setupBack").style.display = n > 1 ? "inline-block" : "none";
    document.getElementById("setupNext").textContent = n === 3 ? "完成" : "下一步";
    document.getElementById("setupError").classList.add("hidden");
    document.getElementById("setupSubtitle").textContent =
      n === 1 ? "配置人机验证（可选，可留空）" :
      n === 2 ? "创建管理员账号" : "完成！";
  }

  function handleSetup() {
    var errEl = document.getElementById("setupError");
    errEl.classList.add("hidden");

    if (setupStep === 1) {
      var siteKey = document.getElementById("setupSiteKey").value.trim();
      var secretKey = document.getElementById("setupSecretKey").value.trim();
      if (siteKey && !secretKey) {
        errEl.textContent = "填写 Site Key 后也需要填写 Secret Key"; errEl.classList.remove("hidden"); return;
      }
      if (!siteKey && secretKey) {
        errEl.textContent = "填写 Secret Key 后也需要填写 Site Key"; errEl.classList.remove("hidden"); return;
      }
      goSetupStep(2);
      return;
    }

    if (setupStep === 2) {
      var email = document.getElementById("setupEmail").value.trim();
      var password = document.getElementById("setupPassword").value;
      if (!email || !password) {
        errEl.textContent = "请填写邮箱和密码"; errEl.classList.remove("hidden"); return;
      }
      if (password.length < 6) {
        errEl.textContent = "密码至少6位"; errEl.classList.remove("hidden"); return;
      }

      var btn = document.getElementById("setupNext");
      btn.disabled = true; btn.textContent = "处理中...";

      var siteKey = document.getElementById("setupSiteKey").value.trim();
      var secretKey = document.getElementById("setupSecretKey").value.trim();

      api("setup.php", {
        turnstile_site_key: siteKey || undefined,
        turnstile_secret: secretKey || undefined,
        email: email,
        password: password
      }).then(function(resp) {
        btn.disabled = false;
        if (resp.error) {
          errEl.textContent = resp.error; errEl.classList.remove("hidden"); return;
        }
        // 保存登录态
        var data = loadLocal();
        data.user = { email: resp.email, token: resp.token, user_id: resp.user_id };
        saveLocal(data);
        goSetupStep(3);
        document.getElementById("setupDoneMsg").textContent = "账号 " + resp.email + " 创建成功！即将进入...";
        setTimeout(function() {
          document.getElementById("settingsEmail").textContent = resp.email;
          showApp();
          renderAll();
          pullRecords();
          showWeeklyIfNeeded();
        }, 1000);
      }).catch(function() {
        btn.disabled = false; btn.textContent = "下一步";
        errEl.textContent = "网络错误，请重试"; errEl.classList.remove("hidden");
      });
      return;
    }
  }

  function handleLogin() {
    var email = document.getElementById("authEmail").value.trim();
    var password = document.getElementById("authPassword").value;
    var errEl = document.getElementById("authError");
    if (!email || !password) { errEl.textContent = "请填写邮箱和密码"; errEl.classList.remove("hidden"); return; }
    errEl.classList.add("hidden");
    var btn = document.getElementById("authSubmitBtn");
    btn.disabled = true; btn.textContent = "处理中...";

    // 获取 Turnstile token（如果有）
    var turnstileToken = "";
    var widgetEl = document.getElementById("turnstileWidget");
    if (window.turnstile && widgetEl && widgetEl.children.length > 0) {
      turnstileToken = turnstile.getResponse();
    }

    var isLogin = document.getElementById("tabLogin").classList.contains("active");
    var endpoint = isLogin ? "login.php" : "register.php";

    api(endpoint, { email: email, password: password, turnstile_token: turnstileToken }).then(function(resp) {
      btn.disabled = false; btn.textContent = isLogin ? "登录" : "注册";
      if (resp.error) {
        errEl.textContent = resp.error; errEl.classList.remove("hidden");
        if (window.turnstile) turnstile.reset();
        return;
      }
      var data = loadLocal();
      data.user = { email: resp.email, token: resp.token, user_id: resp.user_id };
      saveLocal(data);
      document.getElementById("settingsEmail").textContent = resp.email;
      showApp();
      renderAll();
      pullRecords().then(function() { renderAll(); });
    }).catch(function(e) {
      btn.disabled = false; btn.textContent = isLogin ? "登录" : "注册";
      errEl.textContent = "网络错误，请重试"; errEl.classList.remove("hidden");
    });
  }

  function logout() {
    var data = loadLocal();
    data.user = null;
    saveLocal(data);
    showAuth();
  }

  // ====== 初始化 ======
  function init() {
    var settings = getSettings();
    document.documentElement.setAttribute("data-theme", settings.theme);

    // 安装向导事件
    document.getElementById("setupNext").addEventListener("click", handleSetup);
    document.getElementById("setupBack").addEventListener("click", function() {
      if (setupStep > 1) goSetupStep(setupStep - 1);
    });
    document.getElementById("setupPassword").addEventListener("keydown", function(e) {
      if (e.key === "Enter" && setupStep === 2) handleSetup();
    });

    // 检查是否首次安装
    fetch("api/status.php").then(function(r) { return r.json(); }).then(function(status) {
      if (status.configured) {
        // 已有配置，正常显示登录
        var user = getUser();
        if (user && user.token) {
          document.getElementById("settingsEmail").textContent = user.email;
          showApp();
          renderAll();
          pullRecords().then(function() { renderAll(); });
          showWeeklyIfNeeded();
        } else {
          showAuth();
          // 动态渲染 Turnstile
          if (status.turnstile_site_key && window.turnstile) {
            setTimeout(function() {
              turnstile.render("#turnstileWidget", { sitekey: status.turnstile_site_key, theme: "auto" });
            }, 500);
          }
        }
      } else {
        // 首次安装
        showSetup();
        goSetupStep(1);
      }
    }).catch(function() {
      // 后端不可用时降级为纯前端模式
      var user = getUser();
      if (user && user.token) { showApp(); renderAll(); }
      else { showAuth(); }
    });

    // Auth tab
    document.getElementById("tabLogin").addEventListener("click", function() {
      document.querySelectorAll(".auth-tab").forEach(function(t) { t.classList.remove("active"); });
      this.classList.add("active");
      document.getElementById("authSubmitBtn").textContent = "登录";
      document.getElementById("authHint").textContent = "数据加密同步，保护隐私";
    });
    document.getElementById("tabRegister").addEventListener("click", function() {
      document.querySelectorAll(".auth-tab").forEach(function(t) { t.classList.remove("active"); });
      this.classList.add("active");
      document.getElementById("authSubmitBtn").textContent = "注册";
      document.getElementById("authHint").textContent = "注册即表示同意服务条款";
    });
    document.getElementById("authSubmitBtn").addEventListener("click", handleLogin);
    document.getElementById("authPassword").addEventListener("keydown", function(e) {
      if (e.key === "Enter") handleLogin();
    });
    document.getElementById("authEmail").addEventListener("keydown", function(e) {
      if (e.key === "Enter") document.getElementById("authPassword").focus();
    });

    // 打卡
    document.getElementById("checkInBtn").addEventListener("click", doCheckin);

    // 删除最近一条
    document.getElementById("deleteLastBtn").addEventListener("click", function() {
      var data = loadLocal();
      if (data.records.length > 0) {
        var removed = data.records.pop();
        saveLocal(data);
        renderAll();
        deleteRemote([removed.timestamp]);
      }
    });

    // 编辑最近一条
    document.getElementById("editLastBtn").addEventListener("click", function() {
      var records = getRecords();
      if (records.length > 0) openEdit(records.length - 1);
    });

    // 编辑弹窗
    document.querySelectorAll("#editTriggersGrid .trigger-tag").forEach(function(t) {
      t.addEventListener("click", function() { this.classList.toggle("active"); });
    });
    document.getElementById("editSave").addEventListener("click", saveEdit);
    document.getElementById("editCancel").addEventListener("click", function() {
      document.getElementById("editModal").classList.add("hidden"); editIdx = -1;
    });

    // 警告
    document.getElementById("warningConfirm").addEventListener("click", function() {
      document.getElementById("warningModal").classList.add("hidden");
    });

    // 周报
    document.getElementById("weeklyConfirm").addEventListener("click", function() {
      document.getElementById("weeklyModal").classList.add("hidden");
    });

    // 清空历史
    document.getElementById("clearHistoryBtn").addEventListener("click", function() {
      var data = loadLocal();
      var timestamps = data.records.map(function(r) { return r.timestamp; });
      data.records = [];
      saveLocal(data);
      renderAll();
      deleteRemote(timestamps);
    });

    // 设置
    document.getElementById("settingsBtn").addEventListener("click", function() {
      var s = getSettings();
      document.getElementById("darkModeToggle").checked = s.theme === "dark";
      document.getElementById("dailyThreshold").value = s.dailyThreshold;
      document.getElementById("weeklyThreshold").value = s.weeklyThreshold;
      document.getElementById("weeklyGoal").value = s.weeklyGoal;
      var u = getUser();
      document.getElementById("settingsEmail").textContent = u ? u.email : "";
      document.getElementById("settingsOverlay").classList.remove("hidden");
    });
    document.getElementById("settingsClose").addEventListener("click", function() {
      var s = {
        theme: document.getElementById("darkModeToggle").checked ? "dark" : "light",
        dailyThreshold: parseInt(document.getElementById("dailyThreshold").value) || 2,
        weeklyThreshold: parseInt(document.getElementById("weeklyThreshold").value) || 4,
        weeklyGoal: Math.max(parseInt(document.getElementById("weeklyGoal").value) || 0, 0),
        weeklyTs: getSettings().weeklyTs
      };
      setSettings(s);
      document.documentElement.setAttribute("data-theme", s.theme);
      document.getElementById("settingsOverlay").classList.add("hidden");
      renderAll();
    });
    document.getElementById("logoutBtn").addEventListener("click", logout);

    // 导出
    document.getElementById("exportBtn").addEventListener("click", function() {
      var data = loadLocal();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "手滑了_备份_" + todayStr() + ".json";
      a.click();
    });
    document.getElementById("importBtn").addEventListener("click", function() {
      document.getElementById("importFile").click();
    });
    document.getElementById("importFile").addEventListener("change", function(e) {
      if (!e.target.files.length) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var d = JSON.parse(ev.target.result);
          if (d.records) { saveLocal(d); renderAll(); alert("导入成功"); }
          else alert("格式不正确");
        } catch(ex) { alert("文件解析失败"); }
      };
      reader.readAsText(e.target.files[0]);
      e.target.value = "";
    });
    document.getElementById("clearDataBtn").addEventListener("click", function() {
      localStorage.removeItem(STORAGE_KEY);
      renderAll();
    });

    // 深色模式切换
    document.getElementById("darkModeToggle").addEventListener("change", function() {
      var theme = this.checked ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      var s = getSettings(); s.theme = theme; setSettings(s);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
