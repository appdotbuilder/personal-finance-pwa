import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type CreateCategoryInput, type Category } from '../schema';
import { eq } from 'drizzle-orm';

export const createCategory = async (input: CreateCategoryInput, userId: string): Promise<Category> => {
  try {
    // If parent_id is provided, verify it exists and belongs to the user
    if (input.parent_id) {
      const parentCategory = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.parent_id))
        .execute();

      if (parentCategory.length === 0) {
        throw new Error('Parent category not found');
      }

      if (parentCategory[0].user_id !== userId) {
        throw new Error('Parent category does not belong to user');
      }

      // Ensure parent and child have the same category_type
      if (parentCategory[0].category_type !== input.category_type) {
        throw new Error('Parent and child categories must have the same type');
      }
    }

    // Insert category record
    const result = await db.insert(categoriesTable)
      .values({
        user_id: userId,
        name: input.name,
        category_type: input.category_type,
        parent_id: input.parent_id || null,
        color: input.color || null,
        icon: input.icon || null,
        is_system: false
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
};