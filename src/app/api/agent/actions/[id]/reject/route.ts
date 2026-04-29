import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("AgentAction")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return NextResponse.json({ error: "Pending action not found" }, { status: 404 });
  }

  return NextResponse.json({ action: data });
}
