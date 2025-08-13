import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable } from '../db/schema';
import { type UpdateProfileInput, type CreateProfileInput } from '../schema';
import { updateProfile } from '../handlers/update_profile';
import { eq } from 'drizzle-orm';

// Test data
const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const otherUserId = '550e8400-e29b-41d4-a716-446655440001';

const createTestProfile = async (userId: string = testUserId) => {
  const profileInput: CreateProfileInput = {
    display_name: 'Original Name',
    email: 'original@example.com',
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/New_York'
  };

  const result = await db.insert(profilesTable)
    .values({
      user_id: userId,
      display_name: profileInput.display_name,
      email: profileInput.email,
      currency: profileInput.currency,
      locale: profileInput.locale,
      timezone: profileInput.timezone
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update profile with all fields', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      display_name: 'Updated Name',
      currency: 'EUR',
      locale: 'de-DE',
      timezone: 'Europe/Berlin'
    };

    const result = await updateProfile(updateInput, testUserId);

    // Verify all fields are updated
    expect(result.display_name).toEqual('Updated Name');
    expect(result.currency).toEqual('EUR');
    expect(result.locale).toEqual('de-DE');
    expect(result.timezone).toEqual('Europe/Berlin');
    expect(result.id).toEqual(profile.id);
    expect(result.user_id).toEqual(testUserId);
    expect(result.email).toEqual('original@example.com'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > profile.updated_at).toBe(true);
  });

  it('should update only provided fields', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      display_name: 'Partially Updated'
    };

    const result = await updateProfile(updateInput, testUserId);

    // Only display_name should be updated
    expect(result.display_name).toEqual('Partially Updated');
    expect(result.currency).toEqual('USD'); // Should remain unchanged
    expect(result.locale).toEqual('en-US'); // Should remain unchanged
    expect(result.timezone).toEqual('America/New_York'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > profile.updated_at).toBe(true);
  });

  it('should update currency and timezone only', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      currency: 'JPY',
      timezone: 'Asia/Tokyo'
    };

    const result = await updateProfile(updateInput, testUserId);

    expect(result.display_name).toEqual('Original Name'); // Should remain unchanged
    expect(result.currency).toEqual('JPY');
    expect(result.locale).toEqual('en-US'); // Should remain unchanged
    expect(result.timezone).toEqual('Asia/Tokyo');
  });

  it('should verify profile is saved to database', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      display_name: 'Database Verified',
      currency: 'GBP'
    };

    await updateProfile(updateInput, testUserId);

    // Query database directly to verify changes
    const profiles = await db.select()
      .from(profilesTable)
      .where(eq(profilesTable.id, profile.id))
      .execute();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].display_name).toEqual('Database Verified');
    expect(profiles[0].currency).toEqual('GBP');
    expect(profiles[0].locale).toEqual('en-US'); // Unchanged
    expect(profiles[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent profile', async () => {
    const nonExistentId = '550e8400-e29b-41d4-a716-999999999999';

    const updateInput: UpdateProfileInput = {
      id: nonExistentId,
      display_name: 'Should Fail'
    };

    await expect(updateProfile(updateInput, testUserId)).rejects.toThrow(/profile not found/i);
  });

  it('should throw error when user tries to update another user\'s profile', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      display_name: 'Unauthorized Update'
    };

    // Try to update with different user ID
    await expect(updateProfile(updateInput, otherUserId)).rejects.toThrow(/profile not found/i);
  });

  it('should handle updating to default values', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      currency: 'IDR',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta'
    };

    const result = await updateProfile(updateInput, testUserId);

    expect(result.currency).toEqual('IDR');
    expect(result.locale).toEqual('id-ID');
    expect(result.timezone).toEqual('Asia/Jakarta');
  });

  it('should handle empty string values correctly', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      display_name: '',
      currency: '',
      locale: '',
      timezone: ''
    };

    const result = await updateProfile(updateInput, testUserId);

    expect(result.display_name).toEqual('');
    expect(result.currency).toEqual('');
    expect(result.locale).toEqual('');
    expect(result.timezone).toEqual('');
  });

  it('should preserve other profile fields during update', async () => {
    const profile = await createTestProfile();

    const updateInput: UpdateProfileInput = {
      id: profile.id,
      display_name: 'Field Preservation Test'
    };

    const result = await updateProfile(updateInput, testUserId);

    // These fields should remain unchanged
    expect(result.id).toEqual(profile.id);
    expect(result.user_id).toEqual(profile.user_id);
    expect(result.email).toEqual(profile.email);
    expect(result.created_at).toEqual(profile.created_at);
    expect(result.deleted_at).toEqual(profile.deleted_at);
  });
});