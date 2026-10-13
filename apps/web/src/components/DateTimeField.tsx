import { useEffect, useState } from 'react';

import { fromInputValue, toInputValue } from '@/lib/time';
import ui from '@/styles/ui.module.css';

interface Props {
  label: string;
  /** Epoch seconds (UTC). */
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (epoch: number) => void;
}

/**
 * UTC date-time input (`YYYY-MM-DD HH:mm`). A plain text field is used on purpose: native
 * datetime-local widgets are locale/timezone dependent and far too wide for a side panel.
 * Edits commit on Enter/blur when valid and within [min, max]; otherwise the text reverts.
 */
export function DateTimeField({ label, value, min, max, disabled, onCommit }: Props) {
  const [text, setText] = useState(toInputValue(value));
  useEffect(() => setText(toInputValue(value)), [value]);

  const parsed = fromInputValue(text);
  const valid =
    parsed !== null && (min === undefined || parsed >= min) && (max === undefined || parsed <= max);

  const commit = () => {
    if (valid && parsed !== null) {
      if (parsed !== value) onCommit(parsed);
    } else {
      setText(toInputValue(value));
    }
  };

  return (
    <label className={ui.muted} style={{ display: 'grid', gap: 3, fontSize: 11 }}>
      {label} (UTC)
      <input
        className={ui.input}
        type="text"
        inputMode="numeric"
        spellCheck={false}
        placeholder="YYYY-MM-DD HH:mm"
        value={text}
        disabled={disabled}
        aria-invalid={!valid}
        style={valid ? undefined : { borderColor: 'var(--danger)' }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  );
}
