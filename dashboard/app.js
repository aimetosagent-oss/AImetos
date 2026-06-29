(function () {
  "use strict";

  const DEFAULT_OPTIONS = {
    outreach_status: ["not_contacted", "queued", "sent", "followup_due", "completed"],
    lead_status: ["new", "qualified", "nurture", "won", "lost"],
    reply_status: ["no_reply", "positive", "neutral", "negative", "do_not_contact"]
  };

  const state = {
    leads: window.OutboundStorage.load(),
    selectedIndex: null,
    filters: { search: "", outreach_status: "", lead_status: "", reply_status: "", sector: "" }
  };

  const ui = {
    file: document.getElementById("csv-file"),
    exportButton: document.getElementById("export-button"),
    search: document.getElementById("search"),
    filterOutreach: document.getElementById("filter-outreach"),
    filterLead: document.getElementById("filter-lead"),
    filterReply: document.getElementById("filter-reply"),
    filterSector: document.getElementById("filter-sector"),
    clearFilters: document.getElementById("clear-filters"),
    rows: document.getElementById("lead-rows"),
    empty: document.getElementById("empty-state"),
    detail: document.getElementById("detail-panel"),
    detailTemplate: document.getElementById("detail-template"),
    count: document.getElementById("lead-count"),
    visibleCount: document.getElementById("visible-count"),
    saveState: document.getElementById("save-state"),
    notice: document.getElementById("notice")
  };

  function uniqueValues(key) {
    const values = state.leads.map(function (lead) { return lead[key]; }).filter(Boolean);
    return Array.from(new Set(values)).sort(function (a, b) { return a.localeCompare(b); });
  }

  function statusValues(key) {
    return Array.from(new Set(DEFAULT_OPTIONS[key].concat(uniqueValues(key))));
  }

  function replaceOptions(select, values, label) {
    const current = select.value;
    select.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = label;
    select.appendChild(all);
    values.forEach(function (value) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = readable(value);
      select.appendChild(option);
    });
    select.value = values.indexOf(current) >= 0 ? current : "";
  }

  function populateOptions() {
    replaceOptions(ui.filterOutreach, statusValues("outreach_status"), "All outreach");
    replaceOptions(ui.filterLead, statusValues("lead_status"), "All lead statuses");
    replaceOptions(ui.filterReply, statusValues("reply_status"), "All replies");
    replaceOptions(ui.filterSector, uniqueValues("sector"), "All sectors");
    fillDatalist("outreach-options", statusValues("outreach_status"));
    fillDatalist("lead-options", statusValues("lead_status"));
    fillDatalist("reply-options", statusValues("reply_status"));
  }

  function fillDatalist(id, values) {
    const list = document.getElementById(id);
    list.replaceChildren();
    values.forEach(function (value) {
      const option = document.createElement("option");
      option.value = value;
      list.appendChild(option);
    });
  }

  function readable(value) {
    if (!value) return "—";
    return value.replace(/[_-]+/g, " ").replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function filteredIndexes() {
    const query = state.filters.search.trim().toLocaleLowerCase();
    return state.leads.map(function (lead, index) { return { lead: lead, index: index }; })
      .filter(function (item) {
        const lead = item.lead;
        const searchable = [lead.company_name, lead.email, lead.city].join(" ").toLocaleLowerCase();
        return (!query || searchable.indexOf(query) >= 0) &&
          (!state.filters.outreach_status || lead.outreach_status === state.filters.outreach_status) &&
          (!state.filters.lead_status || lead.lead_status === state.filters.lead_status) &&
          (!state.filters.reply_status || lead.reply_status === state.filters.reply_status) &&
          (!state.filters.sector || lead.sector === state.filters.sector);
      }).map(function (item) { return item.index; });
  }

  function textCell(primary, secondary) {
    const cell = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = primary || "—";
    cell.appendChild(strong);
    if (secondary) {
      const small = document.createElement("span");
      small.textContent = secondary;
      cell.appendChild(small);
    }
    return cell;
  }

  function statusCell(index, key) {
    const cell = document.createElement("td");
    const select = document.createElement("select");
    select.dataset.index = String(index);
    select.dataset.field = key;
    const values = statusValues(key);
    if (!state.leads[index][key]) values.unshift("");
    values.forEach(function (value) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = readable(value);
      select.appendChild(option);
    });
    select.value = state.leads[index][key];
    cell.appendChild(select);
    return cell;
  }

  function renderTable() {
    const indexes = filteredIndexes();
    ui.rows.replaceChildren();
    indexes.forEach(function (index) {
      const lead = state.leads[index];
      const row = document.createElement("tr");
      row.dataset.index = String(index);
      if (index === state.selectedIndex) row.classList.add("selected");
      row.appendChild(textCell(lead.company_name, lead.website));
      row.appendChild(textCell(lead.email, lead.telefono));
      row.appendChild(textCell(lead.city));
      row.appendChild(textCell(lead.sector));
      row.appendChild(statusCell(index, "outreach_status"));
      row.appendChild(statusCell(index, "lead_status"));
      row.appendChild(statusCell(index, "reply_status"));
      ui.rows.appendChild(row);
    });
    ui.count.textContent = String(state.leads.length);
    ui.visibleCount.textContent = String(indexes.length);
    ui.empty.hidden = indexes.length > 0;
    if (!indexes.length) {
      ui.empty.querySelector("strong").textContent = state.leads.length ? "No matching leads" : "No leads loaded";
      ui.empty.querySelector("span").textContent = state.leads.length ? "Clear or adjust the active filters." : "Import a Google Sheets CSV to begin. Your edits will stay in this browser.";
    }
  }

  function valueAtPath(object, path) {
    return path.split(".").reduce(function (value, key) { return value && value[key]; }, object);
  }

  function setAtPath(object, path, value) {
    const parts = path.split(".");
    const finalKey = parts.pop();
    const parent = parts.reduce(function (target, key) { return target[key]; }, object);
    parent[finalKey] = value;
  }

  function renderDetail() {
    ui.detail.replaceChildren();
    const lead = state.leads[state.selectedIndex];
    if (!lead) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = "Select a lead to inspect and edit it.";
      ui.detail.appendChild(empty);
      return;
    }

    const fragment = ui.detailTemplate.content.cloneNode(true);
    fragment.querySelector('[data-display="company_name"]').textContent = lead.company_name || "Unnamed lead";
    fragment.querySelector('[data-display="id"]').textContent = lead.id ? "ID " + lead.id : "No ID";
    fragment.querySelectorAll("[name]").forEach(function (field) {
      field.value = valueAtPath(lead, field.name) || "";
    });
    ui.detail.appendChild(fragment);
  }

  function persist(message) {
    const saved = window.OutboundStorage.save(state.leads);
    ui.saveState.textContent = saved ? (message || "Saved locally") : "Storage unavailable";
  }

  function renderAll() {
    populateOptions();
    renderTable();
    renderDetail();
  }

  function showNotice(message, warning) {
    ui.notice.textContent = message;
    ui.notice.classList.toggle("warning", Boolean(warning));
  }

  ui.file.addEventListener("change", function () {
    const file = ui.file.files && ui.file.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", function () {
      try {
        const result = window.OutboundCSV.importLeads(String(reader.result || ""));
        state.leads = result.leads;
        state.selectedIndex = result.leads.length ? 0 : null;
        persist("Imported and saved");
        renderAll();
        showNotice("Imported " + result.leads.length + " lead" + (result.leads.length === 1 ? "" : "s") + "." + (result.warnings.length ? " " + result.warnings.join(" ") : ""), result.warnings.length > 0);
      } catch (error) {
        showNotice("Import failed: " + error.message, true);
      } finally {
        ui.file.value = "";
      }
    });
    reader.addEventListener("error", function () { showNotice("The selected file could not be read.", true); });
    reader.readAsText(file, "UTF-8");
  });

  ui.exportButton.addEventListener("click", function () {
    const csv = window.OutboundCSV.exportLeads(state.leads);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aimetos-outbound-leads.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotice("Exported " + state.leads.length + " lead" + (state.leads.length === 1 ? "" : "s") + ".");
  });

  ui.rows.addEventListener("click", function (event) {
    if (event.target.matches("select")) return;
    const row = event.target.closest("tr[data-index]");
    if (!row) return;
    state.selectedIndex = Number(row.dataset.index);
    renderTable();
    renderDetail();
  });

  ui.rows.addEventListener("change", function (event) {
    const select = event.target.closest("select[data-field]");
    if (!select) return;
    const index = Number(select.dataset.index);
    state.leads[index][select.dataset.field] = select.value;
    state.selectedIndex = index;
    persist();
    renderAll();
  });

  ui.detail.addEventListener("input", function (event) {
    const field = event.target.closest("[name]");
    const lead = state.leads[state.selectedIndex];
    if (!field || !lead) return;
    setAtPath(lead, field.name, field.value);
    persist();
    if (["company_name", "email", "city", "sector", "outreach_status", "lead_status", "reply_status"].indexOf(field.name) >= 0) {
      renderTable();
      const title = ui.detail.querySelector('[data-display="company_name"]');
      if (title) title.textContent = lead.company_name || "Unnamed lead";
    }
  });

  ui.search.addEventListener("input", function () { state.filters.search = ui.search.value; renderTable(); });
  [
    [ui.filterOutreach, "outreach_status"], [ui.filterLead, "lead_status"],
    [ui.filterReply, "reply_status"], [ui.filterSector, "sector"]
  ].forEach(function (binding) {
    binding[0].addEventListener("change", function () { state.filters[binding[1]] = binding[0].value; renderTable(); });
  });
  ui.clearFilters.addEventListener("click", function () {
    state.filters = { search: "", outreach_status: "", lead_status: "", reply_status: "", sector: "" };
    ui.search.value = "";
    [ui.filterOutreach, ui.filterLead, ui.filterReply, ui.filterSector].forEach(function (select) { select.value = ""; });
    renderTable();
  });

  if (state.leads.length) {
    state.selectedIndex = 0;
    ui.saveState.textContent = "Restored locally";
    showNotice("Restored " + state.leads.length + " saved lead" + (state.leads.length === 1 ? "" : "s") + ".");
  }
  renderAll();
}());
