import { ClipboardList } from 'lucide-react';

const Launches = () => {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Operacional</p>
        <h1 className="text-2xl font-semibold text-slate-900">Lançamentos Mensais</h1>
        <p className="text-sm text-slate-500">Gerencie entradas de faturamento, despesas e tributos em um só lugar.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Em desenvolvimento</h2>
        <p className="mt-2 text-sm text-slate-500">
          Esta área será utilizada para lançar faturamentos, despesas e tributos por competência. Enquanto finalizamos a
          experiência, continue utilizando a aba Dashboard para acompanhar os resultados.
        </p>
      </section>
    </div>
  );
};

export default Launches;

