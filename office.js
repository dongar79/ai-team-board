/* 그룹 담당자 배치와 위임 관계를 그린다. 좌표는 캐릭터 발끝 기준이다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  const SLOTS = {
    approval: [{ x: 17, y: 21.25 }, { x: 39, y: 21.25 }, { x: 61, y: 21.25 }, { x: 83, y: 21.25 }],
    desk: [{ x: 22, y: 35.1 }, { x: 49, y: 35.1 }, { x: 22, y: 46.5 }, { x: 49, y: 46.5 }, { x: 22, y: 57.9 }, { x: 49, y: 57.9 }],
    lounge: [{ x: 20, y: 80 }, { x: 50, y: 80 }, { x: 80, y: 80 }, { x: 20, y: 94 }, { x: 50, y: 94 }, { x: 80, y: 94 }],
    gpt: { x: 81, y: 36.6 }, gemini: { x: 81, y: 49.6 }, aside: { x: 81, y: 62.6 },
  };
  board.slots = SLOTS;
  board.layout = () => {
    const live = board.groupRows(), team = board.teamRows();
    const placed = [], overflow = [];
    const parentIds = new Set(team.flatMap((row) => (row.threads || []).map((thread) => thread.parent).filter(Boolean)));
    const linked = (row) => (row.threads || []).some((thread) => parentIds.has(thread.agent));
    const put = (list, zone, ordered = false) => {
      const rank = (row) => row.agent === board.selected ? 2 : Number(linked(row));
      const rows = ordered ? list : [...list].sort((a, b) => rank(b) - rank(a) || board.compare(a, b));
      rows.forEach((row, index) => {
        if (index < SLOTS[zone].length) placed.push({ row, pos: SLOTS[zone][index], zone });
        else overflow.push({ row, zone });
      });
    };
    // 결재·질문·보고의 우선순위는 카드 선택으로 바뀌지 않는다.
    put(live.filter((row) => ["approval", "question", "report"].includes(row.status)).sort(board.compare), "approval", true);
    put(live.filter((row) => row.status === "working"), "desk");
    put(live.filter((row) => row.status === "idle" && row.loungeEligible)
      .sort((a, b) => board.time(b.updated_at) - board.time(a.updated_at)), "lounge", true);
    team.forEach((row) => placed.push({ row, pos: SLOTS[board.roleKey(row)], zone: board.roleKey(row) }));
    return { live, team, placed, overflow };
  };
  board.renderOffice = (layout) => {
    const layer = board.$("chars");
    if (!board.$("boss").firstChild) board.$("boss").innerHTML = board.bossPortrait();
    const seen = new Set();
    ["working", "question", "approval", "report"].forEach((status) => {
      board.$("n-" + status).textContent = [...layout.live, ...layout.team].filter((row) => row.status === status).length;
    });
    layout.placed.forEach(({ row, pos, zone }) => {
      seen.add(row.agent);
      let element = [...layer.querySelectorAll(".char")].find((item) => item.dataset.agent === row.agent);
      if (!element) {
        element = document.createElement("button");
        element.type = "button"; element.dataset.agent = row.agent;
        element.innerHTML = '<span class="badge"><span></span></span><span class="work-badge"></span>' + board.portrait(board.roleKey(row))
          + '<span class="name"><span class="role-name"></span><span class="project-name"></span><span class="report-label"></span></span>'
          + '<span class="review-badge" hidden></span>';
        element.addEventListener("click", () => {
          const agent = element.dataset.agent;
          board.select(agent);
          const latest = [...board.groupRows(), ...board.teamRows()].find((item) => item.agent === agent);
          if (latest) board.showBubble(latest);
        });
        layer.appendChild(element);
      }
      const busy = row.busyCount || 0, late = board.waiting(row) && board.elapsed(row) >= board.lateMs;
      const seed = [...row.agent].reduce((sum, char) => (sum * 31 + char.codePointAt(0)) >>> 0, 0);
      element.className = "char " + row.status + (board.roleKey(row) !== "main" ? " reserved" : "")
        + " busy-" + Math.min(busy, 4) + " rest-" + ["sit", "coffee", "walk"][seed % 3]
        + (late ? " late" : "") + (row.unresponsive ? " unresponsive" : "") + (board.selected === row.agent ? " selected" : "");
      element.dataset.role = board.roleKey(row); element.dataset.zone = zone; element.dataset.busy = busy;
      element.style.left = pos.x + "%"; element.style.top = pos.y + "%";
      element.style.setProperty("--rest-delay", -(seed % 1700) / 100 + "s");
      element.style.setProperty("--group-color", board.groupColor(row.group_name || "컴퓨터"));
      element.querySelector(".badge span").textContent = { approval: "!", question: "?", report: "✓", working: "●", idle: "·" }[row.status];
      element.querySelector(".work-badge").textContent = "업무 " + busy + (busy >= 4 ? " 🔥" : "");
      element.querySelector(".role-name").textContent = board.shortName(row);
      element.querySelector(".project-name").textContent = row.host || "PC 미확인";
      element.querySelector(".report-label").textContent = row.status === "report" ? "완료 보고" : "";
      const reviewBadge = element.querySelector(".review-badge");
      reviewBadge.hidden = !["gpt", "gemini", "aside"].includes(board.roleKey(row));
      if (!reviewBadge.hidden && board.reviewBadge) {
        const result = board.reviewBadge(board.roleKey(row));
        reviewBadge.className = "review-badge " + result.state; reviewBadge.textContent = result.text; reviewBadge.title = result.title;
      }
      element.title = board.displayName(row) + " · " + (row.host || "PC 미확인") + " · " + board.statusLabel(row.status) + " · 업무 " + busy + "건";
      if (!reviewBadge.hidden) element.title += " · 점검 " + reviewBadge.textContent;
      element.setAttribute("aria-label", element.title); element.setAttribute("aria-pressed", String(board.selected === row.agent));
    });
    layer.querySelectorAll(".char").forEach((element) => { if (!seen.has(element.dataset.agent)) element.remove(); });
    layer.querySelectorAll(".overflow").forEach((element) => element.remove());
    const links = board.$("links"); links.replaceChildren();
    layout.placed.filter(({ row }) => ["gpt", "gemini", "aside"].includes(board.roleKey(row))).forEach(({ row, pos }) => {
      const parents = new Set((row.threads || [row]).map((thread) => thread.parent).filter(Boolean));
      const linked = new Set();
      parents.forEach((parentId) => {
        const parent = layout.placed.find((item) => (item.row.threads || []).some((thread) => thread.agent === parentId || (thread.assistants || []).some((assistant) => assistant.agent === parentId)));
        if (!parent || board.roleKey(parent.row) !== "main" || linked.has(parent.row.agent)) return;
        linked.add(parent.row.agent);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", pos.x + "%"); line.setAttribute("y1", (pos.y - 4) + "%");
        line.setAttribute("x2", parent.pos.x + "%"); line.setAttribute("y2", (parent.pos.y - 4) + "%");
        line.dataset.agent = row.agent; links.appendChild(line);
      });
    });
    board.positionBubble();
  };
})();
