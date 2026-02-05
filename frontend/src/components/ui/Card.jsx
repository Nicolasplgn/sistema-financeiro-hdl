import React from 'react';

export const Card = ({ children, className = '', noPadding = false }) => (
  <div className={`bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 ${noPadding ? '' : 'p-8'} ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, icon: Icon, action }) => (
  <div className="flex justify-between items-start mb-6">
    <div>
      {Icon && (
        <div className="flex items-center gap-2 mb-2 text-blue-600 font-black text-[10px] tracking-[0.2em] uppercase">
          <Icon size={14} />
          <span>Módulo</span>
        </div>
      )}
      <h3 className="text-xl font-black text-slate-900 tracking-tight italic">{title}</h3>
      {subtitle && <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mt-1">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);