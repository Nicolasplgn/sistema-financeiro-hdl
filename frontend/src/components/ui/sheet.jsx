// Células de planilha: amarelas = o usuário digita; cinza-claro = calculadas.
// Usadas dentro de <table className="sheet"> (estilos em src/index.css).
import React, { useState } from 'react';
import { money, pct, qty, toInput, toNumber } from '../../utils/format';

const FORMATTERS = {
  money: (v) => money(v),
  money3: (v) => money(v, Math.abs(v) > 0 && Math.abs(v) < 1 ? 3 : 2),
  percent: (v) => pct(v),
  int: (v) => qty(v, 0),
  qty: (v) => qty(v, Number.isInteger(v) ? 0 : 2),
};

/**
 * Célula numérica editável. Mostra o valor formatado; ao clicar vira campo de
 * texto ("1.234,56" ou "12,5"). Confirma com Enter ou ao sair; Esc desfaz.
 * onCommit(numero) só é chamado se o valor mudou.
 */
export const NumberCell = ({ value, onCommit, format = 'money', disabled = false, label, className = '', min }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const number = value === null || value === undefined || value === '' ? null : Number(value);

  const commit = () => {
    setEditing(false);
    const next = toNumber(text);
    if (min !== undefined && next < min) return;
    if (number === null ? text.trim() !== '' : Math.abs(next - number) > 1e-9) onCommit?.(next);
  };

  return (
    <td className={`input ${className}`}>
      <input
        className="sheet-input right"
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={editing ? text : number === null ? '' : FORMATTERS[format](number)}
        onFocus={(e) => { setEditing(true); setText(toInput(number)); requestAnimationFrame(() => e.target.select()); }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setText(toInput(number)); setEditing(false); requestAnimationFrame(() => e.target.blur()); }
        }}
      />
    </td>
  );
};

/** Célula de texto editável (nome, NCM...). onCommit(texto) ao sair, se mudou. */
export const TextCell = ({ value, onCommit, placeholder, label, className = '', disabled = false, required = false }) => {
  const [text, setText] = useState(value ?? '');
  // Valor mudou fora daqui (recarga): acompanha, sem efeito colateral.
  const [source, setSource] = useState(value);
  if (source !== value) { setSource(value); setText(value ?? ''); }
  return (
    <td className={`input ${className}`}>
      <input
        className="sheet-input"
        aria-label={label}
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const next = text.trim();
          if (required && !next) { setText(value ?? ''); return; }
          if (next !== (value ?? '')) onCommit?.(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setText(value ?? ''); requestAnimationFrame(() => e.target.blur()); }
        }}
      />
    </td>
  );
};

/** Célula de seleção editável. */
export const SelectCell = ({ value, onChange, children, label, className = '', disabled = false }) => (
  <td className={`input ${className}`}>
    <select className="sheet-input" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  </td>
);

/** Célula calculada (somente leitura). */
export const CalcCell = ({ value, format = 'money', className = '', strong = false, children, title }) => (
  <td className={`calc text-right num whitespace-nowrap ${strong ? 'font-semibold text-ink' : ''} ${className}`} title={title}>
    {children ?? (value === null || value === undefined ? '—' : FORMATTERS[format](Number(value)))}
  </td>
);

/** Moldura com rolagem horizontal para planilhas largas. */
export const SheetFrame = ({ children, className = '', maxHeight }) => (
  <div className={`overflow-auto scroll-thin rounded-lg ${className}`} style={maxHeight ? { maxHeight } : undefined}>
    {children}
  </div>
);

/**
 * Abas inferiores no estilo das planilhas do Excel.
 * items: [{ id, label, hint? }]
 */
export const WorkbookTabs = ({ items, value, onChange }) => (
  <div className="flex items-end gap-0.5 overflow-x-auto scroll-thin border-b border-line" role="tablist">
    {items.map((item) => {
      const active = item.id === value;
      return (
        <button
          key={item.id}
          role="tab"
          aria-selected={active}
          title={item.hint}
          onClick={() => onChange(item.id)}
          className={`shrink-0 px-4 h-10 text-[13px] font-medium rounded-t-lg border border-b-0 transition-colors whitespace-nowrap -mb-px ${
            active ? 'bg-surface text-brand border-line' : 'bg-surface-2 text-ink-2 border-transparent hover:text-ink hover:bg-surface-3'
          }`}
          style={active ? { boxShadow: 'inset 0 2px 0 var(--brand)' } : undefined}
        >
          {item.label}
        </button>
      );
    })}
  </div>
);
