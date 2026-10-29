/* 그룹 카드와 쓰레드별 펼침 상태를 보존하고, 받은 문자열은 글자로만 표시한다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  const openGroups = new Set(), openThreads = new Set();
  const field = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className; element.textContent = text; return element;
  };
  const title = (row) => row.title || row.project || "제목 없는 쓰레드";
  const threadList = (row, location) => {
    const list = field("div", "thread-list", "");
    (row.threads || []).forEach((thread) => {
      const key = location + ":" + row.agent + ":" + thread.agent + ":" + (thread.host || "");
      const detail = field("details", "thread-row " + thread.status, "");
      detail.dataset.thread = thread.agent; detail.open = openThreads.has(key);
      const summary = field("summary", "thread-summary", "");
      summary.append(field("span", "thread-title", title(thread)),
        field("span", "thread-state", board.statusLabel(thread.status) + " · " + board.minutes(board.elapsed(thread)) + "분"
          + (thread.assistantCount ? " · 보조 " + thread.assistantCount + "명" : "")),
        field("span", "thread-preview", "지금: " + (thread.task || "쉬는 중")),
        field("span", "thread-preview", "지시: " + (thread.note || "기록 없음").slice(0, 60)));
      const content = field("div", "thread-content", "");
      content.append(field("p", "", "쓰레드: " + title(thread) + " · 폴더: " + (thread.project || "미확인") + " · PC: " + (thread.host || "미확인")),
        field("p", "", "지금: " + (thread.task || "쉬는 중")), field("p", "", "지시: " + (thread.note || "기록 없음")));
      if (board.roleKey(row) !== "main") content.append(field("p", "", "연결: " + board.sourceLabel(thread)));
      if (board.reviewLine) content.appendChild(field("p", "thread-review", board.reviewLine(thread)));
      if (thread.detail) content.appendChild(field("p", "thread-detail", thread.detail));
      if (board.makeResultLinks && (thread.detail || thread.link)) content.appendChild(board.makeResultLinks(thread));
      (thread.assistants || []).forEach((assistant) => content.append(field("p", "thread-assistant", "보조 · " + board.statusLabel(assistant.status) + " · " + (assistant.task || "쉬는 중"))));
      detail.append(summary, content);
      detail.addEventListener("toggle", () => { if (detail.open) openThreads.add(key); else openThreads.delete(key); });
      list.appendChild(detail);
    });
    return list;
  };
  board.renderPanels = (layout) => {
    const visible = [...layout.live, ...layout.team];
    const row = visible.find((item) => item.agent === board.selected) || layout.live[0] || layout.team.find((item) => item.status !== "idle");
    board.$("info-name").textContent = row ? board.displayName(row) + " · " + board.statusLabel(row.status) : "캐릭터나 담당 카드를 누르면 작업 내용이 보입니다";
    board.$("info-role").textContent = row ? "역할: " + board.role(row).panel + " · " + board.role(row).description : "";
    board.$("info-host").textContent = row ? "PC: " + (row.host || "이름 미확인") : "";
    board.$("info-project").textContent = row ? "쓰레드: " + title(row) + " · 폴더: " + (row.project || "미확인") : "";
    board.$("info-note").textContent = row ? "지시: " + (row.note || "기록 없음") : "";
    board.$("info-task").textContent = row ? "지금: 업무 " + (row.busyCount || 0) + "건 · " + (row.task || "쉬는 중") : "";
    const parent = row && row.parent ? board.rows.get(row.parent) : null;
    const origins = row ? [...new Set((row.threads || [row]).map(board.sourceLabel))] : [];
    board.$("info-origin").textContent = row && board.roleKey(row) !== "main" ? "연결: " + (origins.join(" · ") || board.sourceLabel(row))
      + (board.roleKey(row) === "aside" && !row.parent ? " · 로그 감지, 호출자 미확인" : "") : "";
    const delegated = row ? (row.threads || []).filter((thread) => thread.parent) : [];
    const parentNames = [...new Set(delegated.map((thread) => {
      const found = board.rows.get(thread.parent); return found ? title(found) : "쓰레드 확인 불가";
    }))];
    board.$("info-parent").textContent = row ? "맡긴 곳: " + (parentNames.length ? "Claude · " + parentNames.join(" · ")
      : row.parent ? "Claude · " + (parent ? title(parent) : "쓰레드 확인 불가") : "없음") : "";
    board.$("info-wait").textContent = row ? "경과 시간: " + (board.since(row) ? board.minutes(board.elapsed(row)) + "분" : "기록 없음") : "";
    board.$("info-wait").className = "info-wait" + (row && board.waiting(row) && board.elapsed(row) >= board.lateMs ? " late" : "");
    board.$("info-threads").replaceChildren();
    if (board.renderReviewer) board.renderReviewer(row);
    if (row) board.$("info-threads").append(field("h3", "threads-heading", "맡은 쓰레드 " + (row.threads || []).length + "개"), threadList(row, "정보"));
    const cards = board.$("sessions");
    const focused = document.activeElement && document.activeElement.dataset.session;
    cards.replaceChildren();
    const sessions = [...layout.live, ...layout.team.filter((item) => item.hasRecords)].sort(board.compare);
    board.$("session-count").textContent = sessions.length;
    sessions.forEach((item) => {
      const card = field("article", "session-card " + item.status + (board.selected === item.agent ? " selected" : ""), "");
      card.dataset.session = item.agent; card.style.setProperty("--group-color", board.groupColor(item.group_name || "컴퓨터"));
      const toggle = field("button", "card-toggle", "");
      toggle.type = "button"; toggle.dataset.session = item.agent;
      toggle.setAttribute("aria-expanded", String(openGroups.has(item.agent)));
      toggle.setAttribute("aria-label", board.displayName(item) + " 맡은 쓰레드 펼치기");
      const identity = field("span", "card-identity", ""), icon = field("span", "card-icon", "");
      icon.innerHTML = board.portrait(board.roleKey(item), true);
      identity.append(icon, field("span", "card-name", board.displayName(item)));
      const reports = (item.threads || []).filter((thread) => thread.status === "report").length;
      toggle.append(identity, field("span", "card-heading", (item.host || "PC 미확인") + " · 쓰레드 " + (item.threads || []).length + "개"),
        field("span", "card-state", board.statusLabel(item.status) + " · 업무 " + (item.busyCount || 0) + "건 · 완료 보고 " + reports),
        field("span", "card-task", "첫 업무: " + title((item.threads || []).find((thread) => thread.status === "working") || item)),
        field("span", "card-expand", openGroups.has(item.agent) ? "쓰레드 접기 ▴" : "쓰레드 펼치기 ▾"));
      toggle.addEventListener("click", () => {
        if (openGroups.has(item.agent)) openGroups.delete(item.agent); else openGroups.add(item.agent);
        board.select(item.agent);
      });
      const threads = field("div", "card-threads", ""); threads.hidden = !openGroups.has(item.agent);
      threads.appendChild(threadList(item, "카드")); card.append(toggle, threads); cards.appendChild(card);
      if (focused === item.agent) toggle.focus({ preventScroll: true });
    });
    if (!sessions.length) cards.appendChild(field("p", "empty", "최근 12시간 이내의 쓰레드가 없습니다"));
    const summary = board.summary(board.events, board.rows);
    board.$("summary").textContent = board.eventsError ? "오늘 요약 · 활동 기록을 확인할 수 없습니다" : board.eventsReady
      ? `오늘 · 지시 ${summary.orders} · 결재 ${summary.approvals} · 질문 ${summary.questions} · 완료 보고 ${summary.reports || 0} · 최장 대기 ${summary.longest}분`
      : "오늘 요약 · 활동 기록을 확인하고 있습니다";
    const timeline = board.$("timeline"); timeline.replaceChildren();
    const activities = board.activityRecords ? board.activityRecords() : board.events;
    activities.forEach((event) => {
      const time = new Date(event.created_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
      const review = event.activityKind === "review";
      const text = review ? `${time} 🔎 ${board.reviewerName(event.reviewer)} · ${event.kind} · ${event.verdict} · ${event.target} · ${event.summary}`
        : `${time} ● ${board.displayName(event)} · ${title(event).slice(0, 28)} · ${event.task || board.statusLabel(event.status)}`;
      const item = field("li", "activity" + (review ? " review" : ""), text);
      item.title = "쓰레드: " + (review ? event.target : title(event)) + " · PC: " + (event.host || "이름 미확인"); timeline.appendChild(item);
    });
    if (!activities.length) timeline.appendChild(field("li", "empty", board.eventsReady ? "최근 활동이 없습니다" : "활동 기록을 불러오는 중입니다"));
  };
})();
