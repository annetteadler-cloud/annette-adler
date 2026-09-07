/*
 * Guided-Tour-Chatbot fuer die Portfolio-Website von Annette Adler.
 * Self-contained: rendert sich in einem Shadow DOM, damit nichts mit den
 * seitenspezifischen CSS-Variablen/Klassen der einzelnen Arbeitsproben kollidiert.
 * Backend: n8n-Webhook (AI Agent mit Site-Map-Systemprompt), siehe Portfolio-Tour-Chatbot-Workflow.
 */
(function () {
  var WEBHOOK_URL = "https://ki-bta.app.n8n.cloud/webhook/portfolio-chat";
  var MAX_MESSAGE_LENGTH = 500;

  var PAGES = {
    "annette-adler.html": {
      title: "Profil & Lebenslauf",
      blurb: "Du bist auf Annettes CV-/Profilseite: Werdegang, Ausbildung, Kompetenzmatrix und ein live aktualisierter Sustainability-News-Feed."
    },
    "index.html": {
      title: "Nachhaltigkeitsbericht Sparkasse FFB",
      blurb: "Du siehst die Kern-Arbeitsprobe: einen interaktiven Nachhaltigkeitsbericht (2022–2025) mit rund 40 ESG-Kennzahlen und Diagrammen."
    },
    "daten-dashboard.html": {
      title: "Daten-Dashboard",
      blurb: "Diese Seite ist ein Data-Governance-Audit zum Nachhaltigkeitsbericht: Datenquellen-Inventar, Qualitätsampeln und ein Regulatorik-Tracker."
    },
    "cloud-strategie.html": {
      title: "Cloud-Strategie",
      blurb: "Hier siehst du einen Cloud-Architektur-Blueprint für ein reguliertes Bankenumfeld – inklusive Hybrid-Architektur und Governance-Checkliste."
    },
    "llm-ki-strategie.html": {
      title: "LLM- & KI-Strategie",
      blurb: "Diese Seite zeigt eine Multi-Model-LLM-Strategie: Modell-Landschaft, Datenklassifikation, Autonomie-Stufen und Kostenstrategie."
    },
    "evaluation-quality-assurance-blueprint.html": {
      title: "Evaluation & QA",
      blurb: "Das Kapstone-Dokument: ein messbares Scoring- und Freigabesystem für KI-generierte Inhalte, inklusive Stress-Tests und Human-in-the-Loop."
    }
  };

  function currentPageKey() {
    var file = (location.pathname.split("/").pop() || "annette-adler.html").toLowerCase();
    return PAGES[file] ? file : null;
  }

  function getSessionId() {
    var id = sessionStorage.getItem("portfolioChat.sessionId");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
      sessionStorage.setItem("portfolioChat.sessionId", id);
    }
    return id;
  }

  function loadHistory() {
    try {
      return JSON.parse(sessionStorage.getItem("portfolioChat.history") || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    sessionStorage.setItem("portfolioChat.history", JSON.stringify(history));
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMessageHtml(text) {
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
      return '<a href="' + url + '" target="_self">' + label + "</a>";
    });
    return escaped.replace(/\n/g, "<br>");
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    var pageKey = currentPageKey();

    var host = document.createElement("div");
    host.id = "portfolio-chat-host";
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: "open" });

    root.innerHTML =
      '<style>' +
      ':host{all:initial;}' +
      '.pc-wrap{position:fixed;bottom:20px;right:20px;z-index:2147483000;font-family:"Public Sans",ui-sans-serif,system-ui,sans-serif;}' +
      '.pc-avatar-btn{position:relative;height:170px;width:auto;background:none;border:none;padding:0;cursor:pointer;filter:drop-shadow(0 6px 14px rgba(0,0,0,0.3));transition:transform .15s ease;display:block;}' +
      '.pc-avatar-btn:hover{transform:scale(1.04);}' +
      '.pc-avatar-img{display:block;height:100%;width:auto;}' +
      '.pc-avatar-badge{position:absolute;left:32%;top:6%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:#e2001a;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;overflow:hidden;}' +
      '@media (max-width:480px){.pc-avatar-btn{height:120px;}.pc-avatar-badge{width:16px;height:16px;font-size:8px;}}' +
      '.pc-panel{display:none;flex-direction:column;position:fixed;bottom:200px;right:20px;width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 232px);background:#ffffff;border:1px solid #dfe0e2;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.22);overflow:hidden;}' +
      '@media (max-width:480px){.pc-panel{bottom:150px;max-height:calc(100vh - 182px);}}' +
      '.pc-panel.open{display:flex;}' +
      '.pc-header{background:#e2001a;color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:14px;}' +
      '.pc-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;}' +
      '.pc-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:#f2f2f3;}' +
      '.pc-msg{max-width:85%;padding:8px 11px;border-radius:10px;font-size:13.5px;line-height:1.45;white-space:normal;}' +
      '.pc-msg a{color:#e2001a;font-weight:600;}' +
      '.pc-msg.bot{background:#ffffff;color:#1c1e21;border:1px solid #dfe0e2;align-self:flex-start;}' +
      '.pc-msg.user{background:#e2001a;color:#fff;align-self:flex-end;}' +
      '.pc-msg.status{background:transparent;color:#6c7075;font-style:italic;align-self:flex-start;padding:0 4px;}' +
      '.pc-inputrow{display:flex;gap:6px;padding:10px;border-top:1px solid #dfe0e2;background:#fff;}' +
      '.pc-input{flex:1;border:1px solid #dfe0e2;border-radius:8px;padding:8px 10px;font-size:13.5px;font-family:inherit;resize:none;}' +
      '.pc-send{background:#e2001a;color:#fff;border:none;border-radius:8px;padding:0 14px;font-weight:600;cursor:pointer;font-size:13px;}' +
      '.pc-send:disabled{opacity:0.5;cursor:default;}' +
      "</style>" +
      '<div class="pc-wrap">' +
      '<div class="pc-panel" id="panel">' +
      '<div class="pc-header"><span>Tour-Guide – Annettes Portfolio</span><button class="pc-close" id="closeBtn" aria-label="Schließen">✕</button></div>' +
      '<div class="pc-messages" id="messages"></div>' +
      '<div class="pc-inputrow">' +
      '<textarea class="pc-input" id="input" rows="1" maxlength="' + MAX_MESSAGE_LENGTH + '" placeholder="Frag mich etwas über diese Seite…"></textarea>' +
      '<button class="pc-send" id="sendBtn">Senden</button>' +
      "</div>" +
      "</div>" +
      '<button class="pc-avatar-btn" id="toggleBtn" aria-label="Chat öffnen">' +
      '<img class="pc-avatar-img" src="images/avatar-tourguide.png" alt="">' +
      '<span class="pc-avatar-badge" aria-hidden="true">💬</span>' +
      "</button>" +
      "</div>";

    var panel = root.getElementById("panel");
    var messagesEl = root.getElementById("messages");
    var input = root.getElementById("input");
    var sendBtn = root.getElementById("sendBtn");

    var history = loadHistory();
    var sessionId = getSessionId();
    var lastPage = sessionStorage.getItem("portfolioChat.lastPage");

    function renderAll() {
      messagesEl.innerHTML = "";
      history.forEach(function (msg) {
        appendBubble(msg.role, msg.text, false);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendBubble(role, text, persist) {
      var div = document.createElement("div");
      div.className = "pc-msg " + role;
      div.innerHTML = renderMessageHtml(text);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (persist) {
        history.push({ role: role, text: text });
        saveHistory(history);
      }
    }

    if (history.length === 0) {
      var welcome = "Hallo! Ich bin der Tour-Guide auf Annette Adlers Portfolio-Website und helfe dir, dich hier zurechtzufinden.";
      appendBubble("bot", welcome, true);
    }

    if (pageKey && lastPage !== pageKey) {
      appendBubble("bot", PAGES[pageKey].blurb, true);
      sessionStorage.setItem("portfolioChat.lastPage", pageKey);
    }

    renderAll();

    var wasOpen = sessionStorage.getItem("portfolioChat.open") === "1";
    if (wasOpen) {
      panel.classList.add("open");
    }

    root.getElementById("toggleBtn").addEventListener("click", function () {
      var isOpen = panel.classList.toggle("open");
      sessionStorage.setItem("portfolioChat.open", isOpen ? "1" : "0");
      if (isOpen) {
        input.focus();
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });

    root.getElementById("closeBtn").addEventListener("click", function () {
      panel.classList.remove("open");
      sessionStorage.setItem("portfolioChat.open", "0");
    });

    function sendMessage() {
      var text = input.value.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!text) return;
      appendBubble("user", text, true);
      input.value = "";
      sendBtn.disabled = true;

      var statusEl = document.createElement("div");
      statusEl.className = "pc-msg status";
      statusEl.textContent = "Tour-Guide tippt…";
      messagesEl.appendChild(statusEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId, page: pageKey || location.pathname })
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          statusEl.remove();
          appendBubble("bot", data.reply || "Entschuldigung, ich konnte keine Antwort erzeugen.", true);
        })
        .catch(function () {
          statusEl.remove();
          appendBubble("bot", "Der Tour-Guide ist gerade nicht erreichbar. Bitte versuche es später noch einmal.", true);
        })
        .finally(function () {
          sendBtn.disabled = false;
        });
    }

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
})();
