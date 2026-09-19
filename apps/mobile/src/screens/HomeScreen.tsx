import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { patient, upcomingEvent } from '@recallar/shared';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';

import { BigActionButton } from '../components/BigActionButton';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radii, spacing, typography } from '../theme';
import { formatDateLabel, formatTimeLabel, getGreeting, lowerFirst } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const now = useMemo(() => new Date(), []);

  const greetingLine = `${getGreeting(now)}, ${patient.preferredName}.`;
  const dateLine = `Today is ${formatDateLabel(now)}.`;
  const eventLine = upcomingEvent
    ? `You have ${lowerFirst(upcomingEvent.title)} at ${formatTimeLabel(upcomingEvent.time)}.`
    : undefined;

  function playOrientation() {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    const utterance = [greetingLine, dateLine, eventLine].filter(Boolean).join(' ');
    setSpeaking(true);
    Speech.speak(utterance, { rate: 0.95, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false) });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.orientationCard}>
          <View style={styles.orientationTextWrap}>
            <Text style={typography.greeting}>{greetingLine}</Text>
            <Text style={[typography.orientation, styles.orientationLine]}>{dateLine}</Text>
            {eventLine ? <Text style={[typography.orientation, styles.orientationLine]}>{eventLine}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speaking ? 'Stop reading aloud' : 'Read this aloud'}
            onPress={playOrientation}
            style={({ pressed }) => [styles.speakerButton, pressed && styles.speakerButtonPressed]}
          >
            <Ionicons name={speaking ? 'volume-high' : 'volume-medium-outline'} size={26} color={colors.primary} />
          </Pressable>
        </View>

        <Text style={[typography.sectionTitle, styles.sectionTitle]}>Today’s Activities</Text>

        <BigActionButton
          label="Start Memory Quest"
          subLabel="A little activity, just for you"
          icon="compass"
          color={colors.primary}
          large
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'Memory Quest',
              icon: 'compass',
              message: 'Your first quest is being set up. Check back soon!',
            })
          }
        />
        <BigActionButton
          label="My Memories"
          subLabel="Photos and stories you love"
          icon="images"
          color={colors.secondary}
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'My Memories',
              icon: 'images',
              message: 'Your memory cards are being gathered here.',
            })
          }
        />
        <BigActionButton
          label="Help Me Remember"
          subLabel="Ask a simple question"
          icon="chatbubble-ellipses"
          color={colors.accent}
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'Help Me Remember',
              icon: 'chatbubble-ellipses',
              message: 'Soon you can ask questions like “Who is Sarah?”',
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  orientationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orientationTextWrap: { flex: 1, paddingRight: spacing.md },
  orientationLine: { marginTop: spacing.xs },
  speakerButton: {
    width: 52,
    height: 52,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerButtonPressed: { opacity: 0.7 },
  sectionTitle: { marginBottom: spacing.md },
});
