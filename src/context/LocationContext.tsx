import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../hooks/use-supabase-auth';

export interface LocationFilter {
  state?: string;
  lga?: string;
  ward?: string;
}

interface LocationContextType {
  userProfileLocation: LocationFilter | null;
  activeFilter: LocationFilter | null;
  setGlobalFilter: (filter: LocationFilter | null) => void;
  hasLocation: boolean;
  displayLabel: string;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const GLOBAL_FILTER_STORAGE_KEY = 'yrdly_global_filter';

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  const userState = profile?.home_state || profile?.location?.state || undefined;
  const userLga = profile?.home_lga || profile?.location?.lga || undefined;
  const userWard = profile?.home_ward || profile?.location?.ward || undefined;
  const hasLocation = !!userState;

  const userProfileLocation: LocationFilter | null = hasLocation 
    ? { state: userState, lga: userLga, ward: userWard } 
    : null;

  const [activeFilter, setActiveFilterRaw] = useState<LocationFilter | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasInitializedRef = React.useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    const loadPersistedFilter = async () => {
      try {
        if (hasLocation && userState && userLga) {
          setActiveFilterRaw({ state: userState, lga: userLga });
        } else if (hasLocation && userState) {
          setActiveFilterRaw({ state: userState });
        } else {
          setActiveFilterRaw(null);
        }
      } catch {
        // Fallback
        setActiveFilterRaw(null);
      } finally {
        setIsInitialized(true);
      }
    };
    loadPersistedFilter();
  }, [hasLocation, userState, userLga]);

  const setGlobalFilter = useCallback(async (newFilter: LocationFilter | null) => {
    setActiveFilterRaw(newFilter);
    try {
      if (newFilter) {
        await SecureStore.setItemAsync(GLOBAL_FILTER_STORAGE_KEY, JSON.stringify(newFilter));
      } else {
        await SecureStore.setItemAsync(GLOBAL_FILTER_STORAGE_KEY, JSON.stringify({ isAllNigeria: true }));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Build the display label
  let displayLabel = "All Nigeria";
  if (activeFilter) {
    if (activeFilter.lga && activeFilter.state) {
      displayLabel = `${activeFilter.lga}, ${activeFilter.state}`;
    } else if (activeFilter.state) {
      displayLabel = `${activeFilter.state} State`;
    }
  } else if (!isInitialized && hasLocation) {
    displayLabel = userLga ? `${userLga}, ${userState}` : `${userState} State`;
  }

  return (
    <LocationContext.Provider
      value={{
        userProfileLocation,
        activeFilter,
        setGlobalFilter,
        hasLocation,
        displayLabel,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}
