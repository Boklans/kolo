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
        desc: 'Застряг? Пропускай слово. Увага: якщо увімкнено штраф, пропуск забирає −1 бал.',
      },
      {
        title: 'Перевірка та фінал ходу',
        desc: 'Коли вийде час, останнє слово можуть перехопити суперники. Після цього можна поправити бали в підсумку.',
      },
    ],
    tip: 'Не називай частини загаданого слова, переклади іншою мовою чи рими — за це слово зараховувати не можна.',
  },
  crocodile: {
    title: 'Правила Крокодила',
    accentColor: COLORS.crocodile,
    lipColor: COLORS.lipCrocodile,
    subtitle: 'Жодних звуків — тільки тіло, жести та акторська гра.',
    steps: [
      {
        title: 'Показуй мовчки',
        desc: 'Не можна говорити, шепотіти чи артикулювати губами букви. Можна показувати кількість слів на пальцях.',
      },
      {
        title: 'Секретний перегляд фрази',
        desc: 'Затисни картку на екрані, щоб прочитати фразу, і відпусти — вона знову сховається від підглядань.',
      },
      {
        title: 'Вгадано або пас',
        desc: 'Якщо команда вгадала фразу до кінця таймера — натискай зелену кнопку. У наступному раунді показує інший учасник.',
      },
    ],
    tip: 'Спочатку покажи, скільки слів у фразі та яке з них найпростіше — так команда швидше зловить контекст.',
  },
  taboo: {
    title: 'Правила Табу',
    accentColor: COLORS.taboo,
    lipColor: COLORS.lipTaboo,
    subtitle: 'Поясни головне слово, оминаючи 4 слова-пастки.',
    steps: [
      {
        title: 'Пильний контроль суперника',
        desc: 'Суперник сидить поруч із ведучим і дивиться в екран, щоб зловити порушення.',
      },
      {
        title: 'Слова-табу заборонені',
        desc: 'Не можна називати ані головне слово, ані 4 заборонені слова під ним, ані їхні спільнокореневі.',
      },
      {
        title: 'Штраф за фол',
        desc: 'Порушив заборону? Суперник тисне «ТАБУ / ФОЛ» (−1 бал) і картка миттєво змінюється.',
      },
    ],
    tip: 'Пояснюй через асоціації, емоції, історичні події або протилежності — так легше обійти очевидні слова-пастки.',
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
