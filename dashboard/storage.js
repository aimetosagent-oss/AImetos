(function (global) {
  "use strict";

  const STORAGE_KEY = "aimetos.outbound-dashboard.v1";

  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const payload = JSON.parse(raw);
      if (!payload || !Array.isArray(payload.leads)) return [];
      return payload.leads.map(function (lead) {
        return global.OutboundCSV.normalizeLead({
          id: lead.id, company_name: lead.company_name, website: lead.website,
          email: lead.email, telefono: lead.telefono, city: lead.city,
          target_type: lead.target_type, sector: lead.sector,
          offer_type: lead.offer_type, landing_url: lead.landing_url,
          source_url: lead.source_url, pain_hypothesis: lead.pain_hypothesis,
          outreach_status: lead.outreach_status, lead_status: lead.lead_status,
          reply_status: lead.reply_status,
          language: lead.metadata && lead.metadata.language,
          first_email_subject: lead.messages && lead.messages.first && lead.messages.first.subject,
          first_email_body: lead.messages && lead.messages.first && lead.messages.first.body,
          followup1_subject: lead.messages && lead.messages.followup1 && lead.messages.followup1.subject,
          followup1_body: lead.messages && lead.messages.followup1 && lead.messages.followup1.body,
          followup2_subject: lead.messages && lead.messages.followup2 && lead.messages.followup2.subject,
          followup2_body: lead.messages && lead.messages.followup2 && lead.messages.followup2.body,
          last_contact_date: lead.metadata && lead.metadata.last_contact_date,
          followup_step: lead.metadata && lead.metadata.followup_step,
          ghl_contact_id: lead.metadata && lead.metadata.ghl_contact_id
        });
      });
    } catch (error) {
      console.warn("Stored dashboard data could not be restored.", error);
      return [];
    }
  }

  function save(leads) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        leads: leads
      }));
      return true;
    } catch (error) {
      console.warn("Dashboard data could not be saved.", error);
      return false;
    }
  }

  // Future sync hooks (intentionally inactive for the static MVP):
  // async function syncFromGoogleSheets() {}
  // async function notifyN8nWebhook(lead) {}
  // async function migrateToPostgres(leads) {}

  global.OutboundStorage = Object.freeze({ load: load, save: save });
}(window));
