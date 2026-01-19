import React from 'react';
import { motion } from 'framer-motion';

export const StatCard = ({ title, value, sub, icon: Icon, trend, color = 'blue' }) => {
  const colors = {
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
    amber: 'text-amber-600 bg-amber-50',
    indigo: 'text-indigo-600 bg-indigo-50',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-full hover:scale-[1.02] transition-transform"
    >
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${colors[color] || colors.blue}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{title}</p>
        <p className="text-xs text-slate-500 mt-2 font-medium border-t border-slate-50 pt-2">{sub}</p>
      </div>
    </motion.div>
  );
};