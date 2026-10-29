/* 화면에서 함께 사용하는 상태와 시간 계산. */
(function () {
  "use strict";
  const board = window.AIOffice = {
    rows: new Map(), events: [], selected: null, eventsReady: false,
    demo: new URLSearchParams(location.search).get("demo") === "1",
    reserved: { gpt: true, gemini: true, aside: true },
    priority: { approval: 0, question: 1, working: 2, idle: 3 },
    lateMs: 5 * 60000, staleMs: 12 * 3600000, workStaleMs: 20 * 60000,
    $: (id) => document.getElementById(id),
    time: (value) => { const date = Date.parse(value); return Number.isFinite(date) ? date : 0; },
    minutes: (ms) => Math.max(0, Math.floor(ms / 60000)),
    waiting: (row) => row.status === "question" || row.status === "approval",
    statusLabel: (status) => ({ working: "일하는 중", question: "질문 대기", approval: "결재 대기", idle: "쉬는 중" }[status] || "상태 미확인"),
  };
  board.since = (row) => board.time(row.status_since) || board.time(row.updated_at);
  board.elapsed = (row, now = Date.now()) => Math.max(0, now - board.since(row));
  // 무응답 판정은 마지막 기록(updated_at) 기준. 계속 기록이 오는 세션은 오래 일해도 '일하는 중' (10-30 총괄 수정)
  board.effective = (row, now = Date.now()) => row.status === "working"
      && now - (board.time(row.updated_at) || now) >= board.workStaleMs
    ? { ...row, status: "idle", unresponsive: true, task: "응답 없음 (20분 이상 기록 없음)" } : row;
  board.compare = (a, b) => board.priority[a.status] - board.priority[b.status] || board.since(a) - board.since(b) || a.agent.localeCompare(b.agent);
  board.liveRows = (now = Date.now()) => [...board.rows.values()]
    .filter((row) => !board.reserved[row.agent] && now - board.time(row.updated_at) < board.staleMs)
    .map((row) => board.effective(row, now)).sort(board.compare);
  board.teamRows = () => Object.keys(board.reserved).map((agent) => board.effective(board.rows.get(agent)
    || { agent, status: "idle", task: "", project: "", host: "" }));
  board.upsert = (row) => {
    if (!row || typeof row.agent !== "string") return;
    const old = board.rows.get(row.agent);
    if (!old || board.time(row.updated_at) >= board.time(old.updated_at)) board.rows.set(row.agent, row);
  };
  board.koreanMidnight = (now = Date.now()) => {
    const shifted = new Date(now + 9 * 3600000);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 9 * 3600000;
  };
  board.summary = (events, rows, now = Date.now()) => {
    const midnight = board.koreanMidnight(now);
    const result = { orders: 0, approvals: 0, questions: 0, longest: 0 };
    const active = new Map();
    const finish = (entry, end) => {
      if (entry && entry.start <= now && end >= midnight) result.longest = Math.max(result.longest,
        Math.max(0, Math.min(now, end) - Math.max(midnight, entry.start)));
    };
    [...events].sort((a, b) => board.time(a.created_at) - board.time(b.created_at) || Number(a.id) - Number(b.id)).forEach((event) => {
      const at = board.time(event.created_at);
      if (!at || at > now) return;
      if (at >= midnight) {
        if (event.task === "지시 받음") result.orders++;
        if (event.status === "approval") result.approvals++;
        if (event.status === "question") result.questions++;
      }
      const previous = active.get(event.agent);
      if (previous && previous.status !== event.status) { finish(previous, at); active.delete(event.agent); }
      if (board.waiting(event) && !active.has(event.agent)) active.set(event.agent, { status: event.status, start: at });
    });
    active.forEach((entry, agent) => {
      const row = rows.get(agent);
      finish(entry, row && row.status !== entry.status ? board.since(row) : now);
    });
    rows.forEach((row) => { if (board.waiting(row)) finish({ start: board.since(row) }, now); });
    result.longest = board.minutes(result.longest);
    return result;
  };
  board.select = (agent) => { board.selected = agent; board.render(); };
  board.setConn = (state, title) => { const dot = board.$("conn"); dot.className = "dot " + state; dot.title = title || ""; };
  board.notice = (text) => { board.$("notice").textContent = text; board.$("notice").hidden = !text; };
})();
