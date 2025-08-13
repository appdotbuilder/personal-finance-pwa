import { db } from '../db';
import { transactionsTable, accountsTable, categoriesTable } from '../db/schema';
import { eq, and, gte, lte, inArray, isNull, SQL } from 'drizzle-orm';

interface ExportOptions {
    format: 'csv' | 'json' | 'excel';
    startDate?: Date;
    endDate?: Date;
    accountIds?: string[];
    categoryIds?: string[];
    includeDeleted?: boolean;
}

interface TransactionExportData {
    id: string;
    transaction_date: string;
    description: string;
    amount: string;
    transaction_type: string;
    account_name: string;
    to_account_name?: string;
    category_name?: string;
    notes?: string;
    tags: string;
}

export async function exportTransactions(
    userId: string, 
    options: ExportOptions
): Promise<{ data: string; filename: string; mimeType: string }> {
    try {
        // Build conditions array
        const conditions: SQL<unknown>[] = [eq(transactionsTable.user_id, userId)];

        // Apply date filters
        if (options.startDate) {
            conditions.push(gte(transactionsTable.transaction_date, options.startDate));
        }
        if (options.endDate) {
            conditions.push(lte(transactionsTable.transaction_date, options.endDate));
        }

        // Apply account filter
        if (options.accountIds && options.accountIds.length > 0) {
            conditions.push(inArray(transactionsTable.account_id, options.accountIds));
        }

        // Apply category filter
        if (options.categoryIds && options.categoryIds.length > 0) {
            conditions.push(inArray(transactionsTable.category_id, options.categoryIds));
        }

        // Handle deleted records
        if (!options.includeDeleted) {
            conditions.push(isNull(transactionsTable.deleted_at));
        }

        // Get transactions first
        const baseTransactionQuery = db.select()
            .from(transactionsTable);

        // Apply conditions
        const transactionQuery = conditions.length > 1 
            ? baseTransactionQuery.where(and(...conditions))
            : baseTransactionQuery.where(conditions[0]);

        const transactions = await transactionQuery.execute();

        // Get related account and category data
        const accountIds = [...new Set([
            ...transactions.map(t => t.account_id),
            ...transactions.map(t => t.to_account_id).filter((id): id is string => id !== null)
        ])];

        const categoryIds = transactions
            .map(t => t.category_id)
            .filter((id): id is string => id !== null);

        // Fetch accounts
        const accounts = accountIds.length > 0 
            ? await db.select()
                .from(accountsTable)
                .where(inArray(accountsTable.id, accountIds))
                .execute()
            : [];

        // Fetch categories
        const categories = categoryIds.length > 0
            ? await db.select()
                .from(categoriesTable)
                .where(inArray(categoriesTable.id, categoryIds))
                .execute()
            : [];

        // Create lookup maps
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        const categoryMap = new Map(categories.map(c => [c.id, c]));

        // Transform data for export with Indonesian locale formatting
        const exportData: TransactionExportData[] = transactions.map(transaction => ({
            id: transaction.id,
            transaction_date: formatDate(transaction.transaction_date),
            description: transaction.description,
            amount: formatCurrency(parseFloat(transaction.amount)),
            transaction_type: transaction.transaction_type,
            account_name: accountMap.get(transaction.account_id)?.name || '',
            to_account_name: transaction.to_account_id 
                ? (accountMap.get(transaction.to_account_id)?.name || '') 
                : '',
            category_name: transaction.category_id 
                ? (categoryMap.get(transaction.category_id)?.name || '') 
                : '',
            notes: transaction.notes || '',
            tags: Array.isArray(transaction.tags) ? (transaction.tags as string[]).join(', ') : ''
        }));

        // Generate output based on format
        const timestamp = new Date().toISOString().split('T')[0];
        
        switch (options.format) {
            case 'csv':
                return {
                    data: generateCSV(exportData),
                    filename: `transactions_${timestamp}.csv`,
                    mimeType: 'text/csv'
                };
            case 'json':
                return {
                    data: JSON.stringify(exportData, null, 2),
                    filename: `transactions_${timestamp}.json`,
                    mimeType: 'application/json'
                };
            case 'excel':
                return {
                    data: generateExcelCSV(exportData),
                    filename: `transactions_${timestamp}.csv`,
                    mimeType: 'text/csv'
                };
            default:
                throw new Error(`Unsupported format: ${options.format}`);
        }
    } catch (error) {
        console.error('Transaction export failed:', error);
        throw error;
    }
}

// Helper function to format dates in Indonesian locale
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

// Helper function to format currency in Indonesian locale
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(amount);
}

// Generate CSV format
function generateCSV(data: TransactionExportData[]): string {
    const headers = [
        'ID',
        'Tanggal',
        'Deskripsi',
        'Jumlah',
        'Tipe',
        'Akun',
        'Akun Tujuan',
        'Kategori',
        'Catatan',
        'Tag'
    ];
    
    const rows = data.map(row => [
        row.id,
        row.transaction_date,
        `"${row.description}"`,
        row.amount,
        row.transaction_type,
        `"${row.account_name}"`,
        `"${row.to_account_name}"`,
        `"${row.category_name}"`,
        `"${row.notes}"`,
        `"${row.tags}"`
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// Generate Excel-compatible CSV format (UTF-8 BOM)
function generateExcelCSV(data: TransactionExportData[]): string {
    const csv = generateCSV(data);
    return '\uFEFF' + csv; // Add BOM for Excel UTF-8 support
}