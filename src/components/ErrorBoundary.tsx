import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Erro não tratado na aplicação:", error, errorInfo);
  }

  private handleReset = async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch {
      // Ignora erro ao limpar
    }

    const url = new URL(window.location.href);
    url.searchParams.set("_fix", Date.now().toString());
    window.location.href = url.toString();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-primary/30 bg-card/95 p-6 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2">
              Ops! Algo deu errado
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              O aplicativo precisou ser recarregado para sincronizar a versão mais recente.
            </p>

            <button
              onClick={this.handleReset}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-background font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-gold-glow hover:brightness-110"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
