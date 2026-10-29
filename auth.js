/* 매직링크 로그인과 허용 이메일 확인. 확인 전에는 업무 조회를 시작하지 않는다. */
(function () {
  "use strict";
  const board = window.AIOffice, config = window.AI_OFFICE_CONFIG || {};
  const allowed = String(config.allowedEmail || "").trim().toLowerCase();
  let client = null, generation = 0, signingOut = false, booting = false;
  const message = (text) => { board.$("login-status").textContent = text; };
  function lock() {
    board.authorized = false;
    board.stopData();
    board.$("board-app").hidden = true;
    board.$("login-screen").hidden = false;
    board.$("logout").hidden = true;
    board.$("login-screen").appendChild(board.$("logout"));
    board.closeReportbox?.();
    board.rows.clear(); board.events = []; board.reviews = []; board.selected = null;
    board.eventsReady = false; board.reviewsReady = false;
    board.render();
  }
  async function accept(session) {
    const current = ++generation;
    lock();
    if (signingOut || !session) { message("사장님 이메일로 받은 로그인 링크를 눌러 주세요."); return; }
    if (String(session.user?.email || "").toLowerCase() !== allowed) {
      board.$("logout").hidden = false;
      message("허용된 사장님 이메일로 로그인해 주세요."); return;
    }
    message("조회 권한을 확인하고 있습니다.");
    try {
      const { data, error } = await client.from("board_viewers").select("email").eq("email", allowed).maybeSingle();
      if (current !== generation || signingOut) return;
      if (error || !data || data.email !== allowed) {
        board.$("logout").hidden = false;
        message("조회 권한이 없습니다. 총괄에게 허용 이메일 등록과 접근 보호 적용을 확인해 주세요."); return;
      }
      board.authorized = true;
      board.$("login-screen").hidden = true; board.$("board-app").hidden = false;
      board.$("logout").hidden = false;
      document.querySelector(".top").appendChild(board.$("logout"));
      board.startData(client); board.render();
    } catch (error) {
      if (current === generation) message("조회 권한을 확인하지 못했습니다. 연결을 확인한 뒤 다시 로그인해 주세요.");
    }
  }
  async function resume() {
    const current = ++generation;
    lock();
    try {
      const { data, error } = await client.auth.getSession();
      if (current !== generation || signingOut) return;
      if (error) throw error;
      await accept(data.session);
    } catch (error) { if (current === generation) message("저장된 로그인을 확인하지 못했습니다. 로그인 링크를 다시 받아 주세요."); }
  }
  async function sendLink() {
    const button = board.$("login-send");
    if (!client || button.disabled) return;
    button.disabled = true; signingOut = false;
    try {
      // 로그인 토큰·기존 검색어가 메일의 복귀 주소에 다시 들어가지 않도록 제외한다.
      const redirect = new URL(location.href); redirect.search = ""; redirect.hash = "";
      const { error } = await client.auth.signInWithOtp({ email: allowed,
        options: { emailRedirectTo: redirect.href } });
      if (error) throw error;
      message("로그인 링크를 보냈습니다. 이 휴대폰의 사용할 브라우저에서 메일 링크를 열어 주세요.");
    } catch (error) { message("로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도하거나 총괄에게 메일 설정을 확인해 주세요."); }
    finally { button.disabled = false; }
  }
  async function logout() {
    if (!client || signingOut) return;
    signingOut = true; ++generation; lock();
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      message("이 브라우저에서 로그아웃했습니다.");
    } catch (error) {
      board.$("logout").hidden = false;
      message("화면을 잠갔지만 저장된 로그인 해제는 확인하지 못했습니다. 연결 후 로그아웃을 다시 눌러 주세요.");
    } finally { signingOut = false; }
  }
  board.startAuth = async () => {
    if (board.demo || booting) return;
    booting = true; lock();
    board.$("login-send").addEventListener("click", sendLink);
    board.$("logout").addEventListener("click", logout);
    board.$("login-email").textContent = allowed || "허용 이메일 등록 대기";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowed)) {
      message("총괄이 사장님 이메일과 접근 보호를 설정하면 로그인할 수 있습니다."); return;
    }
    if (!config.url || !config.anonKey || config.url.includes("xxxxxxxx")) {
      message("총괄이 상황판 연결 설정을 확인해야 합니다."); return;
    }
    try {
      if (!window.supabase) await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js";
        script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
      });
      client = window.supabase.createClient(config.url, config.anonKey,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      // 인증 콜백 안에서 추가 인증 호출을 기다리지 않는다.
      client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") { ++generation; lock(); return; }
        const queued = ++generation;
        setTimeout(() => { if (!signingOut && queued === generation) accept(session); }, 0);
      });
      board.$("login-send").disabled = false;
      await resume();
      document.addEventListener("visibilitychange", () => { if (!document.hidden && !signingOut) resume(); });
    } catch (error) { message("로그인 도구를 불러오지 못했습니다. 연결을 확인하고 화면을 다시 열어 주세요."); }
  };
})();
