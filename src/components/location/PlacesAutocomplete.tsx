import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import type { TextInputProps } from 'react-native';
import {
  GooglePlacesAutocomplete as NativePlacesAutocomplete,
  type GooglePlacesAutocompleteRef,
} from 'react-native-google-places-autocomplete';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase/supabase';
import { WEB_APP_URL } from '@/lib/network/api';

type NativeProps = React.ComponentPropsWithoutRef<typeof NativePlacesAutocomplete>;
type Props = Omit<NativeProps, 'query' | 'requestUrl'> & { query?: NativeProps['query'] };

// Enable only after the matching web endpoint and server key pass QA.
const PROXY_ENABLED = process.env.EXPO_PUBLIC_MAPS_PROXY_ENABLED === 'true';

const AuthenticatedPlacesAutocomplete = forwardRef<GooglePlacesAutocompleteRef, Props>(
  function AuthenticatedPlacesAutocomplete(props, ref) {
    const { user } = useAuth();
    const [identity, setIdentity] = useState<{ userId: string; token: string } | null>(null);

    useEffect(() => {
      let active = true;
      let revision = 0;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        revision++;
        if (active)
          setIdentity(session ? { userId: session.user.id, token: session.access_token } : null);
      });
      const initialRevision = revision;
      void supabase.auth
        .getSession()
        .then(({ data: { session } }) => {
          if (active && revision === initialRevision) {
            setIdentity(session ? { userId: session.user.id, token: session.access_token } : null);
          }
        })
        .catch(() => {
          if (active && revision === initialRevision) setIdentity(null);
        });
      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }, []);

    const token = identity?.userId === user?.id ? identity?.token : undefined;
    const requestUrl = useMemo<NonNullable<NativeProps['requestUrl']>>(() => {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      return { url: `${WEB_APP_URL}/api/maps`, useOnPlatform: 'all', headers };
    }, [token]);

    return (
      <NativePlacesAutocomplete
        {...props}
        key={user?.id ?? 'signed-out'}
        ref={ref}
        requestUrl={requestUrl}
        isNewPlacesAPI={false}
        query={{ ...props.query, key: 'server-proxy', components: 'country:ng' }}
        textInputProps={{
          ...props.textInputProps,
          editable: Boolean(token) && (props.textInputProps as TextInputProps)?.editable !== false,
        }}
      />
    );
  }
);

export const GooglePlacesAutocomplete = forwardRef<GooglePlacesAutocompleteRef, Props>(
  function GooglePlacesAutocomplete(props, ref) {
    if (PROXY_ENABLED) return <AuthenticatedPlacesAutocomplete {...props} ref={ref} />;
    return (
      <NativePlacesAutocomplete
        {...props}
        ref={ref}
        query={{ ...props.query, key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '' }}
      />
    );
  }
);
