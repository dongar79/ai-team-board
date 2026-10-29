/* 선택 정보, 세션 카드와 활동 기록. 받은 문자열은 글자로만 표시한다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  const field = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className; element.textContent = text; return element;
  };
  board.renderPanels = (layout) => {
    const visible = [...layout.live, ...layout.team];
    const row = visible.find((item) => item.agent === board.selected) || layout.live[0] || layout.team.find((item) => item.status !== "idle");
    board.$("info-name").textContent = row ? board.displayName(row) + " · " + (row.project || "프로젝트 없음") + " · " + board.statusLabel(row.status) : "캐릭터나 세션 카드를 누르면 작업 내용이 보입니다";
    board.$("info-host").textContent = row ? "PC: " + (row.host || "이름 미확인") : "";
    board.$("info-note").textContent = row ? "지시: " + (row.note || "기록 없음") : "";
    board.$("info-task").textContent = row ? "지금: " + (row.task || "쉬는 중") : "";
    const parent = row && row.parent ? board.rows.get(row.parent) : null;
    board.$("info-parent").textContent = row && row.parent ? "맡긴 곳: Claude · " + (parent ? parent.project || "프로젝트 없음" : "프로젝트 확인 불가") : "";
    board.$("info-wait").textContent = row ? (board.waiting(row) ? "대기 " : "상태 경과 ") + board.minutes(board.elapsed(row)) + "분" : "";
    board.$("info-wait").className = "info-wait" + (row && board.waiting(row) && board.elapsed(row) >= board.lateMs ? " late" : "");
    const cards = board.$("sessions");
    const focused = document.activeElement && document.activeElement.dataset.session;
    cards.replaceChildren();
    board.$("session-count").textContent = layout.live.length;
    layout.live.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button"; card.className = "session-card " + item.status + (board.selected === item.agent ? " selected" : "");
      card.dataset.session = item.agent;
      card.setAttribute("aria-pressed", String(board.selected === item.agent));
      card.append(field("span", "card-heading", (item.host || "PC 미확인") + " · " + (item.project || "프로젝트 없음")),
        field("span", "card-state", board.displayName(item) + " · " + board.statusLabel(item.status) + " · " + board.minutes(board.elapsed(item)) + "분"),
        field("span", "card-note", "지시: " + (item.note || "기록 없음")),
        field("span", "card-task", "지금: " + (item.task || "쉬는 중")));
      card.addEventListener("click", () => board.select(item.agent));
      cards.appendChild(card);
      if (focused === item.agent) card.focus({ preventScroll: true });
    });
    if (!layout.live.length) cards.appendChild(field("p", "empty", "최근 12시간 이내의 세션이 없습니다"));
    const summary = board.summary(board.events, board.rows);
    board.$("summary").textContent = board.eventsError ? "오늘 요약 · 활동 기록을 확인할 수 없습니다" : board.eventsReady
      ? `오늘 · 지시 ${summary.orders} · 결재 ${summary.approvals} · 질문 ${summary.questions} · 최장 대기 ${summary.longest}분`
      : "오늘 요약 · 활동 기록을 확인하고 있습니다";
    const timeline = board.$("timeline");
    timeline.replaceChildren();
    [...board.events].sort((a, b) => board.time(b.created_at) - board.time(a.created_at) || Number(b.id) - Number(a.id)).slice(0, 20).forEach((event) => {
      const time = new Date(event.created_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
      const item = field("li", "activity", `${time} ${board.displayName(event)} · ${event.project || "프로젝트 없음"} · ${event.task || board.statusLabel(event.status)}`);
      item.title = event.host ? "PC: " + event.host : "PC 이름 미확인";
      timeline.appendChild(item);
    });
    if (!board.events.length) timeline.appendChild(field("li", "empty", board.eventsReady ? "최근 활동이 없습니다" : "활동 기록을 불러오는 중입니다"));
  };
})();
