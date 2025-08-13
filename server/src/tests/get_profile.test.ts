import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { profilesTable } from '../db/schema';
import { getProfile } from '../handlers/get_profile';

// Test data
const testUserId = crypto.randomUUID();
const testProfile = {
  user_id: testUserId,
  display_name: 'John Doe',
  email: 'john.doe@example.com',
  currency: 'USD',
  locale: 'en-US',
  timezone: 'America/New_York'
};

describe('getProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return profile when user exists', async () => {
    // Create a test profile
    await db.insert(profilesTable)
      .values(testProfile)
      .execute();

    const result = await getProfile(testUserId);

    expect(result).toBeDefined();
    expect(result!.user_id).toEqual(testUserId);
    expect(result!.display_name).toEqual('John Doe');
    expect(result!.email).toEqual('john.doe@example.com');
    expect(result!.currency).toEqual('USD');
    expect(result!.locale).toEqual('en-US');
    expect(result!.timezone).toEqual('America/New_York');
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.deleted_at).toBeNull();
  });

  it('should return null when user does not exist', async () => {
    const nonExistentUserId = crypto.randomUUID();
    
    const result = await getProfile(nonExistentUserId);

    expect(result).toBeNull();
  });

  it('should return profile with default values when created with minimal data', async () => {
    const minimalProfile = {
      user_id: testUserId,
      display_name: 'Minimal User',
      email: 'minimal@example.com'
      // currency, locale, timezone should use defaults
    };

    await db.insert(profilesTable)
      .values(minimalProfile)
      .execute();

    const result = await getProfile(testUserId);

    expect(result).toBeDefined();
    expect(result!.display_name).toEqual('Minimal User');
    expect(result!.email).toEqual('minimal@example.com');
    expect(result!.currency).toEqual('IDR'); // Default value
    expect(result!.locale).toEqual('id-ID'); // Default value
    expect(result!.timezone).toEqual('Asia/Jakarta'); // Default value
  });

  it('should handle soft-deleted profiles correctly', async () => {
    const deletedProfile = {
      ...testProfile,
      deleted_at: new Date()
    };

    await db.insert(profilesTable)
      .values(deletedProfile)
      .execute();

    const result = await getProfile(testUserId);

    // Should still return the profile even if soft-deleted
    expect(result).toBeDefined();
    expect(result!.deleted_at).toBeInstanceOf(Date);
  });

  it('should return the correct profile when multiple profiles exist', async () => {
    const otherUserId = crypto.randomUUID();
    const otherProfile = {
      user_id: otherUserId,
      display_name: 'Jane Smith',
      email: 'jane.smith@example.com'
    };

    // Insert multiple profiles
    await db.insert(profilesTable)
      .values([testProfile, otherProfile])
      .execute();

    const result = await getProfile(testUserId);

    expect(result).toBeDefined();
    expect(result!.user_id).toEqual(testUserId);
    expect(result!.display_name).toEqual('John Doe');
    expect(result!.email).toEqual('john.doe@example.com');
    
    // Ensure we didn't get the other profile
    expect(result!.display_name).not.toEqual('Jane Smith');
  });
});