import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import http, { errorMessage } from '../../services/http';
import { Alert, Button, Field, Modal } from '../../components/ui';

/** Carrega a pasta de planilhas (CSV) no cadastro da empresa. */
const ImportPlanilhasModal = ({ open, onClose, companyId, onDone, onError }) => {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('mesclar');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const substituir = mode === 'substituir';
      let res;
      if (files.length > 0) {
        const form = new FormData();
        form.append('companyId', companyId);
        form.append('substituir', String(substituir));
        files.forEach((f) => form.append('files', f));
        res = await http.post('/pricing/import-planilhas', form);
      } else {
        res = await http.post('/pricing/import-planilhas', { companyId, substituir });
      }
      const r = res.data.resumo;
      setFiles([]);
      onDone(`Planilhas carregadas: ${r.canais.criados + r.canais.atualizados} canais, ${r.produtos.criados + r.produtos.atualizados} modelos, `
        + `${r.itens_ficha} componentes de ficha, ${r.custos_fixos.criados + r.custos_fixos.atualizados} custos fixos, `
        + `${r.folha.criados + r.folha.atualizados} funcionários e ${r.pro_labore.criados + r.pro_labore.atualizados} pró-labores.`);
    } catch (error) {
      onError(errorMessage(error, 'Erro ao carregar as planilhas.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Carregar planilhas de markup"
      description="Lê PAINEL, FICHA TECNICA 1 a 10, CUSTO FIXO, FOLHA e PRO-LABORE e grava tudo nesta empresa."
      footer={(
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant={mode === 'substituir' ? 'danger' : 'primary'} icon={Upload} loading={loading} onClick={run}>
            {mode === 'substituir' ? 'Substituir e carregar' : 'Carregar'}
          </Button>
        </>
      )}
    >
      <div className="space-y-5">
        <Field label="Arquivos CSV (opcional)" hint={files.length > 0 ? `${files.length} arquivo(s) escolhido(s).` : 'Sem arquivos, usa as planilhas guardadas no servidor (backend/markup_files). No Excel: Arquivo → Salvar como → CSV (separado por ponto e vírgula), uma aba por arquivo.'}>
          <input
            type="file" accept=".csv" multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-ink-2 file:mr-3 file:h-9 file:px-4 file:rounded-lg file:border file:border-line file:bg-surface-2 file:text-ink file:font-medium file:cursor-pointer"
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium text-ink-2 mb-1.5">O que fazer com o cadastro atual</legend>
          {[
            { id: 'mesclar', title: 'Mesclar', text: 'Atualiza o que tem o mesmo nome ou código e acrescenta o resto. Nada é apagado.' },
            { id: 'substituir', title: 'Substituir tudo', text: 'Apaga antes canais, modelos, insumos, fichas, custos fixos, folha e pró-labore desta empresa.' },
          ].map((opt) => (
            <label key={opt.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${mode === opt.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2'}`}>
              <input type="radio" name="modo" className="mt-1 accent-[var(--brand)]" checked={mode === opt.id} onChange={() => setMode(opt.id)} />
              <span>
                <span className="block text-sm font-medium text-ink">{opt.title}</span>
                <span className="block text-xs text-ink-2 mt-0.5">{opt.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {mode === 'substituir' && <Alert tone="warning">Isso não pode ser desfeito pelo sistema. Faça um backup do banco se tiver dúvidas.</Alert>}
      </div>
    </Modal>
  );
};

export default ImportPlanilhasModal;
