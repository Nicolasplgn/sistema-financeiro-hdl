import React from 'react';
import { Field, Select } from '../../components/ui';
import { STATUS_LABEL } from '../../utils/format';

/** Escolha do modelo e do canal (compartilhada pelas abas Markup e Tributos). */
const ModelChannelPicker = ({ painel, selection, setSelection }) => {
  const statusOf = (productId, channelId) => painel.precos.find((p) => p.product_id === productId && p.channel_id === channelId)?.status;
  return (
    <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
      <Field label="Modelo (ficha técnica)">
        <Select value={selection.productId ?? ''} onChange={(e) => setSelection({ ...selection, productId: Number(e.target.value) })}>
          {painel.produtos.map((p, i) => <option key={p.id} value={p.id}>{i + 1} · {p.sku ? `${p.sku} — ` : ''}{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Canal de venda">
        <Select value={selection.channelId ?? ''} onChange={(e) => setSelection({ ...selection, channelId: Number(e.target.value) })}>
          {painel.canais.map((c) => {
            const status = statusOf(selection.productId, c.id);
            return <option key={c.id} value={c.id}>{c.name}{status && status !== 'OK' ? ` (${STATUS_LABEL[status].toLowerCase()})` : ''}</option>;
          })}
        </Select>
      </Field>
    </div>
  );
};

export default ModelChannelPicker;
