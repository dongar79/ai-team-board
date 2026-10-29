/* 읽기 전용 조회. 세대 번호로 늦은 조회와 로그아웃 이후 응답을 버린다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  let client = null, statusGen = 0, eventGen = 0, reviewGen = 0, connectionGen = 0;
  let eventTimer = null, reviewTimer = null, pollTimer = null, channel = null;
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
      data.forEach((row) => {
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
      board.$("activity-status").textContent = "최근 20건 · 한국 시간"; board.render();
    } catch (error) {
      if (generation !== eventGen) return;
      board.eventsError = true;
      board.$("activity-status").textContent = "활동 조회 실패 · 잠시 후 다시 확인합니다"; board.render();
    }
  }
  async function loadReviews() {
    const generation = ++reviewGen;
    try {
      const rows = [], size = 500;
      for (let offset = 0; ; offset += size) {
        const { data, error } = await client.from("agent_reviews").select("*")
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + size - 1);
        if (generation !== reviewGen) return;
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < size) break;
      }
      board.reviews = rows; board.reviewsReady = true; board.reviewsError = false; board.render();
    } catch (error) {
      if (generation !== reviewGen) return;
      board.reviewsError = true; board.render();
    }
  }
  function subscribe() {
    const connection = connectionGen;
    channel = client.channel("ai_office_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_status" }, (payload) => {
        if (connection !== connectionGen) return;
        ++statusGen;
        if (payload.eventType === "DELETE") board.rows.delete(payload.old.agent);
        else board.upsert(payload.new);
        board.render();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_events" }, () => {
        if (connection !== connectionGen) return;
        ++eventGen; clearTimeout(eventTimer); eventTimer = setTimeout(loadEvents, 300);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_reviews" }, () => {
        if (connection !== connectionGen) return;
        ++reviewGen; clearTimeout(reviewTimer); reviewTimer = setTimeout(loadReviews, 300);
      })
      .subscribe((status) => {
        if (connection !== connectionGen) return;
        board.setConn(status === "SUBSCRIBED" ? "on" : "off",
          status === "SUBSCRIBED" ? "실시간 연결됨" : "실시간 연결 대기 · 30초마다 보정 조회");
      });
  }
  board.stopData = () => {
    ++connectionGen; ++statusGen; ++eventGen; ++reviewGen;
    clearTimeout(eventTimer); clearTimeout(reviewTimer); clearInterval(pollTimer);
    if (channel && client) Promise.resolve(client.removeChannel(channel)).catch(() => {});
    channel = null; client = null;
  };
  board.startData = (authenticatedClient) => {
    board.stopData();
    if (!board.authorized || !authenticatedClient) return;
    client = authenticatedClient;
    loadStatus(); loadEvents(); loadReviews(); subscribe();
    pollTimer = setInterval(() => {
      if (client && board.authorized) { loadStatus(); loadEvents(); loadReviews(); }
    }, 30000);
  };
})();
