import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ComingSoon'>;

// A warm placeholder for screens not yet built in this pass, so every home
// screen button leads somewhere instead of feeling broken during a demo.
export function ComingSoonScreen({ route }: Props) {
  const { icon, title, message } = route.params;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={48} color={colors.primary} />
        </View>
        <Text style={typography.sectionTitle}>{title}</Text>
        <Text style={[typography.body, styles.message]}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  message: { textAlign: 'center', marginTop: spacing.sm, color: colors.textMuted },
});
