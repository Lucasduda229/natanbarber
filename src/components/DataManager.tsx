import { useState, useRef } from "react";
import { Download, Upload, Database, CheckCircle, AlertCircle, RefreshCw, FileText, Users, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BackupPreview {
  version: string;
  exported_at: string;
  auth_users_count: number;
  row_counts: Record<string, number>;
  total_rows: number;
  table_count: number;
}

const DataManager = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-all-data");
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-completo-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRows = Object.values(data.row_counts as Record<string, number>).reduce((sum: number, count: number) => sum + count, 0);
      const authCount = data.auth_users_count || 0;
      toast.success(`Exportação concluída! ${totalRows} registros + ${authCount} usuários exportados.`);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar: " + (error.message || "Erro desconhecido"));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Selecione um arquivo .json válido");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.tables) {
        toast.error("Arquivo de backup inválido");
        event.target.value = "";
        return;
      }

      const rowCounts = data.row_counts || {};
      const totalRows = Object.values(rowCounts as Record<string, number>).reduce((s: number, c: number) => s + c, 0);

      setBackupPreview({
        version: data.version,
        exported_at: data.exported_at,
        auth_users_count: data.auth_users?.length || data.auth_users_count || 0,
        row_counts: rowCounts,
        total_rows: totalRows,
        table_count: Object.keys(data.tables).length,
      });
      setPendingFile(file);
    } catch {
      toast.error("Erro ao ler o arquivo");
      event.target.value = "";
    }
  };

  const handleCancelImport = () => {
    setBackupPreview(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;

    if (!confirm("⚠️ ATENÇÃO: Isso vai sobrescrever dados existentes. Deseja continuar?")) {
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const text = await pendingFile.text();
      const importData = JSON.parse(text);

      const { data, error } = await supabase.functions.invoke("import-all-data", {
        body: importData,
      });

      if (error) throw error;

      setImportResult(data.summary);
      toast.success(`Importação concluída! ${data.summary.total_inserted} registros importados.`);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Erro ao importar: " + (error.message || "Erro desconhecido"));
    } finally {
      setImporting(false);
      setBackupPreview(null);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const tableLabels: Record<string, string> = {
    profiles: "Perfis",
    user_roles: "Roles",
    services: "Serviços",
    appointments: "Agendamentos",
    appointment_services: "Serviços extras",
    blocked_dates: "Bloqueios",
    time_slots: "Horários",
    packages: "Pacotes",
    package_items: "Itens pacote",
    package_benefits: "Benefícios",
    package_payments: "Pagamentos",
    client_packages: "Pacotes cliente",
    client_package_usage: "Uso pacotes",
    subscription_progress: "Assinaturas",
    loyalty_programs: "Fidelidade",
    loyalty_progress: "Progresso fidelidade",
    loyalty_rewards_history: "Histórico recompensas",
    subscriber_rewards: "Recompensas assinante",
    reward_claims: "Claims",
    reviews: "Avaliações",
    notifications: "Notificações",
    revenue_adjustments: "Ajustes receita",
    admin_settings: "Configurações",
    barbershop_status: "Status barbearia",
    service_gallery: "Galeria",
    push_subscriptions: "Push",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          Gerenciar Dados
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Exporte e importe todos os dados do sistema
        </p>
      </div>

      {/* Export Section */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5 text-green-500" />
            Exportar Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Baixa um arquivo JSON com <strong>todos os dados</strong> do sistema incluindo senhas criptografadas dos usuários.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>Usuários (auth.users)</strong> — contas e senhas criptografadas</li>
            <li>Profiles, roles e configurações de admin</li>
            <li>Todos os agendamentos e serviços adicionais</li>
            <li>Assinaturas e progresso de fidelidade</li>
            <li>Pacotes, pagamentos e galeria</li>
            <li>Notificações, avaliações e bloqueios</li>
          </ul>
          <Button onClick={handleExport} disabled={exporting} className="gap-2" size="lg">
            {exporting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Exportando...</>
            ) : (
              <><Download className="w-4 h-4" /> Exportar Tudo (.json)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-500" />
            Importar Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Restaure dados a partir de um arquivo de backup JSON.
            <strong className="text-amber-400"> Os dados existentes serão atualizados</strong> (upsert por ID).
          </p>

          {!backupPreview && (
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" size="lg" className="gap-2 border-amber-500/30 hover:bg-amber-500/10" asChild>
                <span><Upload className="w-4 h-4" /> Selecionar Arquivo (.json)</span>
              </Button>
            </label>
          )}

          {/* Backup Preview */}
          {backupPreview && (
            <Card className="bg-card/60 border-primary/20 mt-2">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="w-4 h-4 text-primary" />
                  Resumo do Backup
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <div className="text-lg font-bold text-primary">{backupPreview.auth_users_count}</div>
                    <div className="text-muted-foreground">Usuários</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Table className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <div className="text-lg font-bold text-primary">{backupPreview.table_count}</div>
                    <div className="text-muted-foreground">Tabelas</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Database className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <div className="text-lg font-bold text-primary">{backupPreview.total_rows}</div>
                    <div className="text-muted-foreground">Registros</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>📅 Exportado em: {new Date(backupPreview.exported_at).toLocaleString("pt-BR")}</div>
                  <div>📦 Versão: {backupPreview.version}</div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 text-xs border border-border/30 rounded-lg p-2">
                  {Object.entries(backupPreview.row_counts)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([table, count]) => (
                      <div key={table} className="flex items-center justify-between py-0.5">
                        <span className="text-muted-foreground">{tableLabels[table] || table}</span>
                        <span className="font-medium text-foreground">{count as number}</span>
                      </div>
                    ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="gap-2 flex-1"
                  >
                    {importing ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Importando...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Confirmar Importação</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleCancelImport} disabled={importing}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Results */}
          {importResult && (
            <Card className="bg-card/60 border-primary/10 mt-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Resultado da Importação
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-green-500/10 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-400">{importResult.total_inserted}</div>
                    <div className="text-muted-foreground">Importados</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-primary">{importResult.auth_users_imported || 0}</div>
                    <div className="text-muted-foreground">Usuários</div>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-red-400">{importResult.total_errors}</div>
                    <div className="text-muted-foreground">Erros</div>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  {Object.entries(importResult.tables as Record<string, { inserted: number; errors: string[] }>).map(([table, info]) => (
                    <div key={table} className="flex items-center justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">{tableLabels[table] || table}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">{info.inserted}</span>
                        {info.errors.length > 0 && (
                          <span className="text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {info.errors.length}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataManager;
