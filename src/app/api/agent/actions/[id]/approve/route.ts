import { NextResponse } from "next/server";
import { safeParseJson } from "@/lib/utils";
import { supabase } from "@/lib/db";
import { executeAgentTool, parseToolPayload } from "@/lib/agent/tools";
import type { AgentAction, AgentToolName } from "@/types/agent";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("AgentAction")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  const action = data as AgentAction;
  if (action.status !== "pending") {
    return NextResponse.json({ action });
  }

  try {
    const payload = parseToolPayload(
      action.type as AgentToolName,
      safeParseJson(action.payloadJson, {})
    );
    const result = await executeAgentTool(action.type as AgentToolName, payload);
    const { data: updated, error: updateError } = await supabase
      .from("AgentAction")
      .update({
        status: "executed",
        approvedAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        resultJson: JSON.stringify(result),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ action: updated });
  } catch (approvalError) {
    const { data: updated } = await supabase
      .from("AgentAction")
      .update({
        status: "failed",
        error:
          approvalError instanceof Error
            ? approvalError.message
            : "Approval execution failed",
      })
      .eq("id", id)
      .select()
      .single();
    return NextResponse.json({ action: updated }, { status: 500 });
  }
}
