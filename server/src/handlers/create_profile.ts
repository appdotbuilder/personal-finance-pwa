import { db } from '../db';
import { profilesTable, accountsTable, categoriesTable } from '../db/schema';
import { type CreateProfileInput, type Profile } from '../schema';

export const createProfile = async (input: CreateProfileInput, userId: string): Promise<Profile> => {
  try {
    // Create the profile record
    const profileResult = await db.insert(profilesTable)
      .values({
        user_id: userId,
        display_name: input.display_name,
        email: input.email,
        currency: input.currency,
        locale: input.locale,
        timezone: input.timezone
      })
      .returning()
      .execute();

    const profile = profileResult[0];

    // Create default account (main checking account)
    await db.insert(accountsTable)
      .values({
        user_id: userId,
        name: 'Main Account',
        account_type: 'checking',
        balance: '0',
        initial_balance: '0',
        currency: input.currency,
        is_default: true
      })
      .execute();

    // Create default expense categories
    const defaultExpenseCategories = [
      { name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
      { name: 'Transportation', icon: '🚗', color: '#4ECDC4' },
      { name: 'Shopping', icon: '🛒', color: '#45B7D1' },
      { name: 'Bills & Utilities', icon: '💡', color: '#96CEB4' },
      { name: 'Healthcare', icon: '🏥', color: '#FFEAA7' },
      { name: 'Entertainment', icon: '🎬', color: '#DDA0DD' },
      { name: 'Education', icon: '📚', color: '#74B9FF' },
      { name: 'Personal Care', icon: '💄', color: '#FD79A8' }
    ];

    // Create default income categories
    const defaultIncomeCategories = [
      { name: 'Salary', icon: '💰', color: '#00B894' },
      { name: 'Business', icon: '💼', color: '#6C5CE7' },
      { name: 'Investment', icon: '📈', color: '#A29BFE' },
      { name: 'Other Income', icon: '💸', color: '#FDCB6E' }
    ];

    // Insert expense categories
    for (const category of defaultExpenseCategories) {
      await db.insert(categoriesTable)
        .values({
          user_id: userId,
          name: category.name,
          category_type: 'expense',
          color: category.color,
          icon: category.icon,
          is_system: true
        })
        .execute();
    }

    // Insert income categories
    for (const category of defaultIncomeCategories) {
      await db.insert(categoriesTable)
        .values({
          user_id: userId,
          name: category.name,
          category_type: 'income',
          color: category.color,
          icon: category.icon,
          is_system: true
        })
        .execute();
    }

    return profile;
  } catch (error) {
    console.error('Profile creation failed:', error);
    throw error;
  }
};