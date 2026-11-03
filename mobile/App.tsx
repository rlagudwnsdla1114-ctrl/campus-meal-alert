import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { MealType } from '../ai-recommendation/src/types';
import { meals, mealNames } from './meals';
import { recommendations } from './recommendations';

export default function App() {
  const [selected, setSelected] = useState<MealType | 'all'>('all');
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
  const filters: (MealType | 'all')[] = ['all', ...mealTypes];
  const visibleRecommendations = recommendations.filter((item) => selected === 'all' || item.meal === selected);
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>오늘의 학식</Text>
          <Text style={styles.date}>{today}</Text>
          <Text style={styles.title}>오늘은 뭐 먹지?</Text>
          <Text style={styles.subtitle}>조식부터 석식까지, 오늘의 식단을 확인해요.</Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>예시 식단·추천 · 실제 학교 식단이나 AI 분석 결과가 아닙니다</Text>
          </View>
          <Text style={styles.section}>오늘의 식단</Text>
          <View style={styles.filters}>
            {filters.map((type) => (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === type }}
                onPress={() => setSelected(type)}
                style={[styles.button, selected === type && styles.activeButton]}
              >
                <Text style={[styles.buttonText, selected === type && styles.activeText]}>
                  {type === 'all' ? '전체' : mealNames[type]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.section}>나를 위한 추천</Text>
          <Text style={styles.subtitle}>
            {selected === 'all' ? '전체 끼니' : mealNames[selected]} 추천 {visibleRecommendations.length}개
          </Text>
          {visibleRecommendations.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.mealTitle}>추천 메뉴가 없어요.</Text>
              <Text style={styles.dish}>선택한 끼니에는 선호 음식과 맞는 추천이 없어요.</Text>
              <Text style={styles.subtitle}>아래 식단을 확인하거나 다른 끼니를 선택해 보세요.</Text>
            </View>
          ) : visibleRecommendations.map((item) => (
            <View key={`${item.meal}-${item.menu}`} style={[styles.card, styles.recommendationCard]}>
              <Text style={styles.recommendationLabel}>{mealNames[item.meal]} · 추천 메뉴</Text>
              <Text style={styles.menuTitle}>{item.menu}</Text>
              <Text style={styles.dish}>선호 음식: {item.matchedFood}</Text>
              <Text style={styles.subtitle}>{item.reason}</Text>
            </View>
          ))}
          <Text style={styles.section}>선택한 끼니의 식단</Text>
          {mealTypes.filter((type) => selected === 'all' || selected === type).map((type) => (
            <View key={type} style={styles.card}>
              <Text style={styles.mealTitle}>{mealNames[type]}</Text>
              {meals[type].length === 0 ? (
                <Text style={styles.dish}>등록된 식단이 없어요.</Text>
              ) : meals[type].map((dish, index) => (
                <Text key={`${dish}-${index}`} style={styles.dish}>{dish}</Text>
              ))}
            </View>
          ))}
          <Text style={styles.footer}>추천은 예시 데이터입니다. 실제 AI 추천 연결과 알림은 준비 중이에요.</Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F3' },
  content: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
  brand: { color: '#236B52', fontSize: 16, fontWeight: '700' },
  date: { color: '#63736A', fontSize: 14, marginTop: 28 },
  title: { color: '#1E2F27', fontSize: 30, fontWeight: '700', marginTop: 8 },
  subtitle: { color: '#63736A', fontSize: 14, lineHeight: 22, marginTop: 10 },
  notice: { backgroundColor: '#E6EFE8', borderRadius: 12, padding: 14, marginTop: 24 },
  noticeText: { color: '#236B52', fontSize: 13, lineHeight: 20 },
  section: { color: '#1E2F27', fontSize: 20, fontWeight: '700', marginTop: 28 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4 },
  button: { flex: 1, minHeight: 48, padding: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 12 },
  activeButton: { backgroundColor: '#236B52' },
  buttonText: { color: '#63736A', fontSize: 14, fontWeight: '600' },
  activeText: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, marginTop: 14 },
  mealTitle: { color: '#236B52', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  dish: { color: '#1E2F27', fontSize: 16, lineHeight: 25, marginTop: 6 },
  recommendationCard: { borderWidth: 1, borderColor: '#B8D8C6', backgroundColor: '#F0F8F2' },
  recommendationLabel: { color: '#236B52', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  menuTitle: { color: '#1E2F27', fontSize: 21, fontWeight: '700' },
  footer: { color: '#63736A', fontSize: 13, lineHeight: 21, marginTop: 24, marginBottom: 12 },
});
