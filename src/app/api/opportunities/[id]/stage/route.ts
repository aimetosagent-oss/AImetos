import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError } from "@/lib/errors";
import { requireTenant } from "@/lib/tenant";
import { moveOpportunity } from "@/modules/pipeline/service";

const schema = z.object({
  stageId: z.string().min(1),
  lostReason: z.string().max(1_000).nullable().optional(),
  reason: z.string().max(1_000).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenant();
    const { id } = await params;
    const input = schema.parse(await request.json());
    const opportunity = await moveOpportunity(context, { opportunityId: id, ...input });
    return NextResponse.json({ opportunity });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Dades no vàlides" }, { status: 422 });
    const safe = publicError(error);
    return NextResponse.json({ message: safe.message }, { status: safe.status });
  }
}
