/**
 * Shared domain types for EZXpire.
 * Person 1 owns this file — others import only; do not rewrite.
 */

export interface PantryItem {
  _id?: string;
  userId: string;
  name: string;
  category: string;
  purchaseDate: Date;
  expiresAt: Date;
  createdAt?: Date;
}

export interface ParsedLine {
  name: string;
  quantity?: string;
  category?: string;
}
