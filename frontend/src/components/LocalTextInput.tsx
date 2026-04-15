import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

interface LocalTextInputProps extends TextInputProps {
  externalValue: string;
  onValueCommit: (value: string) => void;
}

/**
 * TextInput con stato locale isolato.
 * - Scrive nello stato locale durante la digitazione
 * - Sincronizza con il parent su blur E su unmount
 * - Evita perdita caratteri da re-render del parent
 */
export const LocalTextInput: React.FC<LocalTextInputProps> = ({
  externalValue,
  onValueCommit,
  ...props
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const [isFocused, setIsFocused] = useState(false);
  const latestValue = useRef(localValue);
  const hasChanged = useRef(false);
  const commitRef = useRef(onValueCommit);
  commitRef.current = onValueCommit;

  // Keep ref in sync
  useEffect(() => {
    latestValue.current = localValue;
  }, [localValue]);

  // Sync from external only when NOT focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(externalValue);
      latestValue.current = externalValue;
      hasChanged.current = false;
    }
  }, [externalValue, isFocused]);

  // CRITICAL: Commit on unmount to prevent data loss
  useEffect(() => {
    return () => {
      if (hasChanged.current) {
        commitRef.current(latestValue.current);
      }
    };
  }, []);

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    setLocalValue(externalValue);
    latestValue.current = externalValue;
    hasChanged.current = false;
    props.onFocus?.(e);
  }, [externalValue]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    if (hasChanged.current) {
      commitRef.current(latestValue.current);
      hasChanged.current = false;
    }
    props.onBlur?.(e);
  }, []);

  const handleChangeText = useCallback((text: string) => {
    setLocalValue(text);
    latestValue.current = text;
    hasChanged.current = true;
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
