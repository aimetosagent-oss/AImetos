import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone, sanitizeText, slugify } from "@/lib/normalization";

describe("normalització", () => {
  it("normalitza correus", () => expect(normalizeEmail("  HELLO@EXAMPLE.COM ")).toBe("hello@example.com"));
  it("normalitza telèfons espanyols", () => expect(normalizePhone("612 345 678")).toBe("+34612345678"));
  it("respecta prefixos internacionals", () => expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678"));
  it("saneja caràcters de control", () => expect(sanitizeText(" Hola\u0000   món ")).toBe("Hola món"));
  it("crea slugs estables", () => expect(slugify("Demanar una demostració!")).toBe("demanar-una-demostracio"));
});
