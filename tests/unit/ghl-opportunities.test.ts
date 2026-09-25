import { describe, expect, it } from "vitest";
import { parseCsv, selectedGhlOpportunities } from "@/modules/imports/ghl-opportunities";

describe("importació d'oportunitats GHL", () => {
  it("interpreta camps entre cometes i notes amb salts de línia", () => {
    const rows = parseCsv('ID de oportunidad,Notas\r\n2GEvhqbrAgtPzsS9aCoc,"Primera línia\nSegona línia"\r\n');
    expect(rows).toEqual([{ "ID de oportunidad": "2GEvhqbrAgtPzsS9aCoc", Notas: "Primera línia\nSegona línia" }]);
  });

  it("exclou les dues proves de Roger i assigna les empreses confirmades", () => {
    const rows = [
      { "ID de oportunidad": "mViKUhVAbGnqlpkBC5h6" },
      { "ID de oportunidad": "jhizyW1BdHrAaWs16zq2" },
      { "ID de oportunidad": "2GEvhqbrAgtPzsS9aCoc" },
      { "ID de oportunidad": "7rl88UDwYs0KGU3r0BRG" },
      { "ID de oportunidad": "265JA3wFCtgIoX0ipWCX" },
    ];
    expect(selectedGhlOpportunities(rows).map(({ externalId, companyName }) => ({ externalId, companyName }))).toEqual([
      { externalId: "2GEvhqbrAgtPzsS9aCoc", companyName: "La Cabina" },
      { externalId: "7rl88UDwYs0KGU3r0BRG", companyName: null },
      { externalId: "265JA3wFCtgIoX0ipWCX", companyName: "Saló Guttié" },
    ]);
  });
});
