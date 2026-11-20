import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BookOpen, Check, Lightbulb, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { GameType } from '@/types';
import { triggerHaptic } from '@/utils/sound';

interface QuickRulesModalProps {
  visible: boolean;
  gameType: GameType;
  onClose: () => void;
}

const RULES_CONTENT: Record<
  GameType,
  {
    title: string;
    accentColor: string;
    lipColor: string;
    subtitle: string;
    steps: { title: string; desc: string }[];
    tip: string;
  }
> = {
  alias: {
    title: 'Правила Еліасу',
    accentColor: COLORS.alias,
    lipColor: COLORS.lipAlias,
    subtitle: 'Пояснюй слова на шаленій швидкості без спільнокореневих.',
    steps: [
      {
        title: 'Свайп вгору — вгадано (+1 бал)',
        desc: 'Як тільки команда називає слово — тягни картку вгору або тисни «ВГАДАНО». Складні слова (3★) дають +2 бали.',
      },
      {
        title: 'Свайп вниз — пропуск',
        desc: 'Застряг? Пропускай слово. «Пас» (або свайп вниз) — перехід до наступної картки.',
      },
      {
        title: 'Чесний підсумок раунду',
        desc: 'Після завершення таймера можна в один дотик виправити спірне слово й одразу передати телефон наступній команді.',
      },
    ],
    tip: 'Штраф за пас (−1) та режим «Останнє слово для всіх» можна увімкнути в налаштуваннях лобі перед грою.',
  },
  crocodile: {
    title: 'Правила Крокодила',
    accentColor: COLORS.crocodile,
    lipColor: COLORS.lipCrocodile,
    subtitle: 'Показуй якомога більше фраз жестами й мімікою, поки йде таймер.',
    steps: [
      {
        title: '1. Тільки жести та міміка',
        desc: 'Показуй фразу з картки без жодних звуків, шепоту чи читання по губах. Можна сховати картку в 1 тап і покласти телефон на стіл.',
      },
      {
        title: '2. Вгадано — одразу наступна фраза',
        desc: 'Кожна відгадана фраза приносить +1 бал і миттєво відкриває нову картку. Складну фразу можна пропустити кнопкою «Пас».',
      },
      {
        title: '3. Підсумок і перевірка раунду',
        desc: 'Після 0:00 спірні фрази можна змінити в один тап і одразу передати хід наступній команді.',
      },
    ],
    tip: 'У налаштуваннях лобі можна обрати темп від 15 до 120 секунд, кількість кіл або перемкнути на класичний формат «1 фраза на хід (+2 бали)».',
  },
  taboo: {
    title: 'Правила Табу',
    accentColor: COLORS.taboo,
    lipColor: COLORS.lipTaboo,
    subtitle: 'Поясни головне слово, оминаючи 4 слова-пастки.',
    steps: [
      {
        title: '1. Пильний контроль суперника',
        desc: 'Гравець іншої команди стоїть поруч і контролює, щоб ведучий не сказав жодного слова з червоного блоку.',
      },
      {
        title: '2. Три чіткі кнопки',
        desc: '«Вгадали» (+1 бал), «Пас» (0 балів — пропустити важку картку), «Табу» (−1 бал за заборонене слово).',
      },
      {
        title: '3. Перевірка в кінці раунду',
        desc: 'Спірні картки можна змінити в один тап на екрані підсумку та одразу передати телефон далі.',
      },
    ],
    tip: 'Підбирай несподівані асоціації, культурні відсилки або описуй ситуацію, де зустрічається слово.',
  },
  spy: {
    title: 'Правила Шпигуна',
    accentColor: COLORS.spy,
    lipColor: COLORS.lipSpy,
    subtitle: 'Знайдіть того, хто прикидається і не знає локацію.',
    steps: [
      {
        title: 'Таємна роздача ролей',
        desc: 'Передавайте телефон по колу. Кожен затискає картку, читає свою локацію або бачить, що він Шпигун.',
      },
      {
        title: 'Питання по колу',
        desc: 'Ставте одне одному короткі питання про локацію («Як часто ти сюди ходиш?», «Що там пахне?»), не видаючи її прямо.',
      },
      {
        title: 'Голосування або вгадування',
        desc: 'Мирні перемагають, якщо вирахують шпигуна. Шпигун може в будь-який момент розкритися й назвати локацію для перемоги!',
      },
    ],
    tip: 'Якщо ти Шпигун — не мовчи і відповідай упевнено, але максимально абстрактно, щоб не суперечити іншим.',
  },
};

export function QuickRulesModal({
  visible,
  gameType,
  onClose,
}: QuickRulesModalProps) {
  const data = RULES_CONTENT[gameType];

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { borderColor: `${data.accentColor}4D` }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: `${data.accentColor}22`,
                    borderColor: `${data.accentColor}45`,
                  },
                ]}
              >
                <BookOpen size={18} color={data.accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.overline, { color: data.accentColor }]}>
                  ШВИДКІ ПРАВИЛА
                </Text>
                <Text style={styles.title}>{data.title}</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.closeBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Закрити правила"
            >
              <X size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{data.subtitle}</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.stepsList}
          >
            {data.steps.map((step, idx) => (
              <View key={step.title} style={styles.stepCard}>
                <View
                  style={[
                    styles.stepNumBox,
                    { backgroundColor: data.accentColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepNumText,
                      gameType === 'crocodile' && { color: COLORS.background },
                    ]}
                  >
                    {idx + 1}
                  </Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}

            <View
              style={[
                styles.tipBox,
                {
                  backgroundColor: `${data.accentColor}16`,
                  borderColor: `${data.accentColor}38`,
                },
              ]}
            >
              <View style={styles.tipHeaderRow}>
                <Lightbulb size={15} color={data.accentColor} />
                <Text style={[styles.tipLabel, { color: data.accentColor }]}>
                  ПОРАДА ДЛЯ ПЕРЕМОГИ
                </Text>
              </View>
              <Text style={styles.tipText}>{data.tip}</Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.doneBtn,
              {
                backgroundColor: data.accentColor,
                borderBottomColor: data.lipColor,
              },
            ]}
            onPress={handleClose}
          >
            <Check
              size={18}
              color={gameType === 'crocodile' ? COLORS.background : COLORS.textPrimary}
              strokeWidth={2.8}
            />
            <Text
              style={[
                styles.doneBtnText,
                gameType === 'crocodile' && { color: COLORS.background },
              ]}
            >
              Зрозуміло, до гри!
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.86)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl + 4,
    borderWidth: 1,
    padding: SPACING.xl,
    maxHeight: '88%',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  stepsList: {
    gap: 10,
    paddingVertical: 4,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  stepNumBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  stepContent: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  stepDesc: {
    color: COLORS.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  tipBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 6,
    marginTop: 2,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  tipText: {
    color: COLORS.textPrimary,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderBottomWidth: 4,
    marginTop: 4,
  },
  doneBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
