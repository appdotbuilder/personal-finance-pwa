import { db } from '../db';
import { profilesTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Profile } from '../schema';

export const getProfile = async (userId: string): Promise<Profile | null> => {
  try {
    const results = await db.select()
      .from(profilesTable)
      .where(eq(profilesTable.user_id, userId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('Profile retrieval failed:', error);
    throw error;
  }
};