import { type CreateAccountInput, type Account } from '../schema';

export async function createAccount(input: CreateAccountInput, userId: string): Promise<Account> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is creating a new financial account (checking, savings, credit, etc.).
    // It should set the initial balance and mark as default if specified.
    return Promise.resolve({
        id: '00000000-0000-0000-0000-000000000000', // Placeholder ID
        user_id: userId,
        name: input.name,
        account_type: input.account_type,
        balance: input.initial_balance || 0,
        initial_balance: input.initial_balance || 0,
        currency: input.currency || 'IDR',
        color: input.color || null,
        icon: input.icon || null,
        is_default: input.is_default || false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
    } as Account);
}