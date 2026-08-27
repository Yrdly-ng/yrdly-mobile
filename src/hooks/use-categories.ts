import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Category {
  id: string;
  name: string;
  type: string;
}

const FALLBACK_CATEGORIES: Record<string, Category[]> = {
  event: [
    { id: 'evt-1', name: 'Party', type: 'event' },
    { id: 'evt-2', name: 'Networking', type: 'event' },
    { id: 'evt-3', name: 'Sports', type: 'event' },
    { id: 'evt-4', name: 'Workshop', type: 'event' },
    { id: 'evt-5', name: 'Other', type: 'event' },
  ],
  marketplace: [
    { id: 'mkt-1', name: 'Electronics', type: 'marketplace' },
    { id: 'mkt-2', name: 'Furniture', type: 'marketplace' },
    { id: 'mkt-3', name: 'Fashion', type: 'marketplace' },
    { id: 'mkt-4', name: 'Appliances', type: 'marketplace' },
    { id: 'mkt-5', name: 'Vehicles/Autos', type: 'marketplace' },
    { id: 'mkt-6', name: 'Food & Groceries', type: 'marketplace' },
    { id: 'mkt-7', name: 'Real Estate & Rentals', type: 'marketplace' },
    { id: 'mkt-8', name: 'Other', type: 'marketplace' },
  ],
  report: [
    { id: 'rpt-1', name: 'Inappropriate Content', type: 'report' },
    { id: 'rpt-2', name: 'Spam', type: 'report' },
    { id: 'rpt-3', name: 'Harassment', type: 'report' },
    { id: 'rpt-4', name: 'Other', type: 'report' },
  ],
};

export function useCategories(type: 'marketplace' | 'event' | 'report') {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error: fetchError } = await supabase
          .from('categories')
          .select('id, name, type')
          .eq('type', type)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        if (data && data.length > 0) {
          setCategories(data);
        } else {
          setCategories(FALLBACK_CATEGORIES[type] || []);
        }
      } catch (err: any) {
        console.error(`Error fetching ${type} categories, using fallback:`, err);
        setCategories(FALLBACK_CATEGORIES[type] || []);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, [type]);

  return { categories, loading, error };
}
