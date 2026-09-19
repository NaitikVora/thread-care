import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme';

type Props = {
  label: string;
  subLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress: () => void;
  large?: boolean;
};

// One consistent, very large, high-contrast tap target per action — the
// patient home screen should never ask someone to hunt for a small button
// (spec section 33: large touch targets, consistent placement).
export function BigActionButton({ label, subLabel, icon, color = colors.primary, onPress, large }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color, minHeight: large ? 128 : 96 },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={large ? 36 : 30} color={colors.white} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[typography.buttonLabel, large && styles.largeLabel]}>{label}</Text>
        {subLabel ? <Text style={typography.buttonSubLabel}>{subLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.round,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  largeLabel: {
    fontSize: 25,
  },
});
