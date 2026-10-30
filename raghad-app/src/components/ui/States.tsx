import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ScreenState({
  title,
  message,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {children}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.action}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingState({ label = 'جارٍ التحميل...' }: { label?: string }) {
  return (
    <View style={styles.state} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.skeleton} />
      <View style={[styles.skeleton, styles.skeletonShort]} />
      <Text style={styles.stateMessage}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <View style={styles.buttonInner}>
        {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
        <Text style={styles.buttonText}>{label}</Text>
      </View>
    </Pressable>
  );
}

export const palette = {
  background: '#F6F9FD',
  surface: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  primaryBorder: '#DBEAFE',
  border: '#E2E8F0',
  cardBorder: '#EBF0F7',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  success: '#10B981',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#B45309',
};

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  body: {
    color: palette.muted,
    fontSize: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 23,
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    minHeight: 48,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    color: palette.text,
    backgroundColor: palette.surface,
    textAlign: 'right',
    fontSize: 15,
  },
  field: {
    gap: 6,
  },
  error: {
    color: palette.danger,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontSize: 14,
    fontWeight: '600',
  },
  inlineRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});

const styles = StyleSheet.create({
  state: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  stateTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateMessage: {
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  skeleton: {
    width: '100%',
    maxWidth: 300,
    height: 14,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  skeletonShort: {
    width: '60%',
  },
  action: {
    minHeight: 44,
    minWidth: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: palette.surface,
    borderColor: palette.primaryBorder,
    borderWidth: 1,
  },
  actionText: {
    color: palette.primary,
    fontWeight: '700',
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingHorizontal: 20,
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
