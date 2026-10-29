/* 사무실 좌표는 배경과 같은 비율의 백분율이며 캐릭터 발끝을 나타낸다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  const SLOTS = {
    approval: [{ x: 20, y: 26 }, { x: 37, y: 26 }, { x: 54, y: 26 }, { x: 71, y: 26 }],
    desk: [{ x: 22, y: 43 }, { x: 49, y: 43 }, { x: 22, y: 57 }, { x: 49, y: 57 }, { x: 22, y: 71 }, { x: 49, y: 71 }],
    lounge: [{ x: 18, y: 96 }, { x: 38, y: 96 }, { x: 58, y: 96 }, { x: 78, y: 96 }],
    gpt: { x: 81, y: 43 }, gemini: { x: 81, y: 59 }, aside: { x: 81, y: 75 },
  };
  board.slots = SLOTS;
  board.layout = () => {
    const live = board.liveRows();
    const team = board.teamRows();
    const parents = new Set(team.filter((row) => ["gpt", "gemini"].includes(row.agent)).map((row) => row.parent));
    const placed = [], overflow = [];
    const put = (list, zone) => {
      // 카드에서 선택한 세션은 자리가 넘쳐도 그림에서 볼 수 있게 앞쪽에 배치한다.
      const rank = (row) => row.agent === board.selected ? 2 : Number(parents.has(row.agent));
      const ordered = [...list].sort((a, b) => rank(b) - rank(a));
      ordered.forEach((row, index) => {
        if (index < SLOTS[zone].length) placed.push({ row, pos: SLOTS[zone][index], zone });
        else overflow.push({ row, zone });
      });
    };
    put(live.filter((row) => row.status === "approval"), "approval");
    put(live.filter((row) => row.status === "working" || row.status === "question"
      || ((row.agent === board.selected || parents.has(row.agent)) && row.status === "idle" && row.agent.startsWith("sub:"))), "desk");
    put(live.filter((row) => row.status === "idle" && !row.agent.startsWith("sub:")), "lounge");
    team.forEach((row) => placed.push({ row, pos: SLOTS[row.agent], zone: row.agent }));
    return { live, team, placed, overflow };
  };
  board.renderOffice = (layout) => {
    const layer = board.$("chars");
    const seen = new Set();
    ["working", "question", "approval"].forEach((status) => {
      board.$("n-" + status).textContent = [...layout.live, ...layout.team].filter((row) => row.status === status).length;
    });
    layout.placed.forEach(({ row, pos }) => {
      seen.add(row.agent);
      let element = [...layer.querySelectorAll(".char")].find((item) => item.dataset.agent === row.agent);
      if (!element) {
        element = document.createElement("button");
        element.type = "button";
        element.dataset.agent = row.agent;
        element.innerHTML = '<span class="badge"><span></span></span><span class="head"></span><span class="body"></span><span class="name"></span>';
        element.addEventListener("click", () => board.select(row.agent));
        layer.appendChild(element);
      }
      const late = board.waiting(row) && board.elapsed(row) >= board.lateMs;
      element.className = "char " + row.status + (board.reserved[row.agent] ? " reserved" : "")
        + (late ? " late" : "") + (board.selected === row.agent ? " selected" : "");
      element.style.left = pos.x + "%";
      element.style.top = pos.y + "%";
      element.querySelector(".badge span").textContent = row.status === "approval" ? "!" : "?";
      element.querySelector(".name").textContent = board.shortName(row);
      element.title = board.displayName(row) + " · " + (row.project || "프로젝트 없음") + " · " + board.statusLabel(row.status);
      element.setAttribute("aria-label", element.title);
      element.setAttribute("aria-pressed", String(board.selected === row.agent));
    });
    layer.querySelectorAll(".char").forEach((element) => { if (!seen.has(element.dataset.agent)) element.remove(); });
    layer.querySelectorAll(".overflow").forEach((element) => element.remove());
    ["approval", "desk", "lounge"].forEach((zone) => {
      const count = layout.overflow.filter((item) => item.zone === zone).length;
      if (!count) return;
      const slot = SLOTS[zone][SLOTS[zone].length - 1];
      const tag = document.createElement("span");
      tag.className = "overflow";
      tag.textContent = "+" + count;
      tag.title = "아래 세션 카드에서 선택할 수 있습니다";
      tag.style.left = (slot.x + 10) + "%";
      tag.style.top = (slot.y - 4) + "%";
      layer.appendChild(tag);
    });
    const links = board.$("links");
    links.replaceChildren();
    layout.placed.filter(({ row }) => ["gpt", "gemini"].includes(row.agent) && row.parent).forEach(({ row, pos }) => {
      const parent = layout.placed.find((item) => item.row.agent === row.parent);
      if (!parent || board.reserved[parent.row.agent]) return;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", pos.x + "%"); line.setAttribute("y1", (pos.y - 5) + "%");
      line.setAttribute("x2", parent.pos.x + "%"); line.setAttribute("y2", (parent.pos.y - 5) + "%");
      line.dataset.agent = row.agent;
      links.appendChild(line);
    });
  };
})();
