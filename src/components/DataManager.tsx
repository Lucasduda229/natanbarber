import { useState } from "react";
import { Download, Upload, Database, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DataManager = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-all-data");

      if (error) throw error;

      // Download as JSON file
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
      toast.success(`Exportação concluída! ${totalRows} registros exportados.`);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar: " + (error.message || "Erro desconhecido"));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Selecione um arquivo .json válido");
      return;
    }

    if (!confirm("⚠️ ATENÇÃO: Isso vai sobrescrever dados existentes com os dados do arquivo. Deseja continuar?")) {
      event.target.value = "";
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.version || !importData.tables) {
        toast.error("Arquivo de backup inválido");
        return;
      }

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
      event.target.value = "";
    }
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
            Baixa um arquivo JSON com <strong>todos os dados</strong> do sistema: agendamentos, clientes, serviços, assinaturas, pacotes, avaliações, configurações e mais.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Profiles, roles e configurações de admin</li>
            <li>Todos os agendamentos e serviços adicionais</li>
            <li>Assinaturas e progresso de fidelidade</li>
            <li>Pacotes, pagamentos e galeria</li>
            <li>Notificações, avaliações e bloqueios</li>
          </ul>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="gap-2"
            size="lg"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar Tudo (.json)
              </>
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
            Restaure dados a partir de um arquivo de backup JSON exportado anteriormente. 
            <strong className="text-amber-400"> Os dados existentes serão atualizados</strong> (upsert por ID).
          </p>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={importing}
                className="hidden"
              />
              <Button
                variant="outline"
                size="lg"
                className="gap-2 border-amber-500/30 hover:bg-amber-500/10"
                disabled={importing}
                asChild
              >
                <span>
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Selecionar Arquivo (.json)
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>

          {/* Import Results */}
          {importResult && (
            <Card className="bg-card/60 border-primary/10 mt-4">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Resultado da Importação
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-500/10 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-400">{importResult.total_inserted}</div>
                    <div className="text-muted-foreground">Registros importados</div>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-red-400">{importResult.total_errors}</div>
                    <div className="text-muted-foreground">Erros</div>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  {Object.entries(importResult.tables as Record<string, { inserted: number; errors: string[] }>).map(([table, info]) => (
                    <div key={table} className="flex items-center justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">{table}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">{info.inserted}</span>
                        {info.errors.length > 0 && (
                          <span className="text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {info.errors.length}
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
