export const $ = (id) => document.getElementById(id);

export function queryValues() {
  return new URLSearchParams(location.search);
}

export function fillFromQuery(map) {
  const query = queryValues();
  for (const [param, id] of Object.entries(map)) {
    if (query.has(param)) {
      $(id).value = query.get(param);
    }
  }
}

export function setStatus(id, message, tone = "neutral") {
  const el = $(id);
  el.hidden = !message;
  el.textContent = message || "";
  el.dataset.tone = tone;
}

export function copyShareUrl(fields) {
  const url = new URL(location.href);
  url.search = "";
  for (const [key, value] of Object.entries(fields)) {
    if (value !== "" && value != null) {
      url.searchParams.set(key, value);
    }
  }
  return navigator.clipboard.writeText(url.toString()).then(() => url.toString());
}

export function bindLiveForm(form, render) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  form.addEventListener("input", () => {
    render();
  });
  window.addEventListener("load", () => {
    render();
  });
}
