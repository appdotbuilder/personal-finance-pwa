import { db } from '../db';
import { transactionsTable, accountsTable, categoriesTable } from '../db/schema';
import { type Transaction, type TransactionType } from '../schema';
import { eq, and, isNull } from 'drizzle-orm';

interface ImportTransactionData {
    date: string;
    description: string;
    amount: number;
    category?: string;
    account?: string;
    type: 'income' | 'expense' | 'transfer';
}

interface ImportResult {
    imported: number;
    skipped: number;
    errors: string[];
}

export async function importTransactions(
    data: ImportTransactionData[], 
    userId: string,
    defaultAccountId?: string
): Promise<ImportResult> {
    try {
        const result: ImportResult = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        if (!data || data.length === 0) {
            result.errors.push('No transaction data provided');
            return result;
        }

        // Fetch user's accounts and categories for mapping
        const [accounts, categories] = await Promise.all([
            db.select()
                .from(accountsTable)
                .where(and(
                    eq(accountsTable.user_id, userId),
                    isNull(accountsTable.deleted_at)
                ))
                .execute(),
            db.select()
                .from(categoriesTable)
                .where(and(
                    eq(categoriesTable.user_id, userId),
                    isNull(categoriesTable.deleted_at)
                ))
                .execute()
        ]);

        // Create lookup maps for efficient searching
        const accountMap = new Map(accounts.map(acc => [acc.name.toLowerCase(), acc.id]));
        const categoryMap = new Map(categories.map(cat => [cat.name.toLowerCase(), cat.id]));

        // Validate default account exists if provided
        if (defaultAccountId && !accounts.find(acc => acc.id === defaultAccountId)) {
            result.errors.push('Default account not found or does not belong to user');
            return result;
        }

        // Process each transaction
        for (let i = 0; i < data.length; i++) {
            const transaction = data[i];
            const rowNumber = i + 1;

            try {
                // Validate required fields
                if (!transaction.date || !transaction.description || transaction.amount === undefined) {
                    result.errors.push(`Row ${rowNumber}: Missing required fields (date, description, or amount)`);
                    result.skipped++;
                    continue;
                }

                // Validate and parse date
                const transactionDate = new Date(transaction.date);
                if (isNaN(transactionDate.getTime())) {
                    result.errors.push(`Row ${rowNumber}: Invalid date format: ${transaction.date}`);
                    result.skipped++;
                    continue;
                }

                // Validate amount
                if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
                    result.errors.push(`Row ${rowNumber}: Amount must be a positive number`);
                    result.skipped++;
                    continue;
                }

                // Validate transaction type
                const validTypes: TransactionType[] = ['income', 'expense', 'transfer'];
                if (!validTypes.includes(transaction.type)) {
                    result.errors.push(`Row ${rowNumber}: Invalid transaction type: ${transaction.type}`);
                    result.skipped++;
                    continue;
                }

                // Resolve account ID
                let accountId: string;
                if (transaction.account) {
                    const mappedAccountId = accountMap.get(transaction.account.toLowerCase());
                    if (mappedAccountId) {
                        accountId = mappedAccountId;
                    } else {
                        result.errors.push(`Row ${rowNumber}: Account not found: ${transaction.account}`);
                        result.skipped++;
                        continue;
                    }
                } else if (defaultAccountId) {
                    accountId = defaultAccountId;
                } else {
                    result.errors.push(`Row ${rowNumber}: No account specified and no default account provided`);
                    result.skipped++;
                    continue;
                }

                // Resolve category ID (optional)
                let categoryId: string | null = null;
                if (transaction.category) {
                    const mappedCategoryId = categoryMap.get(transaction.category.toLowerCase());
                    if (mappedCategoryId) {
                        categoryId = mappedCategoryId;
                    } else {
                        // Category not found - log warning but don't skip transaction
                        result.errors.push(`Row ${rowNumber}: Category not found: ${transaction.category} - transaction imported without category`);
                    }
                }

                // Check for potential duplicate (same account, amount, description, and date within same day)
                const startOfDay = new Date(transactionDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(transactionDate);
                endOfDay.setHours(23, 59, 59, 999);

                const existingTransactions = await db.select()
                    .from(transactionsTable)
                    .where(and(
                        eq(transactionsTable.user_id, userId),
                        eq(transactionsTable.account_id, accountId),
                        eq(transactionsTable.description, transaction.description),
                        isNull(transactionsTable.deleted_at)
                    ))
                    .execute();

                // Convert amounts for comparison
                const duplicateExists = existingTransactions.some(existing => {
                    const existingAmount = parseFloat(existing.amount);
                    const existingDate = new Date(existing.transaction_date);
                    return Math.abs(existingAmount - transaction.amount) < 0.01 && // Allow for small floating point differences
                           existingDate >= startOfDay && existingDate <= endOfDay;
                });

                if (duplicateExists) {
                    result.errors.push(`Row ${rowNumber}: Potential duplicate transaction skipped`);
                    result.skipped++;
                    continue;
                }

                // Insert transaction
                await db.insert(transactionsTable)
                    .values({
                        user_id: userId,
                        account_id: accountId,
                        category_id: categoryId,
                        transaction_type: transaction.type,
                        amount: transaction.amount.toString(), // Convert number to string for numeric column
                        description: transaction.description,
                        transaction_date: transactionDate,
                        tags: [] // Default empty tags
                    })
                    .execute();

                result.imported++;

            } catch (error) {
                console.error(`Error processing transaction row ${rowNumber}:`, error);
                result.errors.push(`Row ${rowNumber}: Database error - ${error instanceof Error ? error.message : 'Unknown error'}`);
                result.skipped++;
            }
        }

        return result;

    } catch (error) {
        console.error('Import transactions failed:', error);
        throw error;
    }
}