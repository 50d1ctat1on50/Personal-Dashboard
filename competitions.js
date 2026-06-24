async function loadCompetitions() {
  const todayEl = document.getElementById("todayCompetitions");
  const yesterdayEl = document.getElementById("yesterdayCompetitions");

  if (!todayEl || !yesterdayEl) return;

  try {
    const response = await fetch("/.netlify/functions/competitions");
    const data = await response.json();

    renderCompetitionList(todayEl, data.today);
    renderCompetitionList(yesterdayEl, data.yesterday);

    localStorage.setItem("lastCompetitions", JSON.stringify(data.today));
  } catch (error) {
    const saved = JSON.parse(localStorage.getItem("lastCompetitions") || "[]");

    todayEl.innerHTML = "<p class='empty-note'>Could not load today’s competitions.</p>";
    renderCompetitionList(yesterdayEl, saved);
  }
}

function renderCompetitionList(container, items) {
  if (!items || !items.length) {
    container.innerHTML = "<p class='empty-note'>No competitions available.</p>";
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div class="competition-item">
      <div class="competition-rank">${index + 1}</div>
      <div>
        <strong>${item.title}</strong>
        <p>${item.reason}</p>
        <a class="competition-link" href="${item.url}" target="_blank" rel="noopener">
          Open entry page
        </a>
      </div>
    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", loadCompetitions);
