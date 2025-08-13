import { db } from '../db';
import { profilesTable } from '../db/schema';
import { type UpdateProfileInput, type Profile } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateProfile = async (input: UpdateProfileInput, userId: string): Promise<Profile> => {
  try {
    // First verify the profile exists and belongs to the user
    const existingProfiles = await db.select()
      .from(profilesTable)
      .where(and(
        eq(profilesTable.id, input.id),
        eq(profilesTable.user_id, userId)
      ))
      .execute();

    if (existingProfiles.length === 0) {
      throw new Error('Profile not found or access denied');
    }

    // Build update values with only provided fields
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.display_name !== undefined) {
      updateValues.display_name = input.display_name;
    }
    if (input.currency !== undefined) {
      updateValues.currency = input.currency;
    }
    if (input.locale !== undefined) {
      updateValues.locale = input.locale;
    }
    if (input.timezone !== undefined) {
      updateValues.timezone = input.timezone;
    }

    // Update the profile
    const result = await db.update(profilesTable)
      .set(updateValues)
      .where(and(
        eq(profilesTable.id, input.id),
        eq(profilesTable.user_id, userId)
      ))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Profile update failed');
    }

    return result[0];
  } catch (error) {
    console.error('Profile update failed:', error);
    throw error;
  }
};