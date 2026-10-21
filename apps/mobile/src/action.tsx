import {
  Pressable,
  TextInput,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import { theme } from './design-system';
export function Field(props: TextInputProps) {
  return (
    <TextInput
      submitBehavior="blurAndSubmit"
      returnKeyType="done"
      placeholderTextColor={theme.color.slate}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: theme.color.border,
          borderRadius: theme.radius.control,
          padding: 12,
          minHeight: 48,
          color: theme.color.ink,
          backgroundColor: theme.color.white,
          fontFamily: 'ManropeRegular',
        },
        props.style,
      ]}
    />
  );
}

export function Action({ style, ...props }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={(state) => [
        {
          minHeight: 48,
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: theme.radius.control,
          backgroundColor: state.pressed
            ? theme.color.celadon
            : theme.color.mint,
          marginVertical: 3,
          opacity: props.disabled ? 0.5 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    />
  );
}
