import React from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle, useWindowDimensions } from 'react-native';
import { C } from './theme';

export function Card({ children, style, title, right }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; title?: string; right?: React.ReactNode }) {
  return (
    <View style={[s.card, style]}>
      {title ? (
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Row({ children, style, gap = 16 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', gap } as ViewStyle, style]}>{children}</View>;
}

/** True on phone-sized screens (iPhone), where layouts stack into one column. */
export function useIsPhone(): boolean {
  const { width } = useWindowDimensions();
  return width < 760;
}

/**
 * Side-by-side columns on desktop; stacked full-width on a phone. Children's `flex` values
 * are neutralised when stacked so cards size to their content inside the scroll view.
 */
export function Columns({ children, style, gap = 16 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  const phone = useIsPhone();
  if (!phone) return <Row style={style} gap={gap}>{children}</Row>;
  const flat = StyleSheet.flatten(style) ?? {};
  const { alignItems: _a, justifyContent: _j, flexWrap: _w, ...rest } = flat as ViewStyle;
  return (
    <View style={[{ flexDirection: 'column', gap } as ViewStyle, rest]}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, {
              style: [(child.props as any).style, { flex: undefined, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }],
            })
          : child,
      )}
    </View>
  );
}

export function H1({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={s.h1}>{children}</Text>
      {sub ? <Text style={s.h1sub}>{sub}</Text> : null}
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger' | 'premium';
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = kind === 'primary' ? C.accent : kind === 'premium' ? C.premium : kind === 'danger' ? 'transparent' : C.cardAlt;
  const fg = kind === 'primary' || kind === 'premium' ? '#06110B' : kind === 'danger' ? C.recovery.red : C.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ hovered }: any) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : hovered ? 0.85 : 1, borderColor: kind === 'danger' ? C.recovery.red : 'transparent' },
        style,
      ]}
    >
      <Text style={[s.btnText, small && { fontSize: 12 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string; locked?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={[s.seg, { flexWrap: 'wrap', alignSelf: 'flex-start' }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && { color: C.text }]}>
              {o.label}
              {o.locked ? ' 🔒' : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  width,
  onSubmit,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  width?: number;
  onSubmit?: () => void;
}) {
  const phone = useIsPhone();
  return (
    <View style={width ? { width } : { flexGrow: 1, flexShrink: 1, flexBasis: phone ? 130 : 0, minWidth: phone ? 130 : 0 }}>
      {label ? <Text style={[s.label, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={(t) => onChange(numeric ? t.replace(/[^0-9.]/g, '') : t)}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        onSubmitEditing={onSubmit}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        returnKeyType={onSubmit ? 'search' : 'done'}
        style={s.input as any}
      />
    </View>
  );
}

export function Progress({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={{ height, backgroundColor: C.cardAlt, borderRadius: height, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function Stat({ label, value, unit, color, hint }: { label: string; value: string; unit?: string; color?: string; hint?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 110 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.statValue, color ? { color } : null]}>
        {value}
        {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: color + '22', borderColor: color + '66' }]}>
      <Text style={[s.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function PremiumLock({ title, text, onUpgrade, height = 180 }: { title: string; text: string; onUpgrade: () => void; height?: number }) {
  return (
    <View style={[s.lock, { minHeight: height }]}>
      <Text style={{ fontSize: 26, marginBottom: 6 }}>🔒</Text>
      <Text style={[s.cardTitle, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[s.body, { textAlign: 'center', marginVertical: 8, maxWidth: 420 }]}>{text}</Text>
      <Button title="Unlock with Premium" kind="premium" onPress={onUpgrade} small />
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12 }} />;
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: C.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  h1: { color: C.text, fontSize: 26, fontWeight: '700' },
  h1sub: { color: C.sub, fontSize: 14, marginTop: 4 },
  label: { color: C.sub, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  body: { color: C.sub, fontSize: 14, lineHeight: 20 },
  hint: { color: C.faint, fontSize: 12, marginTop: 2 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnSmall: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnText: { fontWeight: '700', fontSize: 14 },
  seg: { flexDirection: 'row', backgroundColor: C.cardAlt, borderRadius: 10, padding: 3 },
  segItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segOn: { backgroundColor: C.border },
  segText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: C.cardAlt,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: C.text,
    fontSize: 14,
    width: '100%',
    minWidth: 0,
    // Hide the browser focus ring on desktop only.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  statValue: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 4 },
  statUnit: { color: C.sub, fontSize: 13, fontWeight: '500' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  lock: { alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: C.premium + '55', borderStyle: 'dashed', backgroundColor: C.premium + '0D' },
});
