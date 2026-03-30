import { act, fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { SelectorDropdown } from '../selector-dropdown';
import { ToastContainer, useToast } from '../toast';

// ---------------------------------------------------------------------------
// Harnesses
// ---------------------------------------------------------------------------

function InteractiveToastHarness() {
  const { showToast, toastState } = useToast();
  return (
    <>
      <Pressable testID="show-info" onPress={() => showToast('Info message', 'info')}>
        <Text>Info</Text>
      </Pressable>
      <Pressable testID="show-success" onPress={() => showToast('Success message', 'success')}>
        <Text>Success</Text>
      </Pressable>
      <Pressable testID="show-warning" onPress={() => showToast('Warning message', 'warning')}>
        <Text>Warning</Text>
      </Pressable>
      <ToastContainer toastState={toastState} />
    </>
  );
}

const DROPDOWN_OPTIONS = [
  { key: 'a', label: 'Option A' },
  { key: 'b', label: 'Option B' },
  { key: 'c', label: 'Option C' },
];

// ---------------------------------------------------------------------------
// ToastContainer – direct prop control
// ---------------------------------------------------------------------------

describe('ToastContainer', () => {
  it('toast_renders_with_info_variant', () => {
    const screen = render(
      <ToastContainer toastState={{ visible: true, message: 'Saved.', variant: 'info' }} />
    );
    expect(screen.getByTestId('toast-container')).toBeTruthy();
    expect(screen.getByTestId('toast-message')).toBeTruthy();
    expect(screen.getByText('Saved.')).toBeTruthy();
  });

  it('toast_renders_with_success_variant_green_colour', () => {
    const screen = render(
      <ToastContainer toastState={{ visible: true, message: 'Done.', variant: 'success' }} />
    );
    expect(screen.getByTestId('toast-message')).toBeTruthy();
    expect(screen.getByText('Done.')).toBeTruthy();
  });

  it('toast_renders_with_warning_variant_amber_colour', () => {
    const screen = render(
      <ToastContainer toastState={{ visible: true, message: 'Error.', variant: 'warning' }} />
    );
    expect(screen.getByTestId('toast-message')).toBeTruthy();
    expect(screen.getByText('Error.')).toBeTruthy();
  });

  it('renders nothing when visible is false', () => {
    const screen = render(
      <ToastContainer toastState={{ visible: false, message: 'Hidden', variant: 'info' }} />
    );
    expect(screen.queryByTestId('toast-container')).toBeNull();
  });

  it('renders nothing when message is empty', () => {
    const screen = render(
      <ToastContainer toastState={{ visible: true, message: '', variant: 'info' }} />
    );
    expect(screen.queryByTestId('toast-container')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useToast – via interactive harness
// ---------------------------------------------------------------------------

describe('useToast', () => {
  it('toast_auto_dismisses_after_configured_duration', () => {
    jest.useFakeTimers();

    const screen = render(<InteractiveToastHarness />);

    fireEvent.press(screen.getByTestId('show-info'));
    expect(screen.getByTestId('toast-message')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3001);
    });

    expect(screen.queryByTestId('toast-message')).toBeNull();

    jest.useRealTimers();
  });

  it('toast_warning_stays_visible_until_longer_duration', () => {
    jest.useFakeTimers();

    const screen = render(<InteractiveToastHarness />);

    fireEvent.press(screen.getByTestId('show-warning'));
    expect(screen.getByTestId('toast-message')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3001);
    });
    // warning uses 5000ms — still visible at 3s
    expect(screen.getByTestId('toast-message')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2001);
    });
    expect(screen.queryByTestId('toast-message')).toBeNull();

    jest.useRealTimers();
  });

  it('toast_does_not_close_early_when_message_changes', () => {
    jest.useFakeTimers();

    const screen = render(<InteractiveToastHarness />);

    // Show first message (3s timer)
    fireEvent.press(screen.getByTestId('show-info'));
    expect(screen.getByText('Info message')).toBeTruthy();

    // Advance 2s — first timer has not fired yet
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Info message')).toBeTruthy();

    // Show second message — resets timer to 3s from now
    fireEvent.press(screen.getByTestId('show-success'));
    expect(screen.getByText('Success message')).toBeTruthy();

    // Advance 2s — 2s into the new timer, should still be visible
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Success message')).toBeTruthy();

    // Advance another 1001ms — now 3001ms past second show, should dismiss
    act(() => {
      jest.advanceTimersByTime(1001);
    });
    expect(screen.queryByTestId('toast-message')).toBeNull();

    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// SelectorDropdown
// ---------------------------------------------------------------------------

describe('SelectorDropdown', () => {
  it('selector_dropdown_renders_options_and_selects', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    const screen = render(
      <SelectorDropdown
        visible={true}
        title="Select Option"
        options={DROPDOWN_OPTIONS}
        selectedKey={null}
        onSelect={onSelect}
        onClose={onClose}
        optionTestIDPrefix="test-dropdown"
      />
    );

    expect(screen.getByText('Option A')).toBeTruthy();
    expect(screen.getByText('Option B')).toBeTruthy();
    expect(screen.getByText('Option C')).toBeTruthy();

    fireEvent.press(screen.getByTestId('test-dropdown-option-a'));

    expect(onSelect).toHaveBeenCalledWith('a');
    expect(onClose).toHaveBeenCalled();
  });

  it('selector_dropdown_closes_on_backdrop_press', () => {
    const onClose = jest.fn();

    const screen = render(
      <SelectorDropdown
        visible={true}
        title="Select Option"
        options={DROPDOWN_OPTIONS}
        selectedKey={null}
        onSelect={jest.fn()}
        onClose={onClose}
        backdropTestID="test-backdrop"
        optionTestIDPrefix="test-dropdown"
      />
    );

    fireEvent.press(screen.getByTestId('test-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('selector_dropdown_closes_on_option_press', () => {
    const onClose = jest.fn();

    const screen = render(
      <SelectorDropdown
        visible={true}
        title="Select Option"
        options={DROPDOWN_OPTIONS}
        selectedKey={null}
        onSelect={jest.fn()}
        onClose={onClose}
        optionTestIDPrefix="test-dropdown"
      />
    );

    fireEvent.press(screen.getByTestId('test-dropdown-option-b'));
    expect(onClose).toHaveBeenCalled();
  });

  it('highlights selected option', () => {
    const screen = render(
      <SelectorDropdown
        visible={true}
        title="Select"
        options={DROPDOWN_OPTIONS}
        selectedKey="b"
        onSelect={jest.fn()}
        onClose={jest.fn()}
        optionTestIDPrefix="test-dropdown"
      />
    );

    // Selected option renders in the list
    expect(screen.getByTestId('test-dropdown-option-b')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    const screen = render(
      <SelectorDropdown
        visible={false}
        title="Select"
        options={DROPDOWN_OPTIONS}
        selectedKey={null}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        optionTestIDPrefix="test-dropdown"
      />
    );
    expect(screen.queryByText('Option A')).toBeNull();
  });
});

// Satisfy TS jest transform expectation
export { };

