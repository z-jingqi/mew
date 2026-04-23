import type { Db } from '@mew/database';
import { schema } from '@mew/database';

/**
 * Seeded on signup. Users can rename/delete freely afterwards.
 */
export const DEFAULT_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Food', icon: '🍜' },
  { name: 'Transport', icon: '🚕' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Health', icon: '💊' },
  { name: 'Bills', icon: '🧾' },
  { name: 'Other', icon: '✨' },
];

export async function seedDefaultCategories(db: Db, userId: string): Promise<void> {
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({
    id: crypto.randomUUID(),
    userId,
    name: c.name,
    icon: c.icon,
    sortOrder: i,
  }));
  await db.insert(schema.categories).values(rows);
}
