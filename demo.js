/* 실제 저장소나 알림을 사용하지 않는 예시 데이터. */
(function () {
  "use strict";
  const board = window.AIOffice;
  board.startDemo = () => {
    board.$("demo").hidden = false; board.eventsReady = true;
    board.setConn("demo", "데모 · 실제 연결 없음");
    const now = Date.now();
    const ago = (minutes) => new Date(now - minutes * 60000).toISOString();
    const add = (agent, status, project, host, task, note, age, parent = "") => board.upsert({
      agent, status, project, host, task, note, parent, updated_at: ago(0), status_since: ago(age),
    });
    add("main:demo0001", "working", "상황판", "개발-PC", "사무실 화면 정리", "팀 배치와 활동 기록을 완성해 주세요", 3);
    add("main:demo0002", "approval", "경사로", "사무실-PC", "최종 문서 확인 요청", "최종 문서를 검토해 주세요", 12);
    add("main:demo0003", "question", "임대관리", "노트북", "표시 순서는 어떻게 할까요?", "목록을 보기 좋게 정리해 주세요", 7);
    add("main:demo0004", "idle", "문서 정리", "개발-PC", "작업 완료", "첨부 자료를 분류해 주세요", 4);
    add("main:demo0005", "working", "자료 확인", "사무실-PC", "자료 비교", "목록을 비교해 주세요", 22);
    add("sub:demo0001:aaaa1111", "working", "상황판", "개발-PC", "휴대폰 화면 검사", "가로 스크롤을 확인해 주세요", 2);
    add("gpt", "working", "상황판", "개발-PC", "위임 관계 표시 구현", "화면 개선", 4, "main:demo0001");
    add("gemini", "working", "경사로", "사무실-PC", "최종 문서 교차검토", "문서 검토", 6, "main:demo0002");
    add("aside", "idle", "", "개발-PC", "", "", 5);
    let nextId = 1;
    const addEvent = (row, status, task, at) => board.events.push({ id: nextId++, agent: row.agent,
      project: row.project, host: row.host, note: row.note, status, task, created_at: at });
    [...board.rows.values()].forEach((row) => {
      if (row.agent === "aside") return;
      addEvent(row, "working", "지시 받음", ago(25));
      addEvent(row, row.status, row.task, row.status_since);
    });
    // 자정 직후에도 오늘 요약의 지시 예시가 보이도록 현재 시각의 행을 둔다.
    addEvent(board.rows.get("main:demo0001"), "working", "지시 받음", ago(0));
    board.$("demo").addEventListener("click", (event) => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.old) {
        board.rows.forEach((row) => { if (board.waiting(row)) row.status_since = new Date(Date.now() - 7 * 60000).toISOString(); });
      } else {
        const agent = button.dataset.agent, status = button.dataset.status;
        if (!agent || !status) return;
        const old = board.rows.get(agent);
        const at = new Date().toISOString();
        const tasks = { working: "화면 검사 중", question: "이 순서로 진행할까요?", approval: "결과물 확인 요청", idle: "작업 완료" };
        const row = { ...(old || { agent, project: "상황판", host: "개발-PC", note: "화면 검증" }),
          status, task: tasks[status], updated_at: at, status_since: old && old.status === status ? old.status_since : at };
        board.upsert(row);
        if (!old || old.status !== status || old.task !== row.task) addEvent(row, status, row.task, at);
      }
      board.render();
    });
    board.render();
  };
})();
