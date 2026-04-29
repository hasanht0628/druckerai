"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  onAdded: () => void;
}

export function AddTaskInput({ onAdded }: Props) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !value.trim()) return;
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value.trim() }),
    });

    if (res.ok) {
      setValue("");
      onAdded();
      // Background re-prioritize
      fetch("/api/tasks/prioritize", { method: "POST" })
        .then(() => onAdded())
        .catch(() => {});
    } else {
      toast.error("Failed to add task");
    }

    setLoading(false);
  }

  return (
    <div className="relative flex items-center">
      <Plus className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        className="h-11 border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
        placeholder="Add a task — Drucker will prioritize it"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
      />
    </div>
  );
}
