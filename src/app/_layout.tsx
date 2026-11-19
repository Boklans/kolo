import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Download, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useDeckStore } from '@/stores/useDeckStore';
import { decodeDeckFromUrl, SharedDeckPayload } from '@/utils/deckShare';
import { triggerHaptic } from '@/utils/sound';

export default function RootLayout() {
  const router = useRouter();
  const [incomingSharedDeck, setIncomingSharedDeck] =
    useState<SharedDeckPayload | null>(null);

  const inspectIncomingUrl = useCallback((url: string | null | undefined) => {
    if (!url) return;
    const decoded = decodeDeckFromUrl(url);
    if (decoded) {
      setIncomingSharedDeck(decoded);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'kolo-hide-expo-devtools-gear';
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          expo-dev-toolbar,
          #expo-dev-toolbar,
          [data-expo-dev-overlay],
          [data-testid="devtools-button"],
          .__expo-dev-overlay {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
        document.head.appendChild(styleEl);
      }

      if (typeof window !== 'undefined') {
        inspectIncomingUrl(window.location.href);
        const onHashChange = () => inspectIncomingUrl(window.location.href);
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
      }
    }
  }, [inspectIncomingUrl]);

  useEffect(() => {
    Linking.getInitialURL()
      .then((initialUrl) => inspectIncomingUrl(initialUrl))
      .catch(() => {});

    const sub = Linking.addEventListener('url', (event) => {
      inspectIncomingUrl(event.url);
    });
    return () => {
      sub.remove();
    };
  }, [inspectIncomingUrl]);

  const handleConfirmImportDeck = () => {
    if (!incomingSharedDeck) return;
    const created = useDeckStore.getState().createCustomDeck({
      title: incomingSharedDeck.title,
      emoji: incomingSharedDeck.emoji,
      targetMode: incomingSharedDeck.targetMode,
      rawText: incomingSharedDeck.rawText,
    });
    setIncomingSharedDeck(null);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (window.location.hash.includes('deck=')) {
          window.history.replaceState(
            window.history.state,
            '',
            `${window.location.pathname}${window.location.search}`
          );
        }
      } catch {
        // ignore history error
      }
    }
    if (created) {
      triggerHaptic('success');
      router.push('/(tabs)/decks');
    }
  };

  const incomingCardCount = incomingSharedDeck
    ? incomingSharedDeck.rawText
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0).length
    : 0;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="setup/[mode]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="session"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>

      <Modal
        visible={incomingSharedDeck !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setIncomingSharedDeck(null)}
      >
        <View style={styles.importBackdrop}>
          <View style={styles.importCard}>
            <View style={styles.importHeader}>
              <View style={styles.importHeaderLeft}>
                <View style={styles.importEmojiBox}>
                  <Text style={styles.importEmoji}>
                    {incomingSharedDeck?.emoji || '🃏'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.importOverline}>
                    ДРУГ ПОДІЛИВСЯ КОЛОДОЮ
                  </Text>
                  <Text style={styles.importTitle} numberOfLines={1}>
                    {incomingSharedDeck?.title}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setIncomingSharedDeck(null)}
                style={styles.importCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Закрити"
              >
                <X size={17} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.importDesc}>
              У паку <Text style={styles.importCount}>{incomingCardCount}</Text>{' '}
              карток. Збережіть її у свої «Колоди», щоб одразу запускати у
              вечірках!
            </Text>

            <View style={styles.importActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIncomingSharedDeck(null)}
                style={styles.importLaterBtn}
              >
                <Text style={styles.importLaterText}>Пізніше</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleConfirmImportDeck}
                style={styles.importSaveBtn}
              >
                <Download size={16} color={COLORS.background} strokeWidth={2.6} />
                <Text style={styles.importSaveText}>Додати пак</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  importBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.88)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  importCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl + 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  importHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  importHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  importEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importEmoji: {
    fontSize: 22,
  },
  importOverline: {
    color: '#6EE7B7',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  importTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '900',
  },
  importCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importDesc: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  importCount: {
    color: COLORS.textPrimary,
    fontWeight: '900',
  },
  importActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  importLaterBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importLaterText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  importSaveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.crocodile,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipCrocodile,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  importSaveText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '900',
  },
});
