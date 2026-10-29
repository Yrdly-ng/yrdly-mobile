import * as Sentry from '@sentry/react-native';
import { Text, type TextProps } from 'react-native';

/** Render fixed, non-sensitive interface copy in Sentry replay. Never pass user data. */
export function ReplayLabel({ children, ...props }: TextProps) {
  return (
    <Sentry.Unmask>
      <Text {...props}>{children}</Text>
    </Sentry.Unmask>
  );
}
