import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type CreateAccountInput } from '../schema';
import { createAccount } from '../handlers/create_account';
import { eq } from 'drizzle-orm';

// Test user ID
const testUserId = '123e4567-e89b-12d3-a456-426614174000';

// Complete test inputs with all fields
const basicAccountInput: CreateAccountInput = {
  name: 'Test Checking Account',
  account_type: 'checking',
  initial_balance: 1000,
  currency: 'IDR',
  color: '#FF5733',
  icon: 'bank',
  is_default: false
};

const defaultAccountInput: CreateAccountInput = {
  name: 'Primary Savings',
  account_type: 'savings',
  initial_balance: 5000,
  currency: 'USD',
  color: '#33FF57',
  icon: 'piggy-bank',
  is_default: true
};

const minimalAccountInput: CreateAccountInput = {
  name: 'Basic Account',
  account_type: 'cash',
  initial_balance: 0,
  currency: 'IDR',
  color: null,
  icon: null,
  is_default: false
};

describe('createAccount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a basic account with all fields', async () => {
    const result = await createAccount(basicAccountInput, testUserId);

    // Verify all fields are set correctly
    expect(result.name).toEqual('Test Checking Account');
    expect(result.account_type).toEqual('checking');
    expect(result.balance).toEqual(1000);
    expect(result.initial_balance).toEqual(1000);
    expect(result.currency).toEqual('IDR');
    expect(result.color).toEqual('#FF5733');
    expect(result.icon).toEqual('bank');
    expect(result.is_default).toEqual(false);
    expect(result.user_id).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.deleted_at).toBeNull();

    // Verify numeric types are correct
    expect(typeof result.balance).toBe('number');
    expect(typeof result.initial_balance).toBe('number');
  });

  it('should create account with default flag set to true', async () => {
    const result = await createAccount(defaultAccountInput, testUserId);

    expect(result.name).toEqual('Primary Savings');
    expect(result.account_type).toEqual('savings');
    expect(result.balance).toEqual(5000);
    expect(result.initial_balance).toEqual(5000);
    expect(result.currency).toEqual('USD');
    expect(result.is_default).toEqual(true);
    expect(result.user_id).toEqual(testUserId);
  });

  it('should create account with minimal fields and handle defaults', async () => {
    const result = await createAccount(minimalAccountInput, testUserId);

    expect(result.name).toEqual('Basic Account');
    expect(result.account_type).toEqual('cash');
    expect(result.balance).toEqual(0);
    expect(result.initial_balance).toEqual(0);
    expect(result.currency).toEqual('IDR');
    expect(result.color).toBeNull();
    expect(result.icon).toBeNull();
    expect(result.is_default).toEqual(false);
    expect(result.user_id).toEqual(testUserId);
  });

  it('should save account to database correctly', async () => {
    const result = await createAccount(basicAccountInput, testUserId);

    // Query using proper drizzle syntax
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(accounts).toHaveLength(1);
    const dbAccount = accounts[0];
    
    expect(dbAccount.name).toEqual('Test Checking Account');
    expect(dbAccount.account_type).toEqual('checking');
    expect(parseFloat(dbAccount.balance)).toEqual(1000);
    expect(parseFloat(dbAccount.initial_balance)).toEqual(1000);
    expect(dbAccount.currency).toEqual('IDR');
    expect(dbAccount.color).toEqual('#FF5733');
    expect(dbAccount.icon).toEqual('bank');
    expect(dbAccount.is_default).toEqual(false);
    expect(dbAccount.user_id).toEqual(testUserId);
    expect(dbAccount.created_at).toBeInstanceOf(Date);
    expect(dbAccount.updated_at).toBeInstanceOf(Date);
    expect(dbAccount.deleted_at).toBeNull();
  });

  it('should handle different account types correctly', async () => {
    const accountTypes = ['checking', 'savings', 'credit', 'cash', 'investment'] as const;
    
    for (const accountType of accountTypes) {
      const input: CreateAccountInput = {
        name: `${accountType} Account`,
        account_type: accountType,
        initial_balance: 100,
        currency: 'IDR',
        color: null,
        icon: null,
        is_default: false
      };

      const result = await createAccount(input, testUserId);
      expect(result.account_type).toEqual(accountType);
      expect(result.name).toEqual(`${accountType} Account`);
    }
  });

  it('should handle zero initial balance correctly', async () => {
    const zeroBalanceInput: CreateAccountInput = {
      name: 'Zero Balance Account',
      account_type: 'checking',
      initial_balance: 0,
      currency: 'IDR',
      color: null,
      icon: null,
      is_default: false
    };

    const result = await createAccount(zeroBalanceInput, testUserId);

    expect(result.balance).toEqual(0);
    expect(result.initial_balance).toEqual(0);
    expect(typeof result.balance).toBe('number');
    expect(typeof result.initial_balance).toBe('number');
  });

  it('should handle large balance amounts correctly', async () => {
    const largeBalanceInput: CreateAccountInput = {
      name: 'High Balance Account',
      account_type: 'investment',
      initial_balance: 999999.99,
      currency: 'USD',
      color: null,
      icon: null,
      is_default: false
    };

    const result = await createAccount(largeBalanceInput, testUserId);

    expect(result.balance).toEqual(999999.99);
    expect(result.initial_balance).toEqual(999999.99);
    expect(typeof result.balance).toBe('number');
    expect(typeof result.initial_balance).toBe('number');
  });

  it('should create multiple accounts for same user', async () => {
    const firstAccount = await createAccount(basicAccountInput, testUserId);
    const secondAccountInput: CreateAccountInput = {
      name: 'Second Account',
      account_type: 'savings',
      initial_balance: 2000,
      currency: 'IDR',
      color: null,
      icon: null,
      is_default: false
    };
    const secondAccount = await createAccount(secondAccountInput, testUserId);

    expect(firstAccount.id).not.toEqual(secondAccount.id);
    expect(firstAccount.user_id).toEqual(testUserId);
    expect(secondAccount.user_id).toEqual(testUserId);

    // Verify both accounts exist in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, testUserId))
      .execute();

    expect(accounts).toHaveLength(2);
  });
});