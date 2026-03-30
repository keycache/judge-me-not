import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/app-theme';

export interface DropdownOption {
  key: string;
  label: string;
}

interface SelectorDropdownProps {
  visible: boolean;
  title: string;
  options: DropdownOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  backdropTestID?: string;
  titleTestID?: string;
  optionTestIDPrefix?: string;
}

export function SelectorDropdown({
  visible,
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
  backdropTestID,
  titleTestID,
  optionTestIDPrefix,
}: SelectorDropdownProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={backdropTestID}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle} testID={titleTestID}>
            {title}
          </Text>
          <ScrollView style={styles.list}>
            {options.map((option) => {
              const selected = option.key === selectedKey;
              return (
                <Pressable
                  key={option.key}
                  testID={optionTestIDPrefix ? `${optionTestIDPrefix}-option-${option.key}` : undefined}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                  style={[styles.row, selected ? styles.rowSelected : null]}>
                  <Text style={[styles.rowText, selected ? styles.rowTextSelected : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: AppTheme.spacing.md,
  },
  panel: {
    backgroundColor: AppTheme.colors.surfacePrimary,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    maxHeight: '70%',
    padding: AppTheme.spacing.sm,
    gap: AppTheme.spacing.sm,
  },
  panelTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.typography.headingFamily,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  list: {
    maxHeight: 420,
  },
  row: {
    borderWidth: 1,
    borderColor: AppTheme.colors.borderSubtle,
    backgroundColor: AppTheme.colors.surfaceSecondary,
    paddingHorizontal: AppTheme.spacing.sm,
    paddingVertical: AppTheme.spacing.sm,
  },
  rowSelected: {
    borderColor: AppTheme.colors.accent,
  },
  rowText: {
    color: AppTheme.colors.textSecondary,
    fontFamily: AppTheme.typography.bodyFamily,
    fontSize: 14,
  },
  rowTextSelected: {
    color: AppTheme.colors.textPrimary,
  },
});
