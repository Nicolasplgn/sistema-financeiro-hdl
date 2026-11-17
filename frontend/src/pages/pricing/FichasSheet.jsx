// Aba FICHAS TÉCNICAS: uma sub-aba por modelo (FICHA TECNICA 1, 2, 3…) com as
// colunas da planilha, mais o catálogo de insumos.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Plus, Trash2 } from 'lucide-react';
import http, { errorMessage } from '../../services/http';
import { Alert, Badge, Button, Field, IconButton, Input, Loading, Modal, Tabs } from '../../components/ui';
import { useConfirm } from '../../components/ui/useConfirm';
import { CalcCell, NumberCell, SelectCell, SheetFrame, TextCell } from '../../components/ui/sheet';
import { brl, pct, REGIME_LABEL } from '../../utils/format';

// ----------------------------------------------------------------------------- linha "adicionar componente"
const AddComponentRow = ({ materials, onAdd, colSpan }) => {
  const [text, setText] = useState('');
  const submit = () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    onAdd(name);
  };
  return (
    <tr>
      <td className="input sticky-col">
        <input
          className="sheet-input"
          list="lista-insumos"
          placeholder="+ adicionar componente (escolha da lista ou digite um novo)"
          aria-label="Adicionar componente"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <datalist id="lista-insumos">
          {materials.map((m) => <option key={m.id} value={m.name} />)}
        </datalist>
      </td>
      <td colSpan={colSpan} className="calc" />
    </tr>
  );
};

// ----------------------------------------------------------------------------- ficha de um modelo
const FichaModelo = ({ ctx, product, onDeleted }) => {
  const { materials, reload, setFeedback, companyId } = ctx;
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const load = useCallback(async () => {
    try {
      const res = await http.get(`/pricing/ficha/${product.id}`);
      setData(res.data);
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error, 'Erro ao abrir a ficha técnica.') });
    }
  }, [product.id, setFeedback]);

  useEffect(() => { setData(null); load(); }, [load]);

  const linhas = data?.ficha.linhas ?? [];

  const act = async (action) => {
    setSaving(true);
    try {
      await action();
      await Promise.all([load(), reload(['materials', 'painel'])]);
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const saveLines = (lines) => act(() => http.post('/product-boms', { product_id: product.id, materials: lines }));
  const currentLines = () => linhas.map((l) => ({ material_id: l.material_id, quantity: l.quantidade }));
  const updateMaterial = (id, body) => act(() => http.put(`/materials/${id}`, body));

  const setPrice = (material, origin, value) => {
    if (!material) return;
    const isNational = origin === 'nacional';
    if (value > 0) updateMaterial(material.id, { is_national: isNational, price: value });
    else if (Boolean(material.is_national) === isNational) updateMaterial(material.id, { price: 0 });
  };

  const addComponent = async (name) => {
    const existing = materials.find((m) => m.name.trim().toLowerCase() === name.toLowerCase());
    await act(async () => {
      let materialId = existing?.id;
      if (!materialId) {
        const res = await http.post('/materials', { company_id: companyId, name, price: 0, ipi_percent: 0, is_national: true });
        materialId = res.data.id;
      }
      await http.post('/product-boms', { product_id: product.id, materials: [...currentLines(), { material_id: materialId, quantity: 1 }] });
    });
  };

  const renameProduct = (body) => act(() => http.put(`/products/${product.id}`, body));

  const deleteProduct = async () => {
    const ok = await confirm({
      title: `Excluir o modelo “${product.sku || product.name}”?`,
      description: 'A ficha técnica e as faixas de IPI deste modelo serão apagadas. Os insumos continuam no catálogo.',
      confirmLabel: 'Excluir modelo', danger: true,
    });
    if (!ok) return;
    try {
      await http.delete(`/products/${product.id}`);
      await reload(['painel', 'materials']);
      onDeleted();
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) });
    }
  };

  if (!data) return <Loading label="Abrindo a ficha técnica…" />;
  const { ficha, regime } = data;
  const t = ficha.totais;

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Modelo" className="flex-1 min-w-[260px]">
          <Input defaultValue={product.name} key={`n-${product.name}`} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== product.name && renameProduct({ name: e.target.value.trim() })} />
        </Field>
        <Field label="Código" className="w-36">
          <Input defaultValue={product.sku || ''} key={`s-${product.sku}`} onBlur={(e) => e.target.value.trim() !== (product.sku || '') && renameProduct({ sku: e.target.value.trim() })} />
        </Field>
        <div className="text-xs text-ink-2 pb-2.5">Rateio no painel: <span className="font-medium text-ink num">{pct(product.allocation_percent)}</span></div>
        <Button variant="danger-ghost" icon={Trash2} onClick={deleteProduct}>Excluir modelo</Button>
      </div>

      <SheetFrame maxHeight="62vh">
        <table className="sheet min-w-[1350px]">
          <thead className="sticky top-0 z-[3]">
            <tr>
              <th className="text-left sticky-col min-w-[280px]">Componente / matéria-prima</th>
              <th className="text-left w-[120px]">NCM</th>
              <th className="text-right w-[70px]">Qtd.</th>
              <th className="text-right w-[120px]">Importado s/ IPI</th>
              <th className="text-right w-[120px]">Nacional s/ IPI</th>
              <th className="text-right w-[80px]">% IPI</th>
              <th className="text-right">Valor c/ IPI</th>
              <th className="text-right">PIS {pct(ficha.parametros.pis_credito)}</th>
              <th className="text-right">COFINS {pct(ficha.parametros.cofins_credito)}</th>
              <th className="text-right">IPI crédito</th>
              <th className="text-right">ICMS {pct(ficha.parametros.icms_importado, 0)} imp.</th>
              <th className="text-right">ICMS {pct(ficha.parametros.icms_nacional, 0)} nac.</th>
              <th className="w-10" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, index) => {
              const m = materialById.get(l.material_id);
              const unitImp = m && !m.is_national ? Number(m.price) : 0;
              const unitNac = m && m.is_national ? Number(m.price) : 0;
              return (
                <tr key={`${l.material_id}-${index}`}>
                  <td className="input sticky-col">
                    <div className="flex items-center">
                      <input
                        className="sheet-input"
                        aria-label="Componente"
                        defaultValue={l.nome}
                        key={`nm-${l.nome}`}
                        onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== l.nome && updateMaterial(l.material_id, { name: e.target.value.trim() })}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                      {m?.used_in > 1 && <Badge tone="warn" className="mr-2 shrink-0" title="Este insumo aparece em outras fichas">em {m.used_in} fichas</Badge>}
                    </div>
                  </td>
                  <TextCell value={l.ncm} label="NCM" onCommit={(v) => updateMaterial(l.material_id, { ncm: v })} />
                  <NumberCell value={l.quantidade} format="qty" label="Quantidade" min={0.0001} onCommit={(v) => { const lines = currentLines(); lines[index].quantity = v; saveLines(lines); }} />
                  <NumberCell value={unitImp || null} format="money3" label="Valor importado sem IPI" onCommit={(v) => setPrice(m, 'importado', v)} />
                  <NumberCell value={unitNac || null} format="money3" label="Valor nacional sem IPI" onCommit={(v) => setPrice(m, 'nacional', v)} />
                  <NumberCell value={l.ipi_percentual} format="percent" label="% IPI" min={0} onCommit={(v) => updateMaterial(l.material_id, { ipi_percent: v })} />
                  <CalcCell value={l.com_ipi} strong />
                  <CalcCell value={l.pis_importado + l.pis_nacional} />
                  <CalcCell value={l.cofins_importado + l.cofins_nacional} />
                  <CalcCell value={l.ipi} />
                  <CalcCell value={l.icms_importado} />
                  <CalcCell value={l.icms_nacional} />
                  <td className="cell text-center"><IconButton size="sm" variant="danger" icon={Trash2} label={`Tirar ${l.nome} da ficha`} disabled={saving} onClick={() => saveLines(currentLines().filter((_, i) => i !== index))} /></td>
                </tr>
              );
            })}
            <AddComponentRow materials={materials} onAdd={addComponent} colSpan={12} />
            <tr className="total">
              <td className="cell sticky-col">Totais ({linhas.length} componentes)</td>
              <td className="cell" /><td className="cell" />
              <td className="cell text-right num">{brl(t.importado).replace('R$', '').trim()}</td>
              <td className="cell text-right num">{brl(t.nacional).replace('R$', '').trim()}</td>
              <td className="cell" />
              {[t.com_ipi, t.pis, t.cofins, t.ipi, t.icms_importado, t.icms_nacional].map((v, i) => (
                <td key={i} className="cell text-right num">{brl(v).replace('R$', '').trim()}</td>
              ))}
              <td className="cell" />
            </tr>
          </tbody>
        </table>
      </SheetFrame>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { key: 'LUCRO_REAL', label: 'Custo Lucro Real', value: ficha.custos.lucro_real, how: 'com IPI − PIS − COFINS − IPI − ICMS' },
          { key: 'LUCRO_PRESUMIDO', label: 'Custo Lucro Presumido', value: ficha.custos.lucro_presumido, how: 'com IPI − IPI − ICMS' },
          { key: 'SIMPLES', label: 'Custo Simples Nacional', value: ficha.custos.simples, how: 'com IPI, sem créditos' },
        ].map((c) => {
          const current = regime === c.key;
          return (
            <div key={c.key} className={`p-4 rounded-xl border ${current ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2'}`}>
              <p className="text-xs font-medium text-ink-2 flex items-center gap-2">{c.label} {current && <Badge tone="brand">usado no preço</Badge>}</p>
              <p className="text-xl font-semibold text-ink num mt-1">{brl(c.value)}</p>
              <p className="text-xs text-ink-3 mt-0.5">{c.how}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-ink-3">
        O preço de cada insumo é o mesmo em todas as fichas que o usam: mudar o valor de um componente marcado “em N fichas” muda o custo de todos esses modelos.
        A empresa está no {REGIME_LABEL[regime]}, por isso o custo destacado é o usado no markup.
      </p>
    </div>
  );
};

// ----------------------------------------------------------------------------- catálogo de insumos
const Catalogo = ({ ctx }) => {
  const { materials, run, companyId } = ctx;
  const [confirm, confirmDialog] = useConfirm();
  const parts = ['materials', 'painel'];
  const update = (m, body) => run(() => http.put(`/materials/${m.id}`, body), parts);
  const remove = async (m) => {
    const ok = await confirm({ title: `Excluir o insumo “${m.name}”?`, description: 'Só é possível excluir insumos que não estão em nenhuma ficha técnica.', confirmLabel: 'Excluir', danger: true });
    if (ok) run(() => http.delete(`/materials/${m.id}`), parts, `Insumo “${m.name}” excluído.`);
  };

  return (
    <div className="space-y-3">
      {confirmDialog}
      <p className="text-[13px] text-ink-2">Todos os componentes que podem entrar nas fichas. Origem define o crédito de ICMS (importado {pct(ctx.painel.parametros.icms_credit_imported_percent, 0)} · nacional {pct(ctx.painel.parametros.icms_credit_national_percent, 0)}).</p>
      <SheetFrame maxHeight="65vh">
        <table className="sheet min-w-[900px]">
          <thead className="sticky top-0 z-[3]">
            <tr>
              <th className="text-left sticky-col min-w-[300px]">Insumo</th>
              <th className="text-left w-[140px]">NCM</th>
              <th className="text-left w-[130px]">Origem</th>
              <th className="text-right w-[140px]">Valor sem IPI</th>
              <th className="text-right w-[100px]">% IPI</th>
              <th className="text-right w-[110px]">Nas fichas</th>
              <th className="w-10" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                <TextCell className="sticky-col" value={m.name} required label="Insumo" onCommit={(v) => update(m, { name: v })} />
                <TextCell value={m.ncm || ''} label="NCM" onCommit={(v) => update(m, { ncm: v })} />
                <SelectCell value={m.is_national ? 'nacional' : 'importado'} label="Origem" onChange={(v) => update(m, { is_national: v === 'nacional' })}>
                  <option value="nacional">Nacional</option>
                  <option value="importado">Importado</option>
                </SelectCell>
                <NumberCell value={Number(m.price)} format="money3" label="Valor sem IPI" min={0} onCommit={(v) => update(m, { price: v })} />
                <NumberCell value={Number(m.ipi_percent)} format="percent" label="% IPI" min={0} onCommit={(v) => update(m, { ipi_percent: v })} />
                <CalcCell format="int" value={m.used_in} />
                <td className="cell text-center"><IconButton size="sm" variant="danger" icon={Trash2} label={`Excluir ${m.name}`} disabled={m.used_in > 0} onClick={() => remove(m)} /></td>
              </tr>
            ))}
            <tr>
              <TextCell key={`novo-${materials.length}`} className="sticky-col" value="" placeholder="+ novo insumo" label="Novo insumo" onCommit={(v) => v && run(() => http.post('/materials', { company_id: companyId, name: v, price: 0, ipi_percent: 0, is_national: true }), parts)} />
              <td colSpan={6} className="calc" />
            </tr>
          </tbody>
        </table>
      </SheetFrame>
    </div>
  );
};

// ----------------------------------------------------------------------------- aba
const FichasSheet = ({ ctx }) => {
  const { painel, run, companyId } = ctx;
  const produtos = painel.produtos;
  const [view, setView] = useState(() => (produtos[0] ? String(produtos[0].id) : 'catalogo'));
  const [newModel, setNewModel] = useState(null);

  // Se o modelo aberto foi excluído, mostra o primeiro (ou o catálogo).
  const product = view === 'catalogo' ? undefined : produtos.find((p) => String(p.id) === view) ?? produtos[0];
  const current = product ? String(product.id) : 'catalogo';

  const createModel = async () => {
    if (!newModel?.name?.trim()) return;
    const body = { company_id: companyId, name: newModel.name.trim(), sku: newModel.sku?.trim() || '' };
    setNewModel(null);
    const res = await run(() => http.post('/products', body), ['painel'], `Modelo “${body.sku || body.name}” criado. Adicione os componentes da ficha.`);
    if (res?.data?.id) setView(String(res.data.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Fichas técnicas</h2>
          <p className="text-[13px] text-ink-2 mt-0.5">Uma ficha por modelo, como as abas FICHA TECNICA 1, 2, 3… da planilha.</p>
        </div>
        <Button size="sm" icon={Plus} onClick={() => setNewModel({ name: '', sku: '' })}>Novo modelo</Button>
      </div>

      <Tabs
        value={current}
        onChange={setView}
        items={[
          ...produtos.map((p, i) => ({ id: String(p.id), label: `${i + 1} · ${p.sku || p.name.slice(0, 14)}` })),
          { id: 'catalogo', label: 'Catálogo de insumos', icon: Boxes },
        ]}
      />

      {current === 'catalogo' && <Catalogo ctx={ctx} />}
      {product && <FichaModelo key={product.id} ctx={ctx} product={product} onDeleted={() => setView('catalogo')} />}
      {!product && produtos.length === 0 && <Alert tone="info">Nenhum modelo cadastrado ainda. Clique em “Novo modelo”.</Alert>}

      <Modal
        open={newModel !== null}
        onClose={() => setNewModel(null)}
        title="Novo modelo"
        description="Cria uma ficha técnica vazia. O rateio do modelo é definido no Painel."
        size="sm"
        footer={<><Button onClick={() => setNewModel(null)}>Cancelar</Button><Button variant="primary" onClick={createModel} disabled={!newModel?.name?.trim()}>Criar modelo</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nome do modelo"><Input autoFocus value={newModel?.name ?? ''} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} placeholder="Ex.: Bicicleta Aro 29 KRW Alumínio 24 Vel" /></Field>
          <Field label="Código"><Input value={newModel?.sku ?? ''} onChange={(e) => setNewModel({ ...newModel, sku: e.target.value })} placeholder="Ex.: X52" /></Field>
        </div>
      </Modal>
    </div>
  );
};

export default FichasSheet;
