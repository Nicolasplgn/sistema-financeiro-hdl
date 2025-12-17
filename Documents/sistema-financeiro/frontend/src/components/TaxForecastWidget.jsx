import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

const TaxForecastWidget = ({ companyId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const fetchForecast = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/intelligence/forecast?companyId=${companyId}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (e) {
        console.error('Erro ao buscar previsão', e);
      } finally {
        setLoading(false);
      }
    };
    fetchForecast();
  }, [companyId]);

  if (loading || !data) {
    return (
      <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-white animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  // Formatação de Moeda
  const f = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Estilos Dinâmicos baseados no Nível de Alerta
  const styles = {
    NORMAL: { 
      bg: 'bg-green-50', 
      border: 'border-green-200', 
      text: 'text-green-800', 
      icon: <CheckCircle className="text-green-600" /> 
    },
    WARNING: { 
      bg: 'bg-yellow-50', 
      border: 'border-yellow-200', 
      text: 'text-yellow-800', 
      icon: <AlertTriangle className="text-yellow-600" /> 
    },
    DANGER: { 
      bg: 'bg-red-50', 
      border: 'border-red-200', 
      text: 'text-red-800', 
      icon: <ShieldAlert className="text-red-600" /> 
    },
  };

  const style = styles[data.alertLevel] || styles.NORMAL;
  
  // Cálculo da porcentagem para a barra (max 100% visualmente)
  const progressPercent = data.limit > 0 ? Math.min((data.projectedRevenue / data.limit) * 100, 100) : 0;

  return (
    <div className={`rounded-lg border p-4 ${style.bg} ${style.border} shadow-sm mt-6`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          {style.icon}
          <div>
            <h3 className={`font-bold ${style.text}`}>Análise de Regime: {data.taxRegime}</h3>
          </div>
        </div>
        {data.limit > 0 && (
          <div className="text-xs font-mono bg-white bg-opacity-60 px-2 py-1 rounded text-gray-600 border border-gray-100">
            Limite: {f(data.limit)}
          </div>
        )}
      </div>
      
      <p className="text-sm text-gray-700 mb-4">{data.message}</p>

      {/* Barra de Progresso da Projeção */}
      {data.limit > 0 && (
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-white text-gray-600 shadow-sm border border-gray-100">
              Projeção Anual: {f(data.projectedRevenue)}
            </div>
            <div className="text-xs font-semibold inline-block text-gray-600">
              {((data.projectedRevenue / data.limit) * 100).toFixed(1)}% do Limite
            </div>
          </div>
          <div className="overflow-hidden h-3 mb-2 text-xs flex rounded bg-white border border-gray-300">
            <div 
              style={{ width: `${progressPercent}%` }} 
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 
                ${data.alertLevel === 'DANGER' ? 'bg-red-500' : data.alertLevel === 'WARNING' ? 'bg-yellow-500' : 'bg-blue-500'}`}
            >
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 border-t border-gray-200 pt-3 mt-1">
        <div>
          <span className="block font-semibold text-gray-700">Média Mensal:</span>
          {f(data.averageMonthly)}
        </div>
        <div>
          <span className="block font-semibold text-gray-700">Acumulado (YTD):</span>
          {f(data.ytdRevenue)}
        </div>
      </div>
    </div>
  );
};

export default TaxForecastWidget;