document.addEventListener("DOMContentLoaded", refreshStats);

async function refreshStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();
    document.getElementById("doc-count").textContent = data.document_count;
  } catch (e) {
    console.error("Failed to fetch stats:", e);
  }
}

async function addDocument() {
  const textarea = document.getElementById("add-text");
  const text = textarea.value.trim();
  if (!text) return;

  const btn = document.getElementById("add-btn");
  btn.disabled = true;
  btn.textContent = "Adding...";

  const resultBox = document.getElementById("add-result");

  try {
    const res = await fetch("/api/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();

    if (res.ok) {
      resultBox.className = "result-box success";
      resultBox.textContent = data.message;
      textarea.value = "";
      refreshStats();
    } else {
      resultBox.className = "result-box error";
      resultBox.textContent = data.error || "Failed to add document";
    }
  } catch (e) {
    resultBox.className = "result-box error";
    resultBox.textContent = "Network error: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Document";
  }
}

async function queryDatabase() {
  const textarea = document.getElementById("query-text");
  const text = textarea.value.trim();
  if (!text) return;

  const k = parseInt(document.getElementById("k-value").value) || 5;
  const btn = document.getElementById("query-btn");
  btn.disabled = true;
  btn.textContent = "Searching...";

  const resultBox = document.getElementById("query-results");

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, k }),
    });
    const data = await res.json();

    if (res.ok) {
      resultBox.className = "result-box";
      if (data.results.length === 0) {
        resultBox.innerHTML = '<div class="no-results">No results found. Add some documents first.</div>';
      } else {
        resultBox.innerHTML = data.results
          .map((r, i) => {
            const scoreClass = r.score >= 0.5 ? "score-high" : r.score >= 0.2 ? "score-mid" : "score-low";
            return `<div class="result-item">
              <span class="rank">${i + 1}.</span>
              <span class="score-badge ${scoreClass}">${r.score.toFixed(4)}</span>
              <span class="result-text">${escapeHtml(r.text)}</span>
            </div>`;
          })
          .join("");
      }
    } else {
      resultBox.className = "result-box error";
      resultBox.textContent = data.error || "Query failed";
    }
  } catch (e) {
    resultBox.className = "result-box error";
    resultBox.textContent = "Network error: " + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Search";
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Allow Ctrl+Enter to submit
document.getElementById("add-text").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addDocument();
});
document.getElementById("query-text").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) queryDatabase();
});
