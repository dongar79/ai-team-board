/* 화면에서 함께 사용하는 상태와 시간 계산. */
(function () {
  "use strict";
  const board = window.AIOffice = {
    rows: new Map(), events: [], selected: null, eventsReady: false,
    demo: new URLSearchParams(location.search).get("demo") === "1",
    reserved: { gpt: true, gemini: true, aside: true },
    priority: { approval: 0, question: 1, report: 2, working: 3, idle: 4 },
    lateMs: 5 * 60000, staleMs: 12 * 3600000, workStaleMs: 20 * 60000,
    reportMs: 15 * 60000, loungeMs: 2 * 3600000,
    $: (id) => document.getElementById(id),
    time: (value) => { const date = Date.parse(value); return Number.isFinite(date) ? date : 0; },
    minutes: (ms) => Math.max(0, Math.floor(ms / 60000)),
    waiting: (row) => row.status === "question" || row.status === "approval",
    statusLabel: (status) => ({ working: "일하는 중", question: "질문 대기", approval: "결재 대기", report: "완료 보고", idle: "쉬는 중" }[status] || "상태 미확인"),
  };
  board.kind = (row) => Object.keys(board.reserved).find((kind) => row.agent === kind || row.agent.startsWith(kind + ":"))
    || (row.agent.startsWith("sub:") ? "sub" : "main");
  board.isReserved = (row) => !!board.reserved[board.kind(row)];
  board.since = (row) => board.time(row.status_since) || board.time(row.updated_at);
  board.elapsed = (row, now = Date.now()) => Math.max(0, now - board.since(row));
  // 무응답 판정은 마지막 기록(updated_at) 기준. 계속 기록이 오는 세션은 오래 일해도 '일하는 중' (10-30 총괄 수정)
  board.effective = (row, now = Date.now()) => row.status === "working"
      && now - (board.time(row.updated_at) || now) >= board.workStaleMs
    ? { ...row, status: "idle", unresponsive: true, task: "응답 없음 (20분 이상 기록 없음)" } : row;
  board.compare = (a, b) => board.priority[a.status] - board.priority[b.status] || board.since(a) - board.since(b) || a.agent.localeCompare(b.agent);
  board.liveRows = (now = Date.now()) => [...board.rows.values()]
    .filter((row) => !board.isReserved(row) && now - board.time(row.updated_at) < board.staleMs)
    .map((row) => board.effective(row, now)).sort(board.compare);
  board.reporting = (row, now = Date.now()) => board.kind(row) === "main" && row.status === "idle"
    && row.task === "답변 완료" && board.time(row.updated_at) > 0
    && now - board.time(row.updated_at) >= 0 && now - board.time(row.updated_at) < board.reportMs;
  board.groupColor = (name) => {
    let hash = 0;
    for (const letter of String(name || "컴퓨터")) hash = (Math.imul(hash, 31) + letter.codePointAt(0)) >>> 0;
    return `hsl(${hash % 360} 55% 38%)`;
  };
  board.threadTitle = (row) => row.title || row.project || "쓰레드 이름 미확인";
  const newest = (rows) => rows.reduce((latest, row) => board.time(row.updated_at) > board.time(latest.updated_at) ? row : latest, rows[0]);
  const thread = (main, assistants, now) => {
    const members = [main, ...assistants].map((row) => board.effective(row, now));
    const active = members.map((row) => board.reporting(row, now) ? { ...row, status: "report" } : row).sort(board.compare);
    const urgent = active[0], recent = newest(members);
    const helpers = members.slice(1).filter((row) => row.status !== "idle");
    return { ...main, rawStatus: main.status, status: urgent.status, task: urgent.task,
      status_since: urgent.status_since || urgent.updated_at, updated_at: recent.updated_at,
      assistants: helpers, assistantCount: helpers.length, busy: members.some((row) => row.status === "working"),
      unresponsive: members.every((row) => row.status === "idle") && members.some((row) => row.unresponsive),
      restSince: Math.max(...members.map((row) => row.unresponsive
        ? board.time(row.updated_at) + board.workStaleMs : board.since(row))) };
  };
  const aggregate = (agent, threads, groupName, host, now) => {
    const ordered = [...threads].sort(board.compare), urgent = ordered[0], recent = newest(ordered);
    const restSince = Math.max(...threads.map((row) => row.restSince || board.since(row)));
    return { ...urgent, agent, group_name: groupName, host, threads: ordered, hasRecords: true,
      updated_at: recent.updated_at, busyCount: threads.filter((row) => row.busy).length,
      assistantCount: threads.reduce((total, row) => total + row.assistantCount, 0),
      reportCount: threads.filter((row) => row.status === "report").length,
      restSince, loungeEligible: urgent.status === "idle" && now - restSince < board.loungeMs };
  };
  board.groupRows = (now = Date.now()) => {
    const rows = board.liveRows(now), mains = rows.filter((row) => board.kind(row) === "main");
    const helpers = new Map(), identity = (row, agent = row.agent) => JSON.stringify([row.host || "", agent]);
    const parents = new Map(mains.map((row) => [identity(row), row]));
    rows.filter((row) => board.kind(row) === "sub").forEach((row) => {
      const parentAgent = row.parent || "main:" + row.agent.split(":")[1], key = identity(row, parentAgent);
      if (!parents.has(key)) {
        // 부모 기록이 없어도 보조 캐릭터를 따로 만들지 않고 부모 업무로 묶는다.
        const parent = { ...row, agent: parentAgent, status: "idle", task: "부모 기록 확인 불가", title: "" };
        parents.set(key, parent);
      }
      if (!helpers.has(key)) helpers.set(key, []);
      helpers.get(key).push(row);
    });
    const groups = new Map();
    parents.forEach((main, key) => {
      const groupName = main.group_name || "컴퓨터", groupKey = JSON.stringify([main.host || "", groupName]);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(thread(main, helpers.get(key) || [], now));
    });
    return [...groups.entries()].map(([key, threads]) => {
      const [host, name] = JSON.parse(key);
      return aggregate("group:" + key, threads, name, host, now);
    }).sort(board.compare);
  };
  board.teamRows = (now = Date.now()) => Object.keys(board.reserved).map((agent) => {
    const candidates = [...board.rows.values()].filter((row) => board.kind(row) === agent
      && now - board.time(row.updated_at) < board.staleMs);
    const sessions = new Map();
    candidates.forEach((row) => {
      const key = JSON.stringify([row.host || "", row.session_id || row.agent]), previous = sessions.get(key);
      const delta = previous ? board.time(row.updated_at) - board.time(previous.updated_at) : 1;
      // 예전 단일 행과 세션별 행이 공존하면 최신 기록을, 같은 시각이면 세션별 행을 쓴다.
      if (!previous || delta > 0 || (delta === 0 && row.agent !== agent && previous.agent === agent)) sessions.set(key, row);
    });
    const rows = [...sessions.values()].map((row) => thread(row, [], now));
    if (!rows.length) return { agent, status: "idle", task: "", project: "", host: "", title: "",
      threads: [], busyCount: 0, assistantCount: 0, reportCount: 0, hasRecords: false, loungeEligible: false };
    return aggregate(agent, rows, "", [...new Set(rows.map((row) => row.host).filter(Boolean))].join(" · "), now);
  });
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
    const result = { orders: 0, approvals: 0, questions: 0, reports: 0, longest: 0 };
    const active = new Map();
    const finish = (entry, end) => {
      if (entry && entry.start <= now && end >= midnight) result.longest = Math.max(result.longest,
        Math.max(0, Math.min(now, end) - Math.max(midnight, entry.start)));
    };
    [...events].sort((a, b) => board.time(a.created_at) - board.time(b.created_at) || Number(a.id) - Number(b.id)).forEach((event) => {
      const at = board.time(event.created_at);
      if (!at || at > now) return;
      if (at >= midnight) {
        if (event.task === "지시 받음" && !String(event.note || "").trimStart().startsWith("<")) result.orders++;
        if (event.status === "approval") result.approvals++;
        if (event.status === "question") result.questions++;
        if (event.status === "idle" && event.task === "답변 완료" && board.kind(event) === "main") result.reports++;
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
