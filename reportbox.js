/* 보기 전용 보고함. 받은 본문은 글자로 표시하고 허용된 링크만 별도로 만든다. */
(function () {
  "use strict";
  const board = window.AIOffice;
  const field = (tag, className, text) => {
    const element = document.createElement(tag); element.className = className; element.textContent = text; return element;
  };
  const unsafe = /\[가림\]|sb_secret_|eyJ|ghp_|sk-|xox|\d{16,}|[A-Z0-9.!#$%&'*+/=?^_`{|}~\-]+@[A-Z0-9\-]+(?:\.[A-Z0-9\-]+)+/i;
  const phone = /(?<!\d)(?:(?:\+?82[\s.\-]?(?:0)?(?:1[016789]|2|[3-6]\d)|0(?:1[016789]|2|[3-6]\d))[\s.\-]?\d{3,4}[\s.\-]?\d{4}|\+\d{1,3}[\s.\-]\(?\d{2,4}\)?[\s.\-]\d{3,4}[\s.\-]\d{4})(?!\d)|\(0(?:1[016789]|2|[3-6]\d)\)[\s.\-]?\d{3,4}[\s.\-]?\d{4}(?!\d)/;
  const hasPrivate = (value) => unsafe.test(value) || phone.test(value);
  board.safeHttps = (value) => {
    try {
      const raw = String(value || "");
      let decoded = raw;
      for (let count = 0; count < 3; count++) decoded = decodeURIComponent(decoded);
      if (hasPrivate(decoded) || /[\x00-\x20\\]/.test(decoded)
        || /(?:[?&#]|^)(?:access_token|refresh_token|token|secret|password|api_key|apikey|code)=/i.test(decoded)) return null;
      const url = new URL(raw);
      return url.protocol === "https:" && !url.username && !url.password ? url : null;
    } catch { return null; }
  };
  board.desktopLink = (value) => /^claude:\/\/claude\.ai\/epitaxy\/(?:local_)?[a-zA-Z0-9_-]+$/.test(String(value || "")) ? value : "";
  board.extractLinks = (text) => {
    const found = [], seen = new Set();
    for (const match of String(text || "").matchAll(/https:\/\/[^\s<>"'`]+/g)) {
      if (hasPrivate(match[0])) continue;
      const raw = match[0].replace(/[)\]},.;!?，。]+$/, ""), url = board.safeHttps(raw);
      if (!url || seen.has(url.href)) continue;
      seen.add(url.href); found.push({ href: url.href, domain: url.hostname });
      if (found.length === 3) break;
    }
    return found;
  };
  board.extractWorkFiles = (text) => {
    const found = [], seen = new Set();
    const pattern = /00_Work[\\/][^\r\n<>"'`|?*]+?\.[a-zA-Z0-9]{1,10}(?=$|[\s)\]}>"'`,.;])/g;
    for (const match of String(text || "").matchAll(pattern)) {
      const path = match[0].trim(), filename = path.split(/[\\/]/).pop();
      if (!filename || hasPrivate(path) || seen.has(path)) continue;
      seen.add(path); found.push({ path, filename, href: "https://drive.google.com/drive/search?q=" + encodeURIComponent(filename) });
      if (found.length === 3) break;
    }
    return found;
  };
  const anchor = (text, href) => {
    const link = field("a", "result-link", text); link.href = href; link.rel = "noopener noreferrer"; link.target = "_blank"; return link;
  };
  board.makeResultLinks = (row) => {
    const container = field("div", "result-links", ""), desktop = board.desktopLink(row.link);
    if (desktop) {
      container.appendChild(anchor("PC에서 열기", desktop));
      const copy = field("button", "copy-link", "링크 복사"); copy.type = "button";
      const value = field("input", "desktop-link", ""); value.type = "text"; value.readOnly = true; value.value = desktop;
      value.setAttribute("aria-label", "PC에서 여는 쓰레드 링크");
      const status = field("span", "copy-status", ""); status.setAttribute("role", "status");
      copy.addEventListener("click", async () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("복사 지원 없음");
          await navigator.clipboard.writeText(desktop); status.textContent = "링크를 복사했습니다";
        } catch { value.focus(); value.select(); status.textContent = "선택된 링크를 길게 눌러 복사해 주세요"; }
      });
      container.append(copy, value, field("small", "link-hint", "휴대폰에서는 아래 결과물 링크를 이용하세요. 쓰레드 링크는 PC용입니다."), status);
    }
    board.extractLinks(row.detail).forEach((link) => container.appendChild(anchor("결과물 열기 · " + link.domain, link.href)));
    board.extractWorkFiles(row.detail).forEach((file) => {
      container.append(field("code", "work-path", file.path), anchor("드라이브에서 찾기 · drive.google.com · " + file.filename, file.href));
    });
    if (!container.childNodes.length) container.appendChild(field("small", "link-hint", "열기 링크가 아직 기록되지 않았습니다"));
    return container;
  };
  board.inboxRows = (now = Date.now()) => {
    const results = [], seen = new Set();
    [...board.groupRows(now), ...board.teamRows(now)].forEach((owner) => {
      (owner.threads || []).forEach((thread) => {
        const raw = board.rows.get(thread.agent) || thread;
        [raw, ...(thread.assistants || [])].forEach((row) => {
          const key = row.agent + ":" + (row.host || "");
          const status = board.reporting(row, now) ? "report" : row.status;
          if (seen.has(key) || !["approval", "question", "report"].includes(status)) return;
          seen.add(key); results.push({ ...row, status, title: row.title || thread.title || thread.project || "제목 없는 쓰레드", owner });
        });
      });
    });
    return results.sort(board.compare);
  };
  let dialog = null, signature = "";
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = field("dialog", "reportbox", ""); dialog.id = "reportbox"; dialog.setAttribute("aria-labelledby", "reportbox-title");
    const head = field("div", "reportbox-head", ""), heading = field("h2", "", "사장실 보고함"); heading.id = "reportbox-title";
    const close = field("button", "reportbox-close", "닫기"); close.type = "button"; close.addEventListener("click", () => board.closeReportbox());
    head.append(heading, close); dialog.append(head, field("p", "hint", "보기 전용 · 결재 대기 → 질문 → 완료 보고 순"));
    const list = field("div", "reportbox-list", ""); list.id = "reportbox-list"; dialog.appendChild(list);
    dialog.addEventListener("click", (event) => { if (event.target === dialog) board.closeReportbox(); });
    document.body.appendChild(dialog); return dialog;
  }
  board.renderReportbox = () => {
    if (!dialog || !dialog.open) return;
    const rows = board.inboxRows(), next = JSON.stringify([rows, board.reviews, board.reviewsReady, board.reviewsError, Math.floor(Date.now() / 60000)]);
    if (signature === next) return;
    signature = next; const list = board.$("reportbox-list"); list.replaceChildren();
    rows.forEach((row) => {
      const card = field("article", "reportbox-item " + row.status, ""); card.dataset.status = row.status;
      const identity = field("div", "reportbox-identity", ""), icon = field("span", "card-icon", "");
      icon.innerHTML = board.portrait(board.roleKey(row.owner), true);
      identity.append(icon, field("strong", "", board.displayName(row.owner)), field("span", "reportbox-state", board.statusLabel(row.status)));
      card.append(identity, field("h3", "reportbox-title", row.title), field("small", "reportbox-age", (row.host || "PC 미확인") + " · " + board.minutes(board.elapsed(row)) + "분 전"),
        field("p", "reportbox-detail", row.detail || row.task || "상세 내용이 아직 기록되지 않았습니다"),
        field("p", "thread-review", board.reviewLine(row)), board.makeResultLinks(row));
      list.appendChild(card);
    });
    if (!rows.length) list.appendChild(field("p", "empty", "현재 확인할 질문·결재·완료 보고가 없습니다"));
  };
  board.openReportbox = () => { const box = ensureDialog(); if (!box.open) box.showModal(); signature = ""; board.renderReportbox(); };
  board.closeReportbox = () => { if (dialog && dialog.open) dialog.close(); signature = ""; };
  document.addEventListener("click", (event) => {
    if (event.target.closest("#boss, [data-reportbox]")) board.openReportbox();
  });
})();
