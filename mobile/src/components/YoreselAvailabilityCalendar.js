import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { YORESEL_CALENDAR_BARS } from '../constants/yoreselTimeSlots';

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const CELL_PCT = '14.28%';

const SLOT_BG = {
  empty: { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' },
  pending: { backgroundColor: '#FFE0B2', borderColor: '#FFB74D' },
  full: { backgroundColor: '#FFCDD2', borderColor: '#E57373' },
};

/** Eski tek katmanlı gün kaydı veya dilim alt kaydı */
export function getSlotAvailabilityStatus(entry) {
  if (!entry) return 'empty';
  const approved = Number(entry.approved) || 0;
  const pending = Number(entry.pending) || 0;
  if (approved > 0) return 'full';
  if (pending > 0) return 'pending';
  return 'empty';
}

function mergeSlotStatuses(...entries) {
  let hasFull = false;
  let hasPending = false;
  entries.forEach((entry) => {
    const st = getSlotAvailabilityStatus(entry);
    if (st === 'full') hasFull = true;
    if (st === 'pending') hasPending = true;
  });
  if (hasFull) return 'full';
  if (hasPending) return 'pending';
  return 'empty';
}

/** Takvim çizgisi: gündüz veya akşam; tam_gun her iki çizgiyi etkiler */
export function getCalendarBarStatus(dayEntry, barId) {
  if (!dayEntry || typeof dayEntry !== 'object') return 'empty';
  const tam = dayEntry.tam_gun;
  if (barId === 'gunduz') return mergeSlotStatuses(dayEntry.gunduz, tam);
  if (barId === 'aksam') return mergeSlotStatuses(dayEntry.aksam, tam);
  return 'empty';
}

/** Gün özeti (tek renk gerektiğinde) */
export function getDayAvailabilityStatus(entry) {
  if (!entry) return 'empty';
  if (entry.gunduz || entry.aksam || entry.tam_gun) {
    const g = getCalendarBarStatus(entry, 'gunduz');
    const a = getCalendarBarStatus(entry, 'aksam');
    if (g === 'full' && a === 'full') return 'full';
    if (g === 'full' || a === 'full') return 'full';
    if (g === 'pending' || a === 'pending') return 'pending';
    return 'empty';
  }
  return getSlotAvailabilityStatus(entry);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function dateKeyFromYMD(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const sun0 = first.getDay();
  const mondayFirst = (sun0 + 6) % 7;
  const cells = [];
  for (let i = 0; i < mondayFirst; i += 1) cells.push(null);
  for (let d = 1; d <= lastDay; d += 1) cells.push(d);
  return cells;
}

export default function YoreselAvailabilityCalendar({
  byDate = {},
  year,
  monthIndex,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  selectedDateKey,
}) {
  const cells = buildMonthCells(year, monthIndex);
  const title = `${MONTH_NAMES_TR[monthIndex]} ${year}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={onPrevMonth} hitSlop={8}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{title}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={onNextMonth} hitSlop={8}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotEmpty]} />
          <Text style={styles.legendText}>Boş</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotPending]} />
          <Text style={styles.legendText}>Bekleyen</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotFull]} />
          <Text style={styles.legendText}>Dolu (onaylı)</Text>
        </View>
      </View>

      <View style={styles.slotLegendCol}>
        {YORESEL_CALENDAR_BARS.map((s, idx) => (
          <Text key={s.id} style={styles.slotLegendLine}>
            {idx + 1}. çizgi — {s.label} ({s.range})
          </Text>
        ))}
        <Text style={styles.slotLegendNote}>
          İki çizgi de kırmızıysa tam gün dolu demektir.
        </Text>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={styles.weekLabel}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (day == null) {
            return <View key={`e-${idx}`} style={styles.cell} />;
          }
          const dateKey = dateKeyFromYMD(year, monthIndex, day);
          const dayEntry = byDate[dateKey];
          const isSelected = selectedDateKey === dateKey;

          return (
            <TouchableOpacity
              key={dateKey}
              style={[styles.cell, isSelected && styles.cellSelected]}
              onPress={() => onSelectDay && onSelectDay(dateKey)}
              activeOpacity={onSelectDay ? 0.75 : 1}
              disabled={!onSelectDay}
            >
              <Text style={styles.cellDay}>{day}</Text>
              <View style={styles.slotStack}>
                {YORESEL_CALENDAR_BARS.map((s) => {
                  const status = getCalendarBarStatus(dayEntry, s.id);
                  const bg = SLOT_BG[status] || SLOT_BG.empty;
                  return (
                    <View
                      key={s.id}
                      style={[styles.slotBar, { backgroundColor: bg.backgroundColor, borderColor: bg.borderColor }]}
                    />
                  );
                })}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontSize: 22,
    color: '#333',
    fontWeight: '700',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  dotEmpty: { backgroundColor: '#43A047' },
  dotPending: { backgroundColor: '#FB8C00' },
  dotFull: { backgroundColor: '#E53935' },
  legendText: { fontSize: 12, color: '#555' },
  slotLegendCol: {
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  slotLegendLine: {
    fontSize: 11,
    color: '#555',
    lineHeight: 16,
  },
  slotLegendNote: {
    fontSize: 11,
    color: '#1565C0',
    lineHeight: 16,
    marginTop: 4,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    width: CELL_PCT,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_PCT,
    minHeight: 48,
    padding: 3,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: '#1565C0',
    borderWidth: 2,
    backgroundColor: '#E3F2FD',
  },
  cellDay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 3,
  },
  slotStack: {
    width: '100%',
    gap: 3,
  },
  slotBar: {
    width: '100%',
    height: 7,
    borderRadius: 2,
    borderWidth: 1,
  },
});
