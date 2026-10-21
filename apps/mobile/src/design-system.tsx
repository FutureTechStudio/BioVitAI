import {
  Text,
  View,
  StyleSheet,
  type TextProps,
  type ViewProps,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { bioflow, iconPaths } from '../../../shared/design-tokens/src/index';
export const theme = bioflow;
export function NativeBrand() {
  return (
    <View
      accessibilityLabel="BiovitAI"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <Svg width={30} height={40} viewBox="0 0 34 44" accessible={false}>
        <Path
          d="M27 1C34 20 9 21 8 42 0 30 0 18 14 12c6-3 9-5 13-11Z"
          fill={bioflow.color.aqua}
        />
        <Path
          d="M6 40C7 25 23 21 27 11 28 26 17 32 6 40Z"
          fill={bioflow.color.teal}
        />
      </Svg>
      <BioText style={{ fontSize: 30, fontWeight: '700' }}>
        Biovit
        <BioText
          style={{ fontSize: 30, fontWeight: '700', color: bioflow.color.blue }}
        >
          AI
        </BioText>
      </BioText>
    </View>
  );
}
export function BioText({ style, ...props }: TextProps) {
  const resolved = StyleSheet.flatten(style);
  const weight =
    resolved?.fontWeight === 'bold' ? 700 : Number(resolved?.fontWeight ?? 400);
  const fontFamily =
    weight >= 700
      ? 'ManropeBold'
      : weight >= 600
        ? 'ManropeSemibold'
        : weight >= 500
          ? 'ManropeMedium'
          : 'ManropeRegular';
  return (
    <Text
      {...props}
      allowFontScaling
      style={[
        {
          color: bioflow.color.ink,
          fontSize: 14,
          lineHeight: Math.ceil((resolved?.fontSize ?? 14) * 1.5),
        },
        style,
        { fontFamily },
      ]}
    />
  );
}
export function BioCard({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: bioflow.color.white,
          borderColor: bioflow.color.border,
          borderWidth: 1,
          borderRadius: bioflow.radius.card,
          padding: 18,
          gap: 12,
        },
        style,
      ]}
    />
  );
}
export function NativeIcon({
  name,
  size = 24,
}: {
  name: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={iconPaths[name] ?? iconPaths.health}
        fill="none"
        stroke={bioflow.color.teal}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function BioFlowBackground() {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        opacity={0.08}
      >
        <Path
          d="M-80 400Q80 100 240-40Q230 180-80 400ZM-80 400 240-40M20 250V130M90 150l110-20M350 850Q230 500 470 400Q520 700 350 850Z"
          stroke={bioflow.color.teal}
          fill="none"
        />
        <Circle
          cx={350}
          cy={760}
          r={130}
          fill="none"
          stroke={bioflow.color.aqua}
        />
      </Svg>
    </View>
  );
}
