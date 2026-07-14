import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, publicError } from "@/lib/errors";
import { publicRequestIdentity } from "@/lib/request-identity";
import { submitPublicForm } from "@/modules/forms/service";

const MAX_REQUEST_BYTES = 64 * 1024;
const publicValue = z.union([z.string().max(10_000), z.boolean(), z.number().finite(), z.null()]);

const schema = z.object({
  requestId: z.uuid(),
  values: z
    .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,79}$/), publicValue)
    .refine((values) => Object.keys(values).length <= 50, "Hi ha massa camps"),
  consentAccepted: z.boolean().optional(),
  sourceUrl: z.string().max(2_000).optional(),
  utm: z
    .object({
      source: z.string().max(200).nullable().optional(),
      medium: z.string().max(200).nullable().optional(),
      campaign: z.string().max(200).nullable().optional(),
      term: z.string().max(200).nullable().optional(),
      content: z.string().max(200).nullable().optional(),
    })
    .optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const parsed = schema.parse(await readLimitedJson(request));
    const identity = publicRequestIdentity(request.headers);
    const result = await submitPublicForm({
      slug,
      requestId: parsed.requestId,
      values: parsed.values,
      consentAccepted: parsed.consentAccepted,
      sourceUrl: parsed.sourceUrl,
      referer: request.headers.get("referer") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ip: identity.ip,
      rateLimitKey: identity.rateLimitKey,
      utm: {
        source: parsed.utm?.source ?? undefined,
        medium: parsed.utm?.medium ?? undefined,
        campaign: parsed.utm?.campaign ?? undefined,
        term: parsed.utm?.term ?? undefined,
        content: parsed.utm?.content ?? undefined,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Petició no vàlida", errors: z.flattenError(error).fieldErrors }, { status: 422 });
    const safe = publicError(error);
    return NextResponse.json({ message: safe.message }, { status: safe.status });
  }
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new AppError("La petició és massa gran", "PAYLOAD_TOO_LARGE", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Falta el cos de la petició", "INVALID_JSON", 400);
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new AppError("La petició és massa gran", "PAYLOAD_TOO_LARGE", 413);
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AppError("El JSON no és vàlid", "INVALID_JSON", 400);
  }
}
