import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type UpdateAccountInput } from '../schema';
import { updateAccount } from '../handlers/update_account';
import { eq, and } from 'drizzle-orm';

const testUserId = '550e8400-e29b-41d4-a716-446655440000';
const otherUserId = '550e8400-e29b-41d4-a716-446655440001';

// Test helper to create account
const createTestAccount = async (userId: string = testUserId, isDefault: boolean = false) => {
  const result = await db.insert(accountsTable)
    .values({
      user_id: userId,
      name: 'Test Account',
      account_type: 'checking',
      balance: '1000.00',
      initial_balance: '500.00',
      currency: 'IDR',
      color: '#ff0000',
      icon: 'bank',
      is_default: isDefault
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateAccount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update account name', async () => {
    const account = await createTestAccount();
    
    const input: UpdateAccountInput = {
      id: account.id,
      name: 'Updated Account Name'
    };

    const result = await updateAccount(input, testUserId);

    expect(result.name).toEqual('Updated Account Name');
    expect(result.id).toEqual(account.id);
    expect(result.user_id).toEqual(testUserId);
    expect(result.account_type).toEqual('checking');
    expect(typeof result.balance).toBe('number');
    expect(result.balance).toEqual(1000);
    expect(typeof result.initial_balance).toBe('number');
    expect(result.initial_balance).toEqual(500);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update account color and icon', async () => {
    const account = await createTestAccount();
    
    const input: UpdateAccountInput = {
      id: account.id,
      color: '#00ff00',
      icon: 'wallet'
    };

    const result = await updateAccount(input, testUserId);

    expect(result.color).toEqual('#00ff00');
    expect(result.icon).toEqual('wallet');
    expect(result.name).toEqual('Test Account'); // Should remain unchanged
  });

  it('should set color and icon to null', async () => {
    const account = await createTestAccount();
    
    const input: UpdateAccountInput = {
      id: account.id,
      color: null,
      icon: null
    };

    const result = await updateAccount(input, testUserId);

    expect(result.color).toBeNull();
    expect(result.icon).toBeNull();
  });

  it('should set account as default', async () => {
    const account = await createTestAccount();
    
    const input: UpdateAccountInput = {
      id: account.id,
      is_default: true
    };

    const result = await updateAccount(input, testUserId);

    expect(result.is_default).toBe(true);
  });

  it('should unset previous default when setting new default', async () => {
    // Create two accounts, first one as default
    const defaultAccount = await createTestAccount(testUserId, true);
    const secondAccount = await createTestAccount(testUserId, false);
    
    const input: UpdateAccountInput = {
      id: secondAccount.id,
      is_default: true
    };

    const result = await updateAccount(input, testUserId);

    expect(result.is_default).toBe(true);

    // Verify the previously default account is no longer default
    const previousDefault = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, defaultAccount.id))
      .execute();

    expect(previousDefault[0].is_default).toBe(false);
  });

  it('should update multiple fields at once', async () => {
    const account = await createTestAccount();
    
    const input: UpdateAccountInput = {
      id: account.id,
      name: 'Multi-Updated Account',
      color: '#0000ff',
      icon: 'credit-card',
      is_default: true
    };

    const result = await updateAccount(input, testUserId);

    expect(result.name).toEqual('Multi-Updated Account');
    expect(result.color).toEqual('#0000ff');
    expect(result.icon).toEqual('credit-card');
    expect(result.is_default).toBe(true);
  });

  it('should save changes to database', async () => {
    const account = await createTestAccount();
    
    const input: UpdateAccountInput = {
      id: account.id,
      name: 'Database Test Account',
      color: '#purple'
    };

    const result = await updateAccount(input, testUserId);

    // Verify changes persisted in database
    const dbAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, account.id))
      .execute();

    expect(dbAccount).toHaveLength(1);
    expect(dbAccount[0].name).toEqual('Database Test Account');
    expect(dbAccount[0].color).toEqual('#purple');
    expect(dbAccount[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent account', async () => {
    const input: UpdateAccountInput = {
      id: '550e8400-e29b-41d4-a716-999999999999',
      name: 'Non-existent Account'
    };

    await expect(updateAccount(input, testUserId)).rejects.toThrow(/account not found/i);
  });

  it('should throw error when updating account owned by different user', async () => {
    const account = await createTestAccount(otherUserId);
    
    const input: UpdateAccountInput = {
      id: account.id,
      name: 'Unauthorized Update'
    };

    await expect(updateAccount(input, testUserId)).rejects.toThrow(/account not found/i);
  });

  it('should handle setting is_default to false', async () => {
    const account = await createTestAccount(testUserId, true);
    
    const input: UpdateAccountInput = {
      id: account.id,
      is_default: false
    };

    const result = await updateAccount(input, testUserId);

    expect(result.is_default).toBe(false);
  });

  it('should only update specified fields', async () => {
    const account = await createTestAccount();
    const originalName = account.name;
    const originalColor = account.color;
    
    const input: UpdateAccountInput = {
      id: account.id,
      icon: 'new-icon'
    };

    const result = await updateAccount(input, testUserId);

    expect(result.icon).toEqual('new-icon');
    expect(result.name).toEqual(originalName); // Should remain unchanged
    expect(result.color).toEqual(originalColor); // Should remain unchanged
  });

  it('should handle default switching across multiple accounts correctly', async () => {
    // Create three accounts
    const account1 = await createTestAccount(testUserId, true);
    const account2 = await createTestAccount(testUserId, false);
    const account3 = await createTestAccount(testUserId, false);
    
    // Set account2 as default
    const input: UpdateAccountInput = {
      id: account2.id,
      is_default: true
    };

    await updateAccount(input, testUserId);

    // Verify only account2 is default
    const allAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, testUserId))
      .execute();

    const defaultAccounts = allAccounts.filter(acc => acc.is_default);
    expect(defaultAccounts).toHaveLength(1);
    expect(defaultAccounts[0].id).toEqual(account2.id);

    // Verify the others are not default
    const nonDefaultAccounts = allAccounts.filter(acc => !acc.is_default);
    expect(nonDefaultAccounts).toHaveLength(2);
    expect(nonDefaultAccounts.map(acc => acc.id)).toContain(account1.id);
    expect(nonDefaultAccounts.map(acc => acc.id)).toContain(account3.id);
  });
});