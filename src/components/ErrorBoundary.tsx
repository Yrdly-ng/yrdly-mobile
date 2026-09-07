import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Props {
  children: React.ReactNode;
  /** When true, renders a compact inline error instead of full-screen */
  inline?: boolean;
  /** Label shown on the error screen so you know which screen crashed */
  screenName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const prefix = `[ErrorBoundary${this.props.screenName ? `:${this.props.screenName}` : ''}]`;
    console.error(`${prefix} Caught:`, error.message);

    // Explicitly stringify the full error object and stack to prevent truncation in RN Metro logs
    console.error(
      `${prefix} Full Error Object:`,
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    );
    console.error(`${prefix} Component Stack:\n`, info.componentStack);

  }

  handleRestart = () => {
    // Increment resetKey to force full remount of children tree
    this.setState(
      (prev: State) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }),
      () => {
        // Navigate to root to reset the navigator stack cleanly
        try {
          router.replace('/' as any);
        } catch (e) {
          // If router isn't ready yet, the setState above is enough
        }
      }
    );
  };

  render() {
    if (!this.state.hasError) {
      return (
        // Key forces full remount of children when resetKey changes
        <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
      );
    }

    if (this.props.inline) {
      return (
        <View style={styles.inline}>
          <Feather name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.inlineText}>Failed to load. </Text>
          <TouchableOpacity onPress={this.handleRestart}>
            <Text style={styles.inlineRetry}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Feather name="alert-triangle" size={52} color="#EF4444" />
        <Text style={styles.title}>Something went wrong</Text>
        {this.props.screenName && (
          <Text style={styles.screenName}>Screen: {this.props.screenName}</Text>
        )}
        <Text style={styles.subtitle}>
          The app ran into an unexpected error. Your data is safe.
        </Text>
        {__DEV__ && this.state.error && (
          <ScrollView style={styles.devBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.devText}>{this.state.error.message}</Text>
            <Text style={styles.devStack}>{this.state.error.stack}</Text>
          </ScrollView>
        )}
        <TouchableOpacity style={styles.btn} onPress={this.handleRestart}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 6,
    textAlign: 'center',
  },
  screenName: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  devBox: {
    maxHeight: 200,
    backgroundColor: '#1A0000',
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  devText: {
    fontSize: 12,
    color: '#FCA5A5',
    fontWeight: '700',
    marginBottom: 8,
  },
  devStack: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  btn: {
    backgroundColor: '#82E157',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  btnText: {
    color: '#050505',
    fontSize: 16,
    fontWeight: '700',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1A0000',
    borderRadius: 8,
    margin: 16,
  },
  inlineText: {
    fontSize: 13,
    color: '#FCA5A5',
    marginLeft: 8,
  },
  inlineRetry: {
    fontSize: 13,
    color: '#FCA5A5',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
