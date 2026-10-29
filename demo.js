/* 실제 저장소나 알림을 사용하지 않는 예시 데이터. */
(function () {
  "use strict";
  const board = window.AIOffice;
  board.startDemo = () => {
    board.$("demo").hidden = false; board.eventsReady = true;
    board.setConn("demo", "데모 · 실제 연결 없음");
    const now = Date.now();
    const ago = (minutes) => new Date(now - minutes * 60000).toISOString();
    const add = (agent, status, project, host, task, note, age, parent = "", group_name = "컴퓨터", title = "") => board.upsert({
      agent, status, project, host, task, note, parent, group_name, title,
      session_id: agent, updated_at: ago(0), status_since: ago(age),
    });
    add("main:demo0001", "working", "사용승인", "회사-PC", "의무사항 판독 화면 정리", "판독기와 대장을 개선해 주세요", 3,
      "", "사용승인 대장프로그램", "편의시설 의무사항 판독기");
    add("main:demo0006", "working", "사용승인", "회사-PC", "대장 목록 정리", "검색 조건을 정리해 주세요", 4,
      "", "사용승인 대장프로그램", "편의시설 사용승인 대장");
    add("main:demo0007", "working", "사용승인", "회사-PC", "인쇄 화면 확인", "인쇄 양식을 확인해 주세요", 1,
      "", "사용승인 대장프로그램", "대장 인쇄 양식");
    add("main:demo0008", "working", "센터 업무보조", "집-PC", "첨부 자료 분류", "오늘 받은 자료를 분류해 주세요", 2,
      "", "센터 업무보조", "오늘 자료 정리");
    add("main:demo0002", "approval", "경사로", "회사-PC", "최종 문서 확인 요청", "최종 문서를 검토해 주세요", 12,
      "", "컴퓨터", "경사로 설치 안내 확인");
    add("main:demo0003", "question", "임대관리", "집-PC", "표시 순서는 어떻게 할까요?", "목록을 보기 좋게 정리해 주세요", 7,
      "", "컴퓨터", "입금 목록 표시 순서");
    add("main:demo0004", "idle", "문서 정리", "집-PC", "쉬는 중", "첨부 자료를 분류해 주세요", 4,
      "", "자료 정리", "지난 자료 분류");
    add("main:demo0005", "working", "자료 확인", "집-PC", "자료 비교", "목록을 비교해 주세요", 22,
      "", "자료 정리", "원본 대조");
    add("main:demo0009", "idle", "상황판", "집-노트북", "답변 완료", "수정 결과를 정리해 주세요", 2,
      "", "컴퓨터", "화면 수정 결과 보고");
    // 마지막 통신도 22분 전인 예시로 무응답 표시를 확인한다.
    board.rows.get("main:demo0005").updated_at = ago(22);
    add("sub:demo0001:aaaa1111", "working", "사용승인", "회사-PC", "휴대폰 화면 검사", "가로 스크롤을 확인해 주세요", 2,
      "main:demo0001", "사용승인 대장프로그램");
    add("gpt", "working", "상황판", "회사-PC", "위임 관계 표시 구현", "화면 개선", 4,
      "main:demo0001", "", "그룹 화면 구현");
    add("gpt:demo0002", "working", "상황판", "집-PC", "활동 집계 검사", "오늘 요약을 검증해 주세요", 2,
      "", "", "오늘 요약 검사");
    add("gemini", "working", "경사로", "회사-PC", "최종 문서 교차검토", "문서 검토", 6,
      "main:demo0002", "", "최종 문서 검토");
    add("aside", "idle", "", "집-PC", "", "", 5);
    let nextId = 1;
    const addEvent = (row, status, task, at) => board.events.push({ id: nextId++, agent: row.agent,
      project: row.project, host: row.host, group_name: row.group_name, title: row.title,
      note: row.note, status, task, created_at: at });
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
        const agent = button.dataset.agent, requested = button.dataset.status, status = requested === "report" ? "idle" : requested;
        if (!agent || !status) return;
        const old = board.rows.get(agent);
        const at = new Date().toISOString();
        const tasks = { working: "화면 검사 중", question: "이 순서로 진행할까요?", approval: "결과물 확인 요청", idle: "쉬는 중", report: "답변 완료" };
        const row = { ...(old || { agent, project: "상황판", host: "집-PC", note: "화면 검증", group_name: "컴퓨터" }),
          status, task: tasks[requested], updated_at: at, status_since: old && old.status === status ? old.status_since : at };
        board.upsert(row);
        if (!old || old.status !== status || old.task !== row.task) addEvent(row, status, row.task, at);
      }
      board.render();
    });
    board.render();
  };
})();
