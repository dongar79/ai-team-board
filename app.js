/* AI팀 사무실 — 상황판 로직
 * 데이터: Supabase agent_status (agent, status, task, project, session_id, updated_at)
 * agent 키: main:<세션8자> / sub:<세션8자>:<agent8자> / 예약 gpt, gemini, aside
 */
(function () {
  "use strict";
  const CFG = window.AI_OFFICE_CONFIG || {};
  const DEMO = new URLSearchParams(location.search).has("demo");
  const LATE_MS = 5 * 60 * 1000;          // 질문·결재 5분 넘으면 경고
  const STALE_MS = 12 * 60 * 60 * 1000;   // 12시간 넘은 행은 세션이 죽은 것으로 보고 숨김
  const WORK_STALE_MS = 20 * 60 * 1000;   // 20분 넘게 갱신 없는 working 은 '응답 없음' 으로 라운지
  const RESERVED = { gpt: "GPT", gemini: "Gemini", aside: "Aside" };

  // 사무실 좌표 (office.svg 390x440 기준, %). 발 끝 위치.
  const SLOTS = {
    approval: [{ x: 20, y: 44 }, { x: 31, y: 44 }, { x: 42, y: 44 }],          // 사장실 문 앞 복도
    desk: [{ x: 22, y: 69 }, { x: 64, y: 69 }, { x: 22, y: 90 }, { x: 64, y: 90 }], // 업무존 책상 4개
    lounge: [{ x: 61, y: 30 }, { x: 72, y: 30 }, { x: 83, y: 30 }, { x: 94, y: 30 }], // 라운지 소파
  };

  const $ = (id) => document.getElementById(id);
  const rows = new Map();   // agent → row
  let selected = null;
  let client = null;

  // ---------- 표시용 이름 ----------
  function displayName(row) {
    if (RESERVED[row.agent]) return RESERVED[row.agent];
    const proj = row.project ? " · " + row.project : "";
    if (row.agent.startsWith("sub:")) return "서브" + proj;
    return "Claude Code" + proj;
  }
  function shortName(row) {
    if (RESERVED[row.agent]) return RESERVED[row.agent];
    if (row.agent.startsWith("sub:")) return "서브";
    return row.project || "Claude";
  }
  function elapsedMs(row) { return Date.now() - new Date(row.updated_at).getTime(); }
  function minutes(ms) { return Math.max(0, Math.floor(ms / 60000)); }
  function statusLabel(s) { return { working: "일하는 중", question: "질문 대기", approval: "결재 대기", idle: "쉬는 중" }[s] || s; }

  // ---------- 배치 ----------
  function layout() {
    const all = [...rows.values()];
    // 20분 넘게 갱신 없는 working 은 세션이 강제 종료된 것으로 보고 '응답 없음' 으로 라운지에 둔다
    const live = all.filter((r) => !RESERVED[r.agent] && elapsedMs(r) < STALE_MS)
      .map((r) => (r.status === "working" && elapsedMs(r) > WORK_STALE_MS)
        ? Object.assign({}, r, { status: "idle", task: "응답 없음 (20분 이상 갱신 없음)" }) : r);
    const byTime = (a, b) => new Date(a.updated_at) - new Date(b.updated_at);
    const approval = live.filter((r) => r.status === "approval").sort(byTime);
    const desk = live.filter((r) => r.status === "working" || r.status === "question").sort(byTime);
    const idleMain = live.filter((r) => r.status === "idle" && r.agent.startsWith("main:")).sort(byTime).reverse();
    const placed = [];
    const overflow = [];
    const put = (list, slots, zone) => list.forEach((r, i) => {
      if (i < slots.length) placed.push({ row: r, pos: slots[i], zone });
      else overflow.push({ row: r, zone });
    });
    put(approval, SLOTS.approval, "approval");
    put(desk, SLOTS.desk, "desk");
    const loungeRows = idleMain.slice(0, 1).concat(Object.keys(RESERVED).map((k) => rows.get(k) || { agent: k, status: "idle", task: "", project: "", updated_at: 0 }));
    put(loungeRows, SLOTS.lounge, "lounge");
    return { placed, overflow, counts: {
      working: live.filter((r) => r.status === "working").length,
      question: live.filter((r) => r.status === "question").length,
      approval: approval.length } };
  }

  // ---------- 그리기 ----------
  function render() {
    const { placed, overflow, counts } = layout();
    $("n-working").textContent = counts.working;
    $("n-question").textContent = counts.question;
    $("n-approval").textContent = counts.approval;
    const layer = $("chars");
    const seen = new Set();
    placed.forEach(({ row, pos }) => {
      seen.add(row.agent);
      let el = layer.querySelector(`[data-agent="${CSS.escape(row.agent)}"]`);
      if (!el) {
        el = document.createElement("div");
        el.dataset.agent = row.agent;
        el.innerHTML = '<div class="badge"><span></span></div><div class="head"></div><div class="body"></div><div class="name"></div>';
        el.addEventListener("click", () => { selected = row.agent; render(); });
        layer.appendChild(el);
      }
      const late = (row.status === "approval" || row.status === "question") && elapsedMs(row) > LATE_MS;
      el.className = "char " + row.status + (RESERVED[row.agent] ? " reserved" : "") + (late ? " late" : "") + (selected === row.agent ? " selected" : "");
      el.style.left = pos.x + "%";
      el.style.top = pos.y + "%";
      el.querySelector(".badge span").textContent = row.status === "approval" ? "!" : "?";
      el.querySelector(".name").textContent = shortName(row);
      el.title = displayName(row) + " — " + statusLabel(row.status);
    });
    layer.querySelectorAll(".char").forEach((el) => { if (!seen.has(el.dataset.agent)) el.remove(); });
    layer.querySelectorAll(".overflow").forEach((el) => el.remove());
    ["approval", "desk"].forEach((zone) => {
      const n = overflow.filter((o) => o.zone === zone).length;
      if (!n) return;
      const slot = SLOTS[zone][SLOTS[zone].length - 1];
      const tag = document.createElement("div");
      tag.className = "overflow";
      tag.textContent = "+" + n;
      tag.style.left = (slot.x + 12) + "%";
      tag.style.top = (slot.y - 6) + "%";
      layer.appendChild(tag);
    });
    renderInfo(placed.map((p) => p.row).concat(overflow.map((o) => o.row)));
  }

  function renderInfo(visible) {
    let row = selected ? rows.get(selected) : null;
    if (!row || !visible.includes(row)) {
      // 선택이 없으면 가장 오래 기다린 결재/질문, 그다음 일하는 중
      const pri = { approval: 0, question: 1, working: 2, idle: 3 };
      row = visible.filter((r) => !RESERVED[r.agent]).sort((a, b) => pri[a.status] - pri[b.status] || new Date(a.updated_at) - new Date(b.updated_at))[0];
    }
    if (!row) {
      $("info-name").textContent = "지금 일하는 팀원이 없습니다";
      $("info-note").textContent = ""; $("info-task").textContent = ""; $("info-wait").textContent = ""; return;
    }
    const m = minutes(elapsedMs(row));
    $("info-name").textContent = displayName(row) + " · " + statusLabel(row.status);
    $("info-note").textContent = row.note ? "지시: " + row.note : "";
    $("info-task").textContent = row.task ? (row.status === "working" ? "지금: " : "") + row.task : "";
    const waitEl = $("info-wait");
    if (row.status === "approval" || row.status === "question") {
      waitEl.textContent = statusLabel(row.status) + " " + m + "분" + (m >= 5 ? " ⚠" : "");
      waitEl.className = "info-wait" + (m >= 5 ? " late" : "");
    } else {
      waitEl.textContent = m < 1 ? "방금 갱신" : m + "분 전 갱신";
      waitEl.className = "info-wait";
    }
  }

  function upsert(row) { if (row && row.agent) rows.set(row.agent, row); }

  // ---------- Supabase ----------
  let loadGen = 0;  // 늦게 끝난 옛 조회가 최신 결과를 덮지 않도록 (GPT 리뷰 10-29)
  async function loadAll() {
    const gen = ++loadGen;
    try {
      const { data, error } = await client.from("agent_status").select("*");
      if (gen !== loadGen) return;
      if (error) { setConn("off", "읽기 실패: " + error.message); return; }
      // Realtime 으로 더 새 행을 이미 받았으면 그쪽을 남긴다
      const fresh = new Map(rows);
      rows.clear();
      data.forEach((r) => {
        const had = fresh.get(r.agent);
        upsert(had && new Date(had.updated_at) > new Date(r.updated_at) ? had : r);
      });
      setConn("on", "읽기 성공 " + new Date().toLocaleTimeString());
      render();
    } catch (e) {
      if (gen === loadGen) setConn("off", "읽기 오류: " + (e && e.message));
    }
  }
  function subscribe() {
    client.channel("agent_status_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_status" }, (p) => {
        if (p.eventType === "DELETE") rows.delete(p.old.agent); else upsert(p.new);
        render();
      })
      .subscribe((status) => setConn(status === "SUBSCRIBED" ? "on" : "off", "실시간: " + status));
  }
  function setConn(state, title) { const d = $("conn"); d.className = "dot " + state; d.title = title || ""; }
  function notice(html) { const n = $("notice"); n.innerHTML = html; n.hidden = false; }

  // ---------- 데모 ----------
  function startDemo() {
    $("demo").hidden = false; setConn("demo", "데모 모드");
    const now = () => new Date().toISOString();
    upsert({ agent: "main:demo0001", status: "working", task: "Edit · app.js", project: "상황판", updated_at: now() });
    Object.keys(RESERVED).forEach((k) => upsert({ agent: k, status: "idle", task: "", project: "", updated_at: now() }));
    $("demo").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.old) {
        rows.forEach((r) => { if (r.status === "approval" || r.status === "question") r.updated_at = new Date(Date.now() - 7 * 60000).toISOString(); });
      } else {
        const tasks = { working: "Bash · npm test", question: "배포할까요?", approval: "Bash(rm -rf dist) 허가 요청", idle: "" };
        upsert({ agent: b.dataset.agent, status: b.dataset.status, task: tasks[b.dataset.status],
          project: b.dataset.agent.includes("demo0002") ? "경사로" : "상황판", updated_at: now() });
      }
      render();
    });
    render();
  }

  // ---------- 시작 ----------
  function start() {
    if (DEMO) return startDemo();
    if (!CFG.url || !CFG.anonKey || CFG.url.includes("xxxxxxxx")) {
      setConn("off", "설정 없음");
      notice("web/config.js 에 Supabase URL 과 anon 키를 넣어 주세요. 먼저 화면만 보려면 <a href=\"?demo=1\">데모 모드</a>.");
      return;
    }
    if (!window.supabase) { setConn("off"); notice("Supabase 라이브러리를 불러오지 못했습니다 (인터넷 연결 확인)."); return; }
    client = window.supabase.createClient(CFG.url, CFG.anonKey);
    loadAll(); subscribe();
    setInterval(loadAll, 30000);                       // 실시간이 끊겨도 30초마다 보정
    document.addEventListener("visibilitychange", () => { if (!document.hidden) loadAll(); });
  }
  setInterval(render, 10000);                            // 경과 시간·5분 경고 갱신

  // ---------- 화면 켜둠 (Screen Wake Lock) ----------
  // 휴대폰이 자동으로 꺼지지 않게 한다. 기본 켜짐, 헤더 버튼으로 끌 수 있다. 설정은 이 휴대폰에만 저장.
  let wakeLock = null, wakeWanted = true;
  const wakeBtn = $("wake");
  function paintWake() {
    if (!wakeBtn) return;
    if (!("wakeLock" in navigator)) { wakeBtn.textContent = "켜둠 불가"; wakeBtn.disabled = true; wakeBtn.title = "이 브라우저는 화면 켜둠을 지원하지 않습니다"; return; }
    wakeBtn.textContent = wakeLock ? "화면 켜둠 ●" : "화면 켜둠 ○";
    wakeBtn.classList.toggle("on", !!wakeLock);
    wakeBtn.title = wakeLock ? "화면이 꺼지지 않습니다. 누르면 해제" : "누르면 화면이 꺼지지 않게 합니다";
  }
  async function acquireWake() {
    if (!("wakeLock" in navigator) || wakeLock || document.hidden) { paintWake(); return; }
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; paintWake(); });
    } catch (e) { wakeLock = null; }
    paintWake();
  }
  function releaseWake() { if (wakeLock) wakeLock.release().catch(() => {}); wakeLock = null; paintWake(); }
  try { wakeWanted = localStorage.getItem("ai-office-wake") !== "0"; } catch (e) { /* 저장 못 해도 동작 */ }
  if (wakeBtn) wakeBtn.addEventListener("click", () => {
    wakeWanted = !wakeLock;
    try { localStorage.setItem("ai-office-wake", wakeWanted ? "1" : "0"); } catch (e) { /* 무시 */ }
    if (wakeWanted) acquireWake(); else releaseWake();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && wakeWanted) acquireWake(); });
  document.addEventListener("pointerdown", () => { if (wakeWanted && !wakeLock) acquireWake(); }); // iOS 는 터치 뒤에만 허용
  paintWake();
  if (wakeWanted) acquireWake();
  if ("serviceWorker" in navigator && !DEMO && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  start();
})();
