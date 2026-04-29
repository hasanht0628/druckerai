export type ContextCategory =
  | "project"
  | "goal"
  | "deadline"
  | "constraint"
  | "priority"
  | "preference";

export interface ContextItem {
  id: string;
  category: ContextCategory;
  title: string;
  description?: string | null;
  value?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
