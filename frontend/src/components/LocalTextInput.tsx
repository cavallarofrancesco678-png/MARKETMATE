import React, { useState, useEffect, useCallback } from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';

interface LocalTextInputProps extends TextInputProps {
  externalValue: string;
  onValueCommit: (value: string) => void;
}

/**
 * TextInput che gestisce il proprio stato locale.
 * Evita il bug di React Native dove il re-render del parent
 * causa la perdita dei caratteri digitati.
 * 
 * - Scrive nello stato locale durante la digitazione
 * - Sincronizza con il parent solo su blur/submit
 */
export const LocalTextInput: React.FC<LocalTextInputProps> = ({
  externalValue,
  onValueCommit,
  ...props
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const [isFocused, setIsFocused] = useState(false);

  // Sync from external only when NOT focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(externalValue);
    }
  }, [externalValue, isFocused]);

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    setLocalValue(externalValue);
    props.onFocus?.(e);
  }, [externalValue, props.onFocus]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    onValueCommit(localValue);
    props.onBlur?.(e);
  }, [localValue, onValueCommit, props.onBlur]);

  const handleChangeText = useCallback((text: string) => {
    setLocalValue(text);
  }, []);

  return (
    <TextInput
      {...props}
      value={localValue}
      onChangeText={handleChangeText}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};
