import {
  Pressable,
  TextInput,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
export function Field(props: TextInputProps) {
  return (
    <TextInput submitBehavior="blurAndSubmit" returnKeyType="done" {...props} />
  );
}

export function Action({ style, ...props }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={(state) => [
        { minHeight: 48, justifyContent: 'center' },
        typeof style === 'function' ? style(state) : style,
      ]}
    />
  );
}
