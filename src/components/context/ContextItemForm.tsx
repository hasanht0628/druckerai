"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContextItem, ContextCategory } from "@/types/context";

interface Props {
  initial?: Partial<ContextItem> | null;
  onSaved: () => void;
  onCancel: () => void;
}

const CATEGORIES: { value: ContextCategory; label: string }[] = [
  { value: "project", label: "Active Project" },
  { value: "goal", label: "Goal" },
  { value: "deadline", label: "Deadline" },
  { value: "priority", label: "Priority" },
  { value: "constraint", label: "Constraint" },
  { value: "preference", label: "Preference" },
];

export function ContextItemForm({ initial, onSaved, onCancel }: Props) {
  const [category, setCategory] = useState<ContextCategory>(
    initial?.category ?? "project"
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const method = initial?.id ? "PUT" : "POST";
    const body = {
      ...(initial?.id ? { id: initial.id } : {}),
      category,
      title,
      description: description || null,
      value: value || null,
      isActive,
    };

    const res = await fetch("/api/context", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(initial?.id ? "Item updated" : "Item added");
      onSaved();
    } else {
      toast.error("Failed to save item");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as ContextCategory)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            category === "project"
              ? "e.g. Series A fundraise"
              : category === "deadline"
              ? "e.g. Board meeting prep"
              : "e.g. Ship v2 by Q2"
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional context..."
          rows={3}
        />
      </div>

      {category === "deadline" && (
        <div className="space-y-2">
          <Label htmlFor="value">Due Date</Label>
          <Input
            id="value"
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      )}

      {category === "priority" && (
        <div className="space-y-2">
          <Label>Priority Level</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {initial?.id && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
