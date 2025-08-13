import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type Category } from '../schema';
import { eq, or, isNull, and } from 'drizzle-orm';

export const getCategories = async (userId: string): Promise<Category[]> => {
  try {
    // Fetch all categories for the user and system categories, excluding deleted ones
    const results = await db.select()
      .from(categoriesTable)
      .where(
        and(
          or(
            eq(categoriesTable.user_id, userId),
            eq(categoriesTable.is_system, true)
          ),
          isNull(categoriesTable.deleted_at)
        )
      )
      .execute();

    // Convert date fields and return
    return results.map(category => ({
      ...category,
      created_at: new Date(category.created_at),
      updated_at: new Date(category.updated_at),
      deleted_at: category.deleted_at ? new Date(category.deleted_at) : null
    }));
  } catch (error) {
    console.error('Category retrieval failed:', error);
    throw error;
  }
};