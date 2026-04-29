export type RelationshipType =
  | "advisor"
  | "teammate"
  | "investor"
  | "customer"
  | "partner";

export interface Collaborator {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  relationshipType: RelationshipType;
  importanceLevel: number;
  preferredCadence?: string | null;
  notes?: string | null;
  lastContactDate?: Date | null;
  nextFollowUpDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
