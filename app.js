/* 화면 시작과 화면 켜둠. 데이터 처리와 표시 모듈은 앞에서 읽는다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  board.render = () => {
    const layout = board.layout();
    board.renderOffice(layout); board.renderPanels(layout); board.renderReportbox();
  };
  let wakeLock = null, wakeWanted = true, wakePending = false;
  const wakeButton = board.$("wake");
  function paintWake() {
    if (!("wakeLock" in navigator)) {
      wakeButton.textContent = "켜둠 불가"; wakeButton.disabled = true;
      wakeButton.title = "이 브라우저는 화면 켜둠을 지원하지 않습니다"; return;
    }
    wakeButton.textContent = wakeLock ? "화면 켜둠 ●" : "화면 켜둠 ○";
    wakeButton.classList.toggle("on", !!wakeLock);
    wakeButton.title = wakeLock ? "화면이 꺼지지 않습니다. 누르면 해제" : "누르면 화면이 꺼지지 않게 합니다";
  }
  async function acquireWake() {
    if (!("wakeLock" in navigator) || wakeLock || wakePending || document.hidden || !wakeWanted) { paintWake(); return; }
    wakePending = true;
    try {
      const acquired = await navigator.wakeLock.request("screen");
      if (!wakeWanted) { await acquired.release(); return; }
      wakeLock = acquired;
      acquired.addEventListener("release", () => { if (wakeLock === acquired) wakeLock = null; paintWake(); });
    } catch (error) { wakeLock = null; }
    finally { wakePending = false; paintWake(); }
  }
  function releaseWake() {
    const previous = wakeLock; wakeLock = null;
    if (previous) previous.release().catch(() => {});
    paintWake();
  }
  try { wakeWanted = localStorage.getItem("ai-office-wake") !== "0"; } catch (error) { /* 저장할 수 없어도 동작한다. */ }
  wakeButton.addEventListener("click", () => {
    wakeWanted = !wakeWanted;
    try { localStorage.setItem("ai-office-wake", wakeWanted ? "1" : "0"); } catch (error) { /* 저장 실패는 무시한다. */ }
    if (wakeWanted) acquireWake(); else releaseWake();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && wakeWanted) acquireWake(); });
  document.addEventListener("pointerdown", () => { if (wakeWanted && !wakeLock) acquireWake(); });
  paintWake(); if (wakeWanted) acquireWake();
  if ("serviceWorker" in navigator && !board.demo && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  board.render();
  if (board.demo) {
    board.$("login-screen").hidden = true; board.$("board-app").hidden = false; board.startDemo();
  } else board.startAuth();
  setInterval(board.render, 10000);
})();
