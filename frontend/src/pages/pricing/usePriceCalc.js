import { useCallback, useEffect, useRef, useState } from 'react';
import http, { errorMessage } from '../../services/http';

/**
 * Busca o markup + tributos de um modelo em um canal. Com `overrides`
 * (simulação) usa /pricing/simulate, que não grava nada.
 * Recalcula sempre que o painel muda (version).
 */
export const usePriceCalc = ({ productId, channelId, overrides, version, setFeedback }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  const calculate = useCallback(async () => {
    if (!productId || !channelId) { setResult(null); return; }
    const id = ++request.current;
    setLoading(true);
    try {
      const hasOverrides = overrides && Object.keys(overrides).length > 0;
      const res = hasOverrides
        ? await http.post('/pricing/simulate', { productId, channelId, overrides })
        : await http.get('/price-calc', { params: { productId, channelId } });
      if (id === request.current) setResult(res.data);
    } catch (error) {
      if (id === request.current) setFeedback?.({ tone: 'error', text: errorMessage(error, 'Erro ao calcular o preço.') });
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [productId, channelId, overrides, setFeedback]);

  useEffect(() => {
    const timer = setTimeout(calculate, overrides ? 300 : 0);
    return () => clearTimeout(timer);
  }, [calculate, version, overrides]);

  return { result, loading, recalculate: calculate };
};
