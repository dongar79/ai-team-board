/* 직급표와 인라인 도형은 사무실·정보 패널·세션 카드가 함께 사용한다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  const ROLES = Object.freeze({
    main: { rank: "팀장", label: "팀장 · Claude", panel: "팀장 · Claude Code", color: "#d97757",
      description: "총괄 — 지시를 받아 나누고, 맡기고, 검토해 보고" },
    sub: { rank: "사원", label: "사원 · 서브", panel: "사원 · 서브", color: "#8dcced",
      description: "팀장이 띄운 보조 작업" },
    gpt: { rank: "선임 개발자", label: "개발 · GPT", panel: "개발 · GPT", color: "#225b45",
      description: "큰 코드 작성·대량 읽기", source: "Codex 앱" },
    gemini: { rank: "검토관", label: "검토 · Gemini", panel: "검토 · Gemini", color: "#293f68",
      description: "교차 검토·두 번째 의견", source: "Gemini 앱" },
    aside: { rank: "웹 담당", label: "웹 · Aside", panel: "웹 · Aside", color: "#8261ad",
      description: "웹 화면 작업·로그인·조회", source: "Aside" },
  });
  board.roles = ROLES;
  board.roleKey = (row) => board.kind(row);
  board.role = (row) => ROLES[board.roleKey(row)];
  board.displayName = (row) => board.roleKey(row) === "main" ? (row.group_name || "컴퓨터") + " 담당" : board.role(row).label;
  board.shortName = board.displayName;
  board.sourceLabel = (row) => row.parent ? "Claude 가 맡김" : "직접 사용(" + (board.role(row).source || "Claude Code") + ")";
  // 모든 색과 소품은 고정 도형이다. 외부에서 받은 문자열을 SVG에 넣지 않는다.
  board.portrait = (key, small = false) => {
    const role = ROLES[key] || ROLES.main;
    const clothes = `<path d="M11 33Q11 27 18 26H30Q37 27 37 33L39 49H9Z" fill="${role.color}" stroke="#30404a" stroke-width="1.3"/>`;
    const details = {
      main: '<path d="M20 27L24 34L28 27" fill="#fff7ed"/><path class="group-tie" d="M23 31H25L26 42L24 45L22 42Z" fill="#643d36"/>'
        + '<path d="M17 28L19 41H29L31 28" fill="none" stroke="#f4d087" stroke-width="1.3"/><rect class="group-card" x="20" y="39" width="9" height="9" rx="1" fill="#fff7ed"/>'
        + '<path d="M12 17V13A12 12 0 0 1 36 13V22" fill="none" stroke="#374151" stroke-width="2.5"/><rect x="10" y="15" width="4" height="8" rx="2" fill="#374151"/>'
        + '<rect x="34" y="15" width="4" height="8" rx="2" fill="#374151"/><path d="M36 22L30 25" stroke="#374151" stroke-width="2"/>',
      sub: '<path d="M19 27L24 32L29 27" fill="#e9f8ff"/><path d="M24 32V46" stroke="#519abb"/>'
        + '<path d="M28 34H40V48H27Z" fill="#d1a561" stroke="#846638"/><path d="M28 32H34L36 35H28" fill="#e5bf81"/>',
      gpt: '<path d="M16 27Q24 38 32 27M20 32V39M28 32V39" fill="none" stroke="#99c7ac" stroke-width="1.4"/>'
        + '<rect x="14" y="14" width="9" height="7" rx="2" fill="none" stroke="#23313d" stroke-width="1.8"/><rect x="25" y="14" width="9" height="7" rx="2" fill="none" stroke="#23313d" stroke-width="1.8"/>'
        + '<path d="M23 17H25" stroke="#23313d"/><rect x="11" y="36" width="27" height="15" rx="2" fill="#aebfc4" stroke="#354c54"/><path d="M8 51H41" stroke="#354c54" stroke-width="2"/><circle cx="25" cy="43" r="2" fill="#e3eff2"/>',
      gemini: '<path d="M20 27L24 35L28 27" fill="#f7f7ed"/><path d="M24 35V48" stroke="#9babc9"/>'
        + '<rect x="9" y="34" width="14" height="16" rx="1" fill="#eadcc0" stroke="#8a795b"/><rect x="13" y="32" width="6" height="4" rx="1" fill="#77899c"/>'
        + '<path d="M12 40H20M12 44H20" stroke="#a69476"/><circle cx="35" cy="33" r="6" fill="#d8f0f8" fill-opacity=".8" stroke="#50617a" stroke-width="2"/><path d="M39 38L44 44" stroke="#50617a" stroke-width="3"/>',
      aside: '<path d="M19 27L24 33L29 27M24 33V49" fill="none" stroke="#cfbde6" stroke-width="1.5"/>'
        + '<circle cx="31" cy="37" r="6" fill="#d9f1f4" stroke="#476f92"/><ellipse cx="31" cy="37" rx="2.8" ry="6" fill="none" stroke="#476f92"/><path d="M25 37H37" stroke="#476f92"/>',
    };
    return `<svg class="portrait${small ? " small" : ""}" viewBox="0 0 48 60" aria-hidden="true" focusable="false">`
      + '<ellipse class="status-ring" cx="24" cy="55" rx="20" ry="3.5"/>'
      + `<g class="person"${key === "sub" ? ' transform="translate(3 7) scale(.87)"' : ""}>`
      + '<path d="M17 46V53M31 46V53" stroke="#334155" stroke-width="6" stroke-linecap="round"/>' + clothes
      + '<circle cx="24" cy="16" r="11" fill="#f0ceb0" stroke="#6f574a" stroke-width="1.3"/>'
      + '<path d="M13 14Q13 2 24 4Q35 3 35 14Q28 12 24 9Q20 13 13 14" fill="#54443b"/>'
      + '<path d="M20 17V18M28 17V18" stroke="#40362e" stroke-width="1.6" stroke-linecap="round"/><path d="M21 23Q24 25 27 23" fill="none" stroke="#a66d5b"/>'
      + details[key || "main"]
      + '<g class="hands" fill="#f0ceb0" stroke="#6f574a"><ellipse class="hand-left" cx="14" cy="42" rx="4" ry="2.4"/><ellipse class="hand-right" cx="34" cy="42" rx="4" ry="2.4"/></g>'
      + '<path class="sweat" d="M40 10Q33 20 40 20Q47 20 40 10" fill="#70bedc"/>'
      + '<g class="steam" stroke="#a2adb5" fill="none" stroke-width="2"><path d="M13 0Q8 -4 13 -8M24 0Q19 -4 24 -8M35 0Q30 -4 35 -8"/></g>'
      + '<g class="coffee"><path d="M36 40H44V47H36Z" fill="#fff4d7" stroke="#805e38"/><path d="M44 41Q50 44 44 46" fill="none" stroke="#805e38"/></g>'
      + '</g><g class="papers" stroke="#ad9678" fill="#fff9e9"><path d="M0 49H14V53H0ZM1 45H15V49H1Z"/><path class="paper-high" d="M0 41H14V45H0ZM2 37H16V41H2ZM1 33H15V37H1Z"/></g></svg>';
  };
  board.bossPortrait = () => '<svg viewBox="0 0 48 65" role="img" aria-label="사장님" focusable="false">'
    + '<rect x="8" y="14" width="32" height="37" rx="8" fill="#775c45" stroke="#543e2d"/>'
    + '<path d="M13 33Q13 27 21 27H27Q35 27 35 33L37 52H11Z" fill="#344258"/>'
    + '<path d="M20 28L24 36L28 28" fill="#fff"/><path d="M24 34L21 44L24 48L27 44Z" fill="#d0a344"/>'
    + '<circle cx="24" cy="17" r="11" fill="#f0ceb0" stroke="#6f574a"/>'
    + '<path d="M13 15Q13 3 24 5Q35 4 35 14L28 10L20 13Z" fill="#484844"/>'
    + '<path d="M20 18V19M28 18V19M21 24H27" stroke="#58473b" stroke-width="1.4"/>'
    + '<rect x="6" y="49" width="36" height="13" rx="2" fill="#e8c36b" stroke="#ae8230"/>'
    + '<text x="24" y="59" text-anchor="middle" font-size="9" font-weight="700" fill="#5f451b">사장</text></svg>';
  let bubbleTimer = null, bubbleFrame = 0;
  board.hideBubble = () => {
    clearTimeout(bubbleTimer); bubbleTimer = null;
    cancelAnimationFrame(bubbleFrame);
    board.bubbleAgent = null; board.$("task-bubble").hidden = true;
  };
  board.positionBubble = () => {
    const bubble = board.$("task-bubble");
    if (!board.bubbleAgent || bubble.hidden) return;
    const character = [...board.$("chars").querySelectorAll(".char")].find((item) => item.dataset.agent === board.bubbleAgent);
    if (!character) { board.hideBubble(); return; }
    const office = board.$("office").getBoundingClientRect(), rect = character.getBoundingClientRect();
    const left = Math.max(6, Math.min(office.width - bubble.offsetWidth - 6, rect.left - office.left + rect.width / 2 - bubble.offsetWidth / 2));
    bubble.style.left = left + "px";
    bubble.style.top = Math.max(5, rect.top - office.top - bubble.offsetHeight - 6) + "px";
  };
  board.showBubble = (row) => {
    clearTimeout(bubbleTimer);
    cancelAnimationFrame(bubbleFrame);
    const bubble = board.$("task-bubble");
    const first = (row.threads || []).find((thread) => thread.status === "working") || (row.threads || [])[0];
    bubble.textContent = "업무 " + (row.busyCount || 0) + "건 · " + (first ? (first.title || first.project || "쓰레드") + " · " + (first.task || "쉬는 중") : row.task || "쉬는 중");
    bubble.hidden = false;
    board.bubbleAgent = row.agent; board.positionBubble();
    // 선택 때문에 자리가 이동하는 동안에도 말풍선이 캐릭터를 따라간다.
    const follow = () => {
      if (!board.bubbleAgent) return;
      board.positionBubble(); bubbleFrame = requestAnimationFrame(follow);
    };
    bubbleFrame = requestAnimationFrame(follow);
    bubbleTimer = setTimeout(board.hideBubble, 5000);
  };
  document.addEventListener("click", (event) => { if (!event.target.closest(".char")) board.hideBubble(); });
  window.addEventListener("resize", board.positionBubble);
})();
