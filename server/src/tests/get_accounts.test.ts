import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable } from '../db/schema';
import { getAccounts } from '../handlers/get_accounts';

describe('getAccounts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  const otherUserId = '550e8400-e29b-41d4-a716-446655440001';

  it('should return empty array when user has no accounts', async () => {
    const result = await getAccounts(testUserId);
    
    expect(result).toEqual([]);
  });

  it('should return user accounts with converted numeric fields', async () => {
    // Create test account
    const testAccount = {
      user_id: testUserId,
      name: 'Test Account',
      account_type: 'checking' as const,
      balance: '1500.75',
      initial_balance: '1000.00',
      currency: 'IDR',
      is_default: false
    };

    await db.insert(accountsTable)
      .values(testAccount)
      .execute();

    const result = await getAccounts(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Test Account');
    expect(result[0].account_type).toEqual('checking');
    expect(result[0].balance).toEqual(1500.75);
    expect(result[0].initial_balance).toEqual(1000.00);
    expect(typeof result[0].balance).toEqual('number');
    expect(typeof result[0].initial_balance).toEqual('number');
    expect(result[0].user_id).toEqual(testUserId);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should order by is_default desc, created_at asc', async () => {
    // Create accounts with different timestamps
    const account1 = {
      user_id: testUserId,
      name: 'First Account',
      account_type: 'checking' as const,
      balance: '1000.00',
      initial_balance: '1000.00',
      is_default: false
    };

    const account2 = {
      user_id: testUserId,
      name: 'Default Account',
      account_type: 'savings' as const,
      balance: '2000.00',
      initial_balance: '2000.00',
      is_default: true
    };

    const account3 = {
      user_id: testUserId,
      name: 'Third Account',
      account_type: 'cash' as const,
      balance: '500.00',
      initial_balance: '500.00',
      is_default: false
    };

    // Insert in non-default order
    await db.insert(accountsTable)
      .values([account1, account2, account3])
      .execute();

    const result = await getAccounts(testUserId);

    expect(result).toHaveLength(3);
    // Default account should be first
    expect(result[0].name).toEqual('Default Account');
    expect(result[0].is_default).toBe(true);
    
    // Non-default accounts should be ordered by created_at
    expect(result[1].name).toEqual('First Account');
    expect(result[1].is_default).toBe(false);
    expect(result[2].name).toEqual('Third Account');
    expect(result[2].is_default).toBe(false);
  });

  it('should exclude soft-deleted accounts', async () => {
    // Create active account
    const activeAccount = {
      user_id: testUserId,
      name: 'Active Account',
      account_type: 'checking' as const,
      balance: '1000.00',
      initial_balance: '1000.00'
    };

    // Create soft-deleted account
    const deletedAccount = {
      user_id: testUserId,
      name: 'Deleted Account',
      account_type: 'savings' as const,
      balance: '2000.00',
      initial_balance: '2000.00',
      deleted_at: new Date()
    };

    await db.insert(accountsTable)
      .values([activeAccount, deletedAccount])
      .execute();

    const result = await getAccounts(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Active Account');
    expect(result[0].deleted_at).toBeNull();
  });

  it('should only return accounts for specified user', async () => {
    // Create accounts for different users
    const userAccount = {
      user_id: testUserId,
      name: 'User Account',
      account_type: 'checking' as const,
      balance: '1000.00',
      initial_balance: '1000.00'
    };

    const otherAccount = {
      user_id: otherUserId,
      name: 'Other User Account',
      account_type: 'savings' as const,
      balance: '2000.00',
      initial_balance: '2000.00'
    };

    await db.insert(accountsTable)
      .values([userAccount, otherAccount])
      .execute();

    const result = await getAccounts(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('User Account');
    expect(result[0].user_id).toEqual(testUserId);
  });

  it('should handle all account types correctly', async () => {
    const accounts = [
      {
        user_id: testUserId,
        name: 'Checking Account',
        account_type: 'checking' as const,
        balance: '1000.00',
        initial_balance: '1000.00'
      },
      {
        user_id: testUserId,
        name: 'Savings Account',
        account_type: 'savings' as const,
        balance: '2000.00',
        initial_balance: '2000.00'
      },
      {
        user_id: testUserId,
        name: 'Credit Account',
        account_type: 'credit' as const,
        balance: '-500.00',
        initial_balance: '0.00'
      },
      {
        user_id: testUserId,
        name: 'Cash Account',
        account_type: 'cash' as const,
        balance: '100.50',
        initial_balance: '100.00'
      },
      {
        user_id: testUserId,
        name: 'Investment Account',
        account_type: 'investment' as const,
        balance: '5000.75',
        initial_balance: '4000.00'
      }
    ];

    await db.insert(accountsTable)
      .values(accounts)
      .execute();

    const result = await getAccounts(testUserId);

    expect(result).toHaveLength(5);
    
    // Verify all account types are present
    const accountTypes = result.map(acc => acc.account_type).sort();
    expect(accountTypes).toEqual(['cash', 'checking', 'credit', 'investment', 'savings']);
    
    // Verify negative balance handling
    const creditAccount = result.find(acc => acc.account_type === 'credit');
    expect(creditAccount?.balance).toEqual(-500.00);
    expect(typeof creditAccount?.balance).toEqual('number');
  });

  it('should include all account properties', async () => {
    const testAccount = {
      user_id: testUserId,
      name: 'Full Test Account',
      account_type: 'checking' as const,
      balance: '1234.56',
      initial_balance: '1000.00',
      currency: 'USD',
      color: '#FF5733',
      icon: 'bank',
      is_default: true
    };

    await db.insert(accountsTable)
      .values(testAccount)
      .execute();

    const result = await getAccounts(testUserId);

    expect(result).toHaveLength(1);
    const account = result[0];
    
    expect(account.name).toEqual('Full Test Account');
    expect(account.account_type).toEqual('checking');
    expect(account.balance).toEqual(1234.56);
    expect(account.initial_balance).toEqual(1000.00);
    expect(account.currency).toEqual('USD');
    expect(account.color).toEqual('#FF5733');
    expect(account.icon).toEqual('bank');
    expect(account.is_default).toBe(true);
    expect(account.created_at).toBeInstanceOf(Date);
    expect(account.updated_at).toBeInstanceOf(Date);
    expect(account.deleted_at).toBeNull();
  });
});