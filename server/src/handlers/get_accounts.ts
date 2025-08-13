import { type Account } from '../schema';

export async function getAccounts(userId: string): Promise<Account[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all user's accounts with current balances.
    // It should exclude soft-deleted accounts and order by is_default desc, created_at asc.
    return Promise.resolve([]);
}