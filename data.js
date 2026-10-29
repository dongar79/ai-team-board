/* 읽기 전용 조회. 세대 번호로 늦은 조회와 실시간 변경의 역전을 막는다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  let client = null, statusGen = 0, eventGen = 0, eventTimer = null;
  async function loadStatus() {
    const generation = ++statusGen;
    try {
      const data = [], size = 500;
      for (let offset = 0; ; offset += size) {
        const result = await client.from("agent_status").select("*").order("agent", { ascending: true }).range(offset, offset + size - 1);
        if (generation !== statusGen) return;
        if (result.error) throw result.error;
        data.push(...(result.data || []));
        if (!result.data || result.data.length < size) break;
      }
      const previous = new Map(board.rows);
      board.rows.clear();
      (data || []).forEach((row) => {
        const old = previous.get(row.agent);
        board.upsert(old && board.time(old.updated_at) > board.time(row.updated_at) ? old : row);
      });
      board.setConn("on", "상태 읽기 성공"); board.render();
    } catch (error) {
      if (generation === statusGen) board.setConn("off", "상태 읽기 실패 · 잠시 후 다시 확인합니다");
    }
  }
  async function loadEvents() {
    const generation = ++eventGen;
    const events = [], size = 500;
    // 전날 시작된 대기도 복원하도록 보관된 7일 기록을 페이지별로 읽는다.
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    try {
      for (let offset = 0; ; offset += size) {
        const { data, error } = await client.from("agent_events").select("*").gte("created_at", since)
          .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + size - 1);
        if (generation !== eventGen) return;
        if (error) throw error;
        events.push(...(data || []));
        if (!data || data.length < size) break;
      }
      board.events = events; board.eventsReady = true; board.eventsError = false;
      board.$("activity-status").textContent = "최근 20건 · 한국 시간";
      board.render();
    } catch (error) {
      if (generation !== eventGen) return;
      board.eventsError = true;
      board.$("activity-status").textContent = "활동 조회 실패 · 잠시 후 다시 확인합니다";
      board.render();
    }
  }
  function queueEvents() {
    ++eventGen;
    clearTimeout(eventTimer);
    eventTimer = setTimeout(loadEvents, 300);
  }
  function subscribe() {
    client.channel("ai_office_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_status" }, (payload) => {
        ++statusGen;
        if (payload.eventType === "DELETE") board.rows.delete(payload.old.agent);
        else board.upsert(payload.new);
        board.render();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_events" }, queueEvents)
      .subscribe((status) => board.setConn(status === "SUBSCRIBED" ? "on" : "off",
        status === "SUBSCRIBED" ? "실시간 연결됨" : "실시간 연결 대기 · 30초마다 보정 조회"));
  }
  board.startData = () => {
    const config = window.AI_OFFICE_CONFIG || {};
    if (!config.url || !config.anonKey || config.url.includes("xxxxxxxx")) {
      board.setConn("off", "연결 설정 없음");
      board.notice("연결 설정이 없습니다. 아래 데모 보기에서 화면을 확인할 수 있습니다."); return;
    }
    const connect = () => {
      if (!window.supabase) {
        board.setConn("off", "라이브러리 읽기 실패");
        board.notice("연결 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요."); return;
      }
      client = window.supabase.createClient(config.url, config.anonKey);
      loadStatus(); loadEvents(); subscribe();
      setInterval(() => { loadStatus(); loadEvents(); }, 30000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) { loadStatus(); loadEvents(); } });
    };
    if (window.supabase) { connect(); return; }
    // 데모는 이 함수를 호출하지 않으므로 외부 스크립트 요청도 발생하지 않는다.
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js";
    script.onload = connect; script.onerror = connect; document.head.appendChild(script);
  };
})();
