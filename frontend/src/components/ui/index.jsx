// Componentes visuais compartilhados por todas as telas.
// Cores vêm dos tokens de src/index.css (bg-surface, text-ink, border-line...),
// então o tema claro/escuro funciona sem nenhum ajuste por tela.
import React, { useEffect } from 'react';
import { cx } from '../../utils/cx';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';


// ---------------------------------------------------------------------------- página

export const Page = ({ children, wide = false, className = '' }) => (
  <div className={cx('mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6', wide ? 'max-w-[1600px]' : 'max-w-7xl', className)}>
    {children}
  </div>
);

export const PageHeader = ({ title, description, actions, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
    <div className="min-w-0 flex-1 basis-[420px]">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-2 max-w-3xl leading-relaxed">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

// ---------------------------------------------------------------------------- cartões

export const Card = ({ children, className = '', padded = true, ...props }) => (
  <section className={cx('bg-surface border border-line rounded-xl shadow-card', padded && 'p-5', className)} {...props}>
    {children}
  </section>
);

export const CardHeader = ({ title, description, icon: Icon, actions, className = '' }) => (
  <div className={cx('flex flex-wrap items-start justify-between gap-3 mb-4', className)}>
    <div className="min-w-0">
      <h2 className="text-[15px] font-semibold text-ink flex items-center gap-2">
        {Icon && <Icon size={17} className="text-brand shrink-0" />}
        {title}
      </h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-2 leading-relaxed">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** Indicador numérico (KPI). tone: neutral | pos | neg | warn | brand */
export const Stat = ({ label, value, hint, icon: Icon, tone = 'neutral', className = '' }) => {
  const toneClass = {
    neutral: 'text-ink', pos: 'text-pos', neg: 'text-neg', warn: 'text-warn', brand: 'text-brand',
  }[tone];
  return (
    <div className={cx('bg-surface border border-line rounded-xl p-4 shadow-card min-w-0', className)}>
      <p className="text-xs font-medium text-ink-3 flex items-center gap-1.5">{Icon && <Icon size={14} />} {label}</p>
      <p className={cx('mt-1.5 text-xl font-semibold num truncate', toneClass)} title={typeof value === 'string' ? value : undefined}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3 truncate">{hint}</p>}
    </div>
  );
};

// ---------------------------------------------------------------------------- botões

const BUTTON_VARIANTS = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-3',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-3 hover:text-ink',
  danger: 'bg-neg text-white border border-transparent hover:opacity-90',
  'danger-ghost': 'bg-transparent text-neg border border-transparent hover:bg-neg-soft',
};
const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

export const Button = ({ variant = 'secondary', size = 'md', icon: Icon, loading = false, children, className = '', disabled, type = 'button', ...props }) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className,
    )}
    {...props}
  >
    {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : Icon && <Icon size={size === 'sm' ? 14 : 16} />}
    {children}
  </button>
);

export const IconButton = ({ icon: Icon, label, variant = 'ghost', size = 'md', className = '', ...props }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cx(
      'inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
      size === 'sm' ? 'w-7 h-7' : 'w-9 h-9',
      variant === 'danger' ? 'text-ink-3 hover:text-neg hover:bg-neg-soft' : variant === 'secondary' ? 'bg-surface border border-line text-ink-2 hover:bg-surface-3' : 'text-ink-3 hover:text-ink hover:bg-surface-3',
      className,
    )}
    {...props}
  >
    <Icon size={size === 'sm' ? 14 : 17} />
  </button>
);

// ---------------------------------------------------------------------------- etiquetas e estados

export const Badge = ({ tone = 'neutral', children, className = '' }) => {
  const toneClass = {
    neutral: 'bg-surface-3 text-ink-2',
    brand: 'bg-brand-soft text-brand',
    pos: 'bg-pos-soft text-pos',
    neg: 'bg-neg-soft text-neg',
    warn: 'bg-warn-soft text-warn',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap', toneClass, className)}>{children}</span>;
};

export const Loading = ({ label = 'Carregando…', className = '' }) => (
  <div className={cx('flex flex-col items-center justify-center gap-3 py-16 text-ink-3', className)}>
    <Loader2 size={28} className="animate-spin text-brand" />
    <p className="text-sm">{label}</p>
  </div>
);

export const EmptyState = ({ icon: Icon = Info, title, description, action, className = '' }) => (
  <div className={cx('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
    <div className="w-12 h-12 rounded-xl bg-surface-3 text-ink-3 flex items-center justify-center mb-4"><Icon size={22} /></div>
    <p className="font-semibold text-ink">{title}</p>
    {description && <p className="mt-1 text-sm text-ink-2 max-w-md leading-relaxed">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const ALERT_STYLE = {
  info: { box: 'bg-brand-soft border-line text-ink', icon: Info, iconClass: 'text-brand' },
  success: { box: 'bg-pos-soft border-line text-ink', icon: CheckCircle2, iconClass: 'text-pos' },
  warning: { box: 'bg-warn-soft border-line text-ink', icon: AlertTriangle, iconClass: 'text-warn' },
  error: { box: 'bg-neg-soft border-line text-ink', icon: XCircle, iconClass: 'text-neg' },
};

export const Alert = ({ tone = 'info', title, children, onClose, className = '' }) => {
  const s = ALERT_STYLE[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', s.box, className)}>
      <s.icon size={18} className={cx('shrink-0 mt-0.5', s.iconClass)} />
      <div className="flex-1 min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'text-ink-2 mt-0.5' : ''}>{children}</div>}
      </div>
      {onClose && <button onClick={onClose} className="text-ink-3 hover:text-ink shrink-0" aria-label="Fechar aviso"><X size={16} /></button>}
    </div>
  );
};

/** Mensagem de retorno de uma ação: { tone, text } ou null. */
export const Feedback = ({ value, onClose, className }) =>
  value ? <Alert tone={value.tone} onClose={onClose} className={className}>{value.text}</Alert> : null;

// ---------------------------------------------------------------------------- formulário

export const Field = ({ label, hint, children, className = '', htmlFor }) => (
  <label className={cx('block', className)} htmlFor={htmlFor}>
    {label && <span className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</span>}
    {children}
    {hint && <span className="block text-xs text-ink-3 mt-1 leading-relaxed">{hint}</span>}
  </label>
);

const controlClass = 'w-full h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-soft disabled:opacity-60';

export const Input = React.forwardRef(({ className = '', prefix, suffix, ...props }, ref) => (
  prefix || suffix ? (
    <div className={cx('flex items-center rounded-lg border border-line bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft', className)}>
      {prefix && <span className="pl-3 text-sm text-ink-3">{prefix}</span>}
      <input ref={ref} className="flex-1 min-w-0 h-10 bg-transparent px-3 text-sm text-ink outline-none" {...props} />
      {suffix && <span className="pr-3 text-sm text-ink-3">{suffix}</span>}
    </div>
  ) : <input ref={ref} className={cx(controlClass, className)} {...props} />
));
Input.displayName = 'Input';

export const Select = ({ className = '', children, ...props }) => (
  <select className={cx(controlClass, 'cursor-pointer pr-8', className)} {...props}>{children}</select>
);

export const Textarea = ({ className = '', ...props }) => (
  <textarea className={cx(controlClass, 'h-auto min-h-[96px] py-2 resize-y', className)} {...props} />
);

export const Toggle = ({ checked, onChange, label, description, disabled }) => (
  <label className={cx('flex items-start gap-3 select-none', disabled ? 'opacity-50' : 'cursor-pointer')}>
    <span className="relative inline-flex shrink-0 mt-0.5">
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="w-9 h-5 rounded-full bg-line-strong peer-checked:bg-brand transition-colors" />
      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </span>
    <span>
      <span className="block text-sm font-medium text-ink">{label}</span>
      {description && <span className="block text-xs text-ink-3 mt-0.5">{description}</span>}
    </span>
  </label>
);

// ---------------------------------------------------------------------------- navegação interna

/** Abas em forma de botões segmentados. items: [{ id, label, icon?, badge? }] */
export const Tabs = ({ items, value, onChange, className = '' }) => (
  <div role="tablist" className={cx('inline-flex flex-wrap gap-1 p-1 rounded-lg bg-surface-3 border border-line', className)}>
    {items.map((item) => (
      <button
        key={item.id}
        role="tab"
        aria-selected={value === item.id}
        onClick={() => onChange(item.id)}
        className={cx(
          'h-8 px-3 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors',
          value === item.id ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink',
        )}
      >
        {item.icon && <item.icon size={14} />}
        {item.label}
        {item.badge !== undefined && <span className="text-[11px] text-ink-3">{item.badge}</span>}
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------------- janelas

export const Modal = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-6xl' }[size];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative w-full bg-surface border border-line rounded-2xl shadow-pop flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150', width)}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="text-sm text-ink-2 mt-0.5 leading-relaxed">{description}</p>}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </div>
        <div className="px-6 py-5 overflow-y-auto scroll-thin flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex flex-wrap justify-end gap-2 bg-surface-2 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------- ajuda

/** Legenda das células da planilha. */
export const SheetLegend = ({ className = '' }) => (
  <div className={cx('flex flex-wrap items-center gap-4 text-xs text-ink-2', className)}>
    <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded-sm border border-cell-line bg-cell-input" /> você digita</span>
    <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded-sm border border-line bg-surface-2" /> o sistema calcula</span>
  </div>
);

/** Passo a passo numerado. steps: [{ title, description, done?, onClick? }] */
export const StepFlow = ({ steps }) => (
  <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    {steps.map((step, index) => (
      <li key={step.title}>
        <button
          type="button"
          onClick={step.onClick}
          disabled={!step.onClick}
          className="w-full h-full text-left p-4 rounded-xl border border-line bg-surface hover:border-brand hover:bg-surface-2 transition-colors disabled:cursor-default"
        >
          <span className="flex items-center gap-2">
            <span className={cx('w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0', step.done ? 'bg-pos text-white' : 'bg-brand-soft text-brand')}>
              {step.done ? <CheckCircle2 size={14} /> : index + 1}
            </span>
            <span className="font-semibold text-sm text-ink">{step.title}</span>
          </span>
          <span className="block mt-2 text-xs text-ink-2 leading-relaxed">{step.description}</span>
          {step.status && <span className="block mt-2 text-xs font-medium text-ink num">{step.status}</span>}
        </button>
      </li>
    ))}
  </ol>
);

