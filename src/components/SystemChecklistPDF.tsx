import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

const checklistData = {
  title: "Checklist do Micro SaaS - Barbearia",
  sections: [
    {
      title: "AUTENTICACAO & USUARIOS",
      items: [
        "Cadastro de usuarios com email/senha",
        "Login com validacao",
        "Recuperacao de senha por email",
        "Perfis de usuario (nome, telefone, avatar)",
        "Sistema de roles (admin/user) com RLS",
        "Auto-confirm de email habilitado",
      ],
    },
    {
      title: "AGENDAMENTOS",
      items: [
        "Selecao de servicos multiplos",
        "Calendario de datas disponiveis",
        "Horarios dinamicos por dia da semana",
        "Bloqueio automatico ao confirmar",
        "Status: pendente, confirmado, concluido, cancelado",
        "Historico de agendamentos do cliente",
        "Notas/observacoes no agendamento",
      ],
    },
    {
      title: "SERVICOS",
      items: [
        "CRUD de servicos (admin)",
        "Preco, duracao, descricao",
        "Ativar/desativar servicos",
        "Galeria de imagens por servico",
      ],
    },
    {
      title: "PROGRAMA DE FIDELIDADE",
      items: [
        "Configuracao de programa (visitas necessarias)",
        "Progresso do cliente",
        "Resgate de recompensas",
        "Historico de resgates",
        "Gerenciamento pelo admin",
      ],
    },
    {
      title: "AVALIACOES",
      items: [
        "Avaliacao pos-atendimento (1-5 estrelas)",
        "Comentarios opcionais",
        "Exibicao publica na home",
        "Vinculacao com agendamento concluido",
      ],
    },
    {
      title: "NOTIFICACOES",
      items: [
        "Notificacoes in-app para admin",
        "Alerta de novos agendamentos",
        "Marcar como lida/excluir",
        "Badge contador de nao lidas",
      ],
    },
    {
      title: "PAGAMENTOS",
      items: [
        "Geracao de QR Code PIX",
        "Status de pagamento (pendente/pago)",
        "Selecao de metodo de pagamento",
      ],
    },
    {
      title: "PAINEL ADMIN",
      items: [
        "Dashboard de agendamentos do dia",
        "Gerenciamento de horarios por dia",
        "Bloqueio de datas/horarios especificos",
        "Gerenciamento de servicos",
        "Gerenciamento de galeria",
        "Lista de clientes com historico",
        "Notas sobre clientes",
        "Toggle aberto/fechado da barbearia",
        "Layout responsivo mobile",
      ],
    },
    {
      title: "ASSISTENTE IA",
      items: [
        "Parser de linguagem natural para agendamentos",
        "Sugestao de horarios disponiveis",
      ],
    },
    {
      title: "PWA (Progressive Web App)",
      items: [
        "Instalavel no celular",
        "Icones e splash screen",
        "Indicador offline",
        "Pagina de instalacao",
      ],
    },
    {
      title: "UI/UX",
      items: [
        "Design responsivo",
        "Tema escuro elegante",
        "Animacoes com GSAP",
        "Background animado",
        "Componentes shadcn/ui",
      ],
    },
    {
      title: "SEGURANCA",
      items: [
        "RLS em todas as tabelas",
        "Funcao has_role() security definer",
        "Politicas por usuario/admin",
        "Triggers automaticos",
      ],
    },
  ],
};

export const SystemChecklistPDF = () => {
  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = 25;
      const lineHeight = 7;
      const sectionGap = 10;

      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(checklistData.title, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 12;

      // Subtitle
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      const date = new Date().toLocaleDateString("pt-BR");
      doc.text("Gerado em: " + date, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;
      doc.setTextColor(0);

      // Sections
      checklistData.sections.forEach((section) => {
        // Check if we need a new page
        const sectionHeight = (section.items.length + 1) * lineHeight + sectionGap;
        if (yPosition + sectionHeight > doc.internal.pageSize.getHeight() - 25) {
          doc.addPage();
          yPosition = 25;
        }

        // Section title with underline
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(section.title, margin, yPosition);
        yPosition += 2;
        doc.setDrawColor(200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight;

        // Items
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        section.items.forEach((item) => {
          if (yPosition > doc.internal.pageSize.getHeight() - 25) {
            doc.addPage();
            yPosition = 25;
          }
          doc.text("[x] " + item, margin + 5, yPosition);
          yPosition += lineHeight;
        });

        yPosition += sectionGap;
      });

      // Footer with total
      if (yPosition > doc.internal.pageSize.getHeight() - 35) {
        doc.addPage();
        yPosition = 25;
      }
      yPosition += 5;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const totalItems = checklistData.sections.reduce((acc, s) => acc + s.items.length, 0);
      doc.text("Total: " + totalItems + "+ funcionalidades implementadas!", margin, yPosition);

      // Save the PDF
      doc.save("checklist-barbearia-saas.pdf");
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <Button onClick={generatePDF} size="sm" className="gap-2 h-8 text-xs sm:text-sm">
      <FileDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Baixar Checklist</span>
      <span className="sm:hidden">PDF</span>
    </Button>
  );
};
