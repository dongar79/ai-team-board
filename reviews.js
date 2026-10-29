/* 실제 점검 기록만 배지·쓰레드·최근 활동에 연결한다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  board.reviews = board.reviews || [];
  board.reviewerName = (key) => ({ gpt: "GPT", gemini: "Gemini", aside: "Aside", claude: "Claude" }[key] || "점검자 미확인");
  board.reviewState = (verdict) => ({ "통과": "passed", "수정 필요": "failed", "보류": "held" }[verdict] || "held");
  board.reviewMark = (verdict) => ({ "통과": "✓", "수정 필요": "✗", "보류": "…" }[verdict] || "…");
  board.sortedReviews = () => [...board.reviews].sort((a, b) => board.time(b.created_at) - board.time(a.created_at)
    || Number(b.id) - Number(a.id));
  board.reviewerReviews = (reviewer) => board.sortedReviews().filter((review) => review.reviewer === reviewer).slice(0, 5);
  board.threadReviews = (row) => {
    const targets = new Set([row.agent, row.title].filter(Boolean));
    return board.sortedReviews().filter((review) => targets.has(review.target)
      && (!review.host || !row.host || review.host === row.host));
  };
  board.reviewLine = (row) => {
    const seen = new Set();
    const recent = board.threadReviews(row).filter((review) => {
      const key = review.reviewer + ":" + review.kind;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 4);
    return "점검: " + (recent.length && board.reviewsError ? "조회 실패 · 이전 기록 / " : "") + (recent.length ? recent.map((review) => board.reviewerName(review.reviewer) + " " + review.kind
      + " " + review.verdict + (review.kind === "테스트" && /\d+/.test(review.summary || "") ? " · " + review.summary : "")).join(" / ")
      : board.reviewsError ? "기록을 확인할 수 없습니다" : board.reviewsReady ? "기록 없음" : "기록 확인 중");
  };
  board.reviewBadge = (reviewer) => {
    const review = board.reviewerReviews(reviewer)[0];
    return { state: review ? board.reviewState(review.verdict) : "held",
      text: review ? board.reviewMark(review.verdict) + " " + review.verdict : "점검 없음",
      title: review ? (board.reviewsError ? "점검 조회 실패 · 이전 기록 · " : "")
        + board.reviewerName(reviewer) + " · " + review.target + " · " + review.kind + " · " + review.summary
        : board.reviewsError ? "점검 기록을 확인할 수 없습니다" : "아직 기록된 점검이 없습니다" };
  };
  board.renderReviewer = (row) => {
    const container = board.$("info-reviews");
    if (!container) return;
    container.replaceChildren();
    if (!row) return;
    const reviewer = board.roleKey(row) === "main" ? "claude" : board.roleKey(row);
    const heading = document.createElement("h3"); heading.className = "threads-heading";
    heading.textContent = board.reviewerName(reviewer) + " 최근 점검 5건"; container.appendChild(heading);
    const records = board.reviewerReviews(reviewer), list = document.createElement("ol"); list.className = "review-list";
    if (records.length && board.reviewsError) {
      const notice = document.createElement("p"); notice.className = "review-stale";
      notice.textContent = "점검 조회 실패 · 이전 기록을 표시합니다. 최신 점검 여부는 확인되지 않았습니다.";
      notice.setAttribute("role", "status"); container.appendChild(notice);
    }
    records.forEach((review) => {
      const item = document.createElement("li"); item.className = "review-item " + board.reviewState(review.verdict);
      const title = document.createElement("strong"); title.textContent = board.reviewMark(review.verdict) + " " + review.verdict + " · " + review.kind;
      const target = document.createElement("div"); target.textContent = review.target;
      const summary = document.createElement("p"); summary.textContent = review.summary || "요약 없음";
      const time = document.createElement("small"); time.textContent = new Date(review.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + " · " + (review.host || "PC 미확인");
      item.append(title, target, summary, time);
      if (review.detail_url && board.makeResultLinks) item.appendChild(board.makeResultLinks({ detail: review.detail_url }));
      list.appendChild(item);
    });
    if (!records.length) {
      const empty = document.createElement("p"); empty.className = "empty";
      empty.textContent = board.reviewsError ? "점검 기록을 확인할 수 없습니다" : board.reviewsReady ? "기록된 점검이 없습니다" : "점검 기록을 불러오는 중입니다";
      container.appendChild(empty);
    } else container.appendChild(list);
  };
  board.activityRecords = () => [...board.events.map((item) => ({ ...item, activityKind: "event" })),
    ...board.reviews.map((item) => ({ ...item, activityKind: "review" }))]
    .sort((a, b) => board.time(b.created_at) - board.time(a.created_at) || Number(b.id) - Number(a.id)).slice(0, 20);
})();
