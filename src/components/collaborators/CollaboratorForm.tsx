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
import type { Collaborator, RelationshipType } from "@/types/collaborator";

interface Props {
  initial?: Collaborator | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function CollaboratorForm({ initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(
    initial?.relationshipType ?? "teammate"
  );
  const [importanceLevel, setImportanceLevel] = useState(
    initial?.importanceLevel ?? 3
  );
  const [preferredCadence, setPreferredCadence] = useState(
    initial?.preferredCadence ?? ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lastContactDate, setLastContactDate] = useState(
    initial?.lastContactDate
      ? new Date(initial.lastContactDate).toISOString().split("T")[0]
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const url = initial?.id
      ? `/api/collaborators/${initial.id}`
      : "/api/collaborators";
    const method = initial?.id ? "PUT" : "POST";

    // Calculate next follow-up based on cadence
    let nextFollowUpDate: string | null = null;
    if (lastContactDate && preferredCadence) {
      const last = new Date(lastContactDate);
      const cadenceDays: Record<string, number> = {
        weekly: 7,
        biweekly: 14,
        monthly: 30,
        quarterly: 90,
      };
      const days = cadenceDays[preferredCadence] ?? 30;
      last.setDate(last.getDate() + days);
      nextFollowUpDate = last.toISOString().split("T")[0];
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: email || null,
        role: role || null,
        relationshipType,
        importanceLevel,
        preferredCadence: preferredCadence || null,
        notes: notes || null,
        lastContactDate: lastContactDate || null,
        nextFollowUpDate,
      }),
    });

    if (res.ok) {
      toast.success(initial?.id ? "Collaborator updated" : "Collaborator added");
      onSaved();
    } else {
      toast.error("Failed to save");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role / Title</Label>
          <Input
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Lead Investor"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Relationship Type</Label>
          <Select
            value={relationshipType}
            onValueChange={(v) => setRelationshipType(v as RelationshipType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["advisor", "teammate", "investor", "customer", "partner"].map(
                (t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Importance (1–5)</Label>
          <Select
            value={String(importanceLevel)}
            onValueChange={(v) => setImportanceLevel(parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} — {["Low", "Below avg", "Average", "High", "Critical"][n - 1]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Preferred Cadence</Label>
          <Select
            value={preferredCadence}
            onValueChange={setPreferredCadence}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Bi-weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastContact">Last Contact</Label>
          <Input
            id="lastContact"
            type="date"
            value={lastContactDate}
            onChange={(e) => setLastContactDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context, relationship history, what they care about…"
          rows={3}
        />
      </div>

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
