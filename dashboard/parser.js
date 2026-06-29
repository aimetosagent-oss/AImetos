(function (global) {
  "use strict";

  const CSV_COLUMNS = Object.freeze([
    "id", "company_name", "website", "email", "telefono", "city",
    "target_type", "sector", "offer_type", "landing_url", "source_url",
    "pain_hypothesis", "outreach_status", "language", "first_email_subject",
    "first_email_body", "followup1_subject", "followup1_body",
    "followup2_subject", "followup2_body", "last_contact_date",
    "followup_step", "ghl_contact_id", "lead_status", "reply_status"
  ]);

  function parseCSV(text) {
    if (typeof text !== "string") throw new TypeError("CSV input must be text.");

    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"' && field === "") {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(function (cells) {
      return cells.some(function (cell) { return cell.trim() !== ""; });
    });
  }

  function cleanHeader(value, index) {
    const header = String(value || "").trim();
    return index === 0 ? header.replace(/^\uFEFF/, "") : header;
  }

  function emptyLead() {
    return {
      id: "", company_name: "", website: "", email: "", telefono: "",
      city: "", target_type: "", sector: "", offer_type: "",
      landing_url: "", source_url: "", pain_hypothesis: "",
      outreach_status: "", lead_status: "", reply_status: "",
      messages: {
        first: { subject: "", body: "" },
        followup1: { subject: "", body: "" },
        followup2: { subject: "", body: "" }
      },
      metadata: {
        last_contact_date: "", followup_step: "", ghl_contact_id: "",
        language: ""
      }
    };
  }

  function normalizeLead(record) {
    const lead = emptyLead();
    const direct = [
      "id", "company_name", "website", "email", "telefono", "city",
      "target_type", "sector", "offer_type", "landing_url", "source_url",
      "pain_hypothesis", "outreach_status", "lead_status", "reply_status"
    ];
    direct.forEach(function (key) { lead[key] = String(record[key] || ""); });

    lead.messages.first.subject = String(record.first_email_subject || "");
    lead.messages.first.body = String(record.first_email_body || "");
    lead.messages.followup1.subject = String(record.followup1_subject || "");
    lead.messages.followup1.body = String(record.followup1_body || "");
    lead.messages.followup2.subject = String(record.followup2_subject || "");
    lead.messages.followup2.body = String(record.followup2_body || "");
    lead.metadata.last_contact_date = String(record.last_contact_date || "");
    lead.metadata.followup_step = String(record.followup_step || "");
    lead.metadata.ghl_contact_id = String(record.ghl_contact_id || "");
    lead.metadata.language = String(record.language || "");
    return lead;
  }

  function importCSV(text) {
    const rows = parseCSV(text);
    if (!rows.length) return { leads: [], warnings: ["The CSV is empty."] };

    const headers = rows[0].map(cleanHeader);
    const warnings = [];
    const missing = CSV_COLUMNS.filter(function (column) {
      return headers.indexOf(column) === -1;
    });
    if (missing.length) warnings.push("Missing columns were left empty: " + missing.join(", "));

    const leads = rows.slice(1).map(function (cells, rowIndex) {
      const record = {};
      headers.forEach(function (header, index) {
        if (header && record[header] === undefined) record[header] = cells[index] || "";
      });
      if (cells.length > headers.length) {
        warnings.push("Row " + (rowIndex + 2) + " has extra fields; extras were ignored.");
      }
      return normalizeLead(record);
    });

    return { leads: leads, warnings: warnings };
  }

  function leadToRecord(lead) {
    return {
      id: lead.id, company_name: lead.company_name, website: lead.website,
      email: lead.email, telefono: lead.telefono, city: lead.city,
      target_type: lead.target_type, sector: lead.sector,
      offer_type: lead.offer_type, landing_url: lead.landing_url,
      source_url: lead.source_url, pain_hypothesis: lead.pain_hypothesis,
      outreach_status: lead.outreach_status,
      language: lead.metadata.language,
      first_email_subject: lead.messages.first.subject,
      first_email_body: lead.messages.first.body,
      followup1_subject: lead.messages.followup1.subject,
      followup1_body: lead.messages.followup1.body,
      followup2_subject: lead.messages.followup2.subject,
      followup2_body: lead.messages.followup2.body,
      last_contact_date: lead.metadata.last_contact_date,
      followup_step: lead.metadata.followup_step,
      ghl_contact_id: lead.metadata.ghl_contact_id,
      lead_status: lead.lead_status, reply_status: lead.reply_status
    };
  }

  function escapeCSV(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function exportCSV(leads) {
    const lines = [CSV_COLUMNS.map(escapeCSV).join(",")];
    leads.forEach(function (lead) {
      const record = leadToRecord(lead);
      lines.push(CSV_COLUMNS.map(function (column) {
        return escapeCSV(record[column]);
      }).join(","));
    });
    return lines.join("\r\n");
  }

  global.OutboundCSV = Object.freeze({
    columns: CSV_COLUMNS,
    parse: parseCSV,
    importLeads: importCSV,
    normalizeLead: normalizeLead,
    exportLeads: exportCSV
  });
}(window));
