import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { C } from './theme';

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

// ------------------------------------------------------------------ Ring gauge

export function Ring({
  value,
  max,
  color,
  size = 150,
  stroke = 12,
  label,
  center,
  sub,
}: {
  value: number | null;
  max: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
  center: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * pct} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.text, fontSize: size * 0.22, fontWeight: '800' }}>{center}</Text>
          {sub ? <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
        </View>
      </View>
      {label ? <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 10, textTransform: 'uppercase' }}>{label}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------------ Line chart

export interface Series {
  values: (number | null)[];
  color: string;
  width?: number;
  dashed?: boolean;
  name?: string;
  dots?: boolean;
}

function niceBounds(all: number[], yMin?: number, yMax?: number): [number, number] {
  let lo = yMin ?? Math.min(...all);
  let hi = yMax ?? Math.max(...all);
  if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  return [yMin ?? lo - pad, yMax ?? hi + pad];
}

export function LineChart({
  series,
  labels,
  height = 200,
  yMin,
  yMax,
  band,
  format = (v: number) => String(Math.round(v)),
}: {
  series: Series[];
  labels: string[];
  height?: number;
  yMin?: number;
  yMax?: number;
  band?: { from: number; to: number; color: string };
  format?: (v: number) => string;
}) {
  const [width, onLayout] = useWidth();
  const padL = 40;
  const padR = 22;
  const padT = 10;
  const padB = 24;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const [lo, hi] = niceBounds(all, yMin, yMax);
  const n = labels.length;
  const iw = Math.max(1, width - padL - padR);
  const ih = height - padT - padB;
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + (hi - lo) * t);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {band ? <Rect x={padL} width={iw} y={y(band.to)} height={Math.max(0, y(band.from) - y(band.to))} fill={band.color} /> : null}
          {ticks.map((t, i) => (
            <G key={i}>
              <Line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={C.border} strokeWidth={1} />
              <SvgText x={padL - 6} y={y(t) + 4} fill={C.faint} fontSize={10} textAnchor="end">
                {format(t)}
              </SvgText>
            </G>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <SvgText key={i} x={x(i)} y={height - 6} fill={C.faint} fontSize={10} textAnchor="middle">
                {l}
              </SvgText>
            ) : null,
          )}
          {series.map((s, si) => {
            let d = '';
            let pen = false;
            s.values.forEach((v, i) => {
              if (v == null) {
                pen = false;
                return;
              }
              d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
              pen = true;
            });
            return (
              <G key={si}>
                <Path d={d} stroke={s.color} strokeWidth={s.width ?? 2} fill="none" strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
                {s.dots
                  ? s.values.map((v, i) => (v == null ? null : <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color} />))
                  : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ Bar chart

export function BarChart({
  values,
  labels,
  colors,
  height = 180,
  format = (v: number) => String(Math.round(v)),
  showValues,
  target,
}: {
  values: number[];
  labels: string[];
  colors: string | string[];
  height?: number;
  format?: (v: number) => string;
  showValues?: boolean;
  target?: number;
}) {
  const [width, onLayout] = useWidth();
  const padL = 44;
  const padT = showValues ? 16 : 8;
  const padB = 22;
  const max = Math.max(1, ...values, target ?? 0) * 1.08;
  const iw = Math.max(1, width - padL - 6);
  const ih = height - padT - padB;
  const slot = iw / Math.max(1, values.length);
  const bw = Math.min(42, slot * 0.62);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const labelEvery = Math.max(1, Math.ceil(values.length / Math.max(2, Math.floor(iw / 48))));
  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((t, i) => (
            <G key={i}>
              <Line x1={padL} x2={width - 6} y1={y(max * t)} y2={y(max * t)} stroke={C.border} />
              <SvgText x={padL - 6} y={y(max * t) + 4} fill={C.faint} fontSize={10} textAnchor="end">
                {format(max * t)}
              </SvgText>
            </G>
          ))}
          {target != null ? <Line x1={padL} x2={width - 6} y1={y(target)} y2={y(target)} stroke={C.text} strokeDasharray="4 4" strokeOpacity={0.5} /> : null}
          {values.map((v, i) => {
            const cx = padL + slot * i + slot / 2;
            const col = Array.isArray(colors) ? colors[i % colors.length] : colors;
            return (
              <G key={i}>
                <Rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(0, padT + ih - y(v))} rx={4} fill={col} />
                {showValues && v > 0 ? (
                  <SvgText x={cx} y={y(v) - 4} fill={C.sub} fontSize={10} textAnchor="middle">
                    {format(v)}
                  </SvgText>
                ) : null}
                {i % labelEvery === 0 ? (
                  <SvgText x={cx} y={height - 6} fill={C.faint} fontSize={10} textAnchor="middle">
                    {labels[i]}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ Stacked bars (e.g. sleep stages per night)

export function StackedBars({
  stacks,
  labels,
  colors,
  height = 200,
  format = (v: number) => String(Math.round(v)),
  target,
}: {
  stacks: number[][];
  labels: string[];
  colors: string[];
  height?: number;
  format?: (v: number) => string;
  target?: number;
}) {
  const [width, onLayout] = useWidth();
  const padL = 44;
  const padT = 8;
  const padB = 22;
  const totals = stacks.map((st) => st.reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...totals, target ?? 0) * 1.08;
  const iw = Math.max(1, width - padL - 6);
  const ih = height - padT - padB;
  const slot = iw / Math.max(1, stacks.length);
  const bw = Math.min(30, slot * 0.66);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const labelEvery = Math.max(1, Math.ceil(stacks.length / Math.max(2, Math.floor(iw / 48))));
  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((t, i) => (
            <G key={i}>
              <Line x1={padL} x2={width - 6} y1={y(max * t)} y2={y(max * t)} stroke={C.border} />
              <SvgText x={padL - 6} y={y(max * t) + 4} fill={C.faint} fontSize={10} textAnchor="end">
                {format(max * t)}
              </SvgText>
            </G>
          ))}
          {stacks.map((st, i) => {
            const cx = padL + slot * i + slot / 2;
            let acc = 0;
            return (
              <G key={i}>
                {st.map((v, j) => {
                  const top = y(acc + v);
                  const h = Math.max(0, y(acc) - top);
                  acc += v;
                  return <Rect key={j} x={cx - bw / 2} y={top} width={bw} height={h} fill={colors[j]} />;
                })}
                {i % labelEvery === 0 ? (
                  <SvgText x={cx} y={height - 6} fill={C.faint} fontSize={10} textAnchor="middle">
                    {labels[i]}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {target != null ? <Line x1={padL} x2={width - 6} y1={y(target)} y2={y(target)} stroke={C.text} strokeDasharray="4 4" strokeOpacity={0.5} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ Horizontal split bar (e.g. stage share, zones)

export function SplitBar({ parts, height = 14 }: { parts: { value: number; color: string }[]; height?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: C.cardAlt }}>
      {parts.map((p, i) => (
        <View key={i} style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }} />
      ))}
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 } as any}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: it.color, marginRight: 6 }} />
          <Text style={{ color: C.sub, fontSize: 12 }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
