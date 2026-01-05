import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";

const checklistData = {
  title: "Checklist do Micro SaaS - Barbearia",
  sections: [
    {
      icon: "🔐",
      title: "Autenticação & Usuários",
      items: [
        "Cadastro de usuários com email/senha",
        "Login com validação",
        "Recuperação de senha por email",
        "Perfis de usuário (nome, telefone, avatar)",
        "Sistema de roles (admin/user) com RLS",
        "Auto-confirm de email habilitado",
      ],
    },
    {
      icon: "📅",
      title: "Agendamentos",
      items: [
        "Seleção de serviços múltiplos",
        "Calendário de datas disponíveis",
        "Horários dinâmicos por dia da semana",
        "Bloqueio automático ao confirmar",
        "Status: pendente → confirmado → concluído/cancelado",
        "Histórico de agendamentos do cliente",
        "Notas/observações no agendamento",
      ],
    },
    {
      icon: "💈",
      title: "Serviços",
      items: [
        "CRUD de serviços (admin)",
        "Preço, duração, descrição",
        "Ativar/desativar serviços",
        "Galeria de imagens por serviço",
      ],
    },
    {
      icon: "🎁",
      title: "Programa de Fidelidade",
      items: [
        "Configuração de programa (visitas necessárias)",
        "Progresso do cliente",
        "Resgate de recompensas",
        "Histórico de resgates",
        "Gerenciamento pelo admin",
      ],
    },
    {
      icon: "⭐",
      title: "Avaliações",
      items: [
        "Avaliação pós-atendimento (1-5 estrelas)",
        "Comentários opcionais",
        "Exibição pública na home",
        "Vinculação com agendamento concluído",
      ],
    },
    {
      icon: "🔔",
      title: "Notificações",
      items: [
        "Notificações in-app para admin",
        "Alerta de novos agendamentos",
        "Marcar como lida/excluir",
        "Badge contador de não lidas",
      ],
    },
    {
      icon: "💳",
      title: "Pagamentos",
      items: [
        "Geração de QR Code PIX",
        "Status de pagamento (pendente/pago)",
        "Seleção de método de pagamento",
      ],
    },
    {
      icon: "👨‍💼",
      title: "Painel Admin",
      items: [
        "Dashboard de agendamentos do dia",
        "Gerenciamento de horários por dia",
        "Bloqueio de datas/horários específicos",
        "Gerenciamento de serviços",
        "Gerenciamento de galeria",
        "Lista de clientes com histórico",
        "Notas sobre clientes",
        "Toggle aberto/fechado da barbearia",
        "Layout responsivo mobile",
      ],
    },
    {
      icon: "🤖",
      title: "Assistente IA",
      items: [
        "Parser de linguagem natural para agendamentos",
        "Sugestão de horários disponíveis",
      ],
    },
    {
      icon: "📱",
      title: "PWA (Progressive Web App)",
      items: [
        "Instalável no celular",
        "Ícones e splash screen",
        "Indicador offline",
        "Página de instalação",
      ],
    },
    {
      icon: "🎨",
      title: "UI/UX",
      items: [
        "Design responsivo",
        "Tema escuro elegante",
        "Animações com GSAP",
        "Background animado",
        "Componentes shadcn/ui",
      ],
    },
    {
      icon: "🔒",
      title: "Segurança",
      items: [
        "RLS em todas as tabelas",
        "Função has_role() security definer",
        "Políticas por usuário/admin",
        "Triggers automáticos",
      ],
    },
  ],
};

export const SystemChecklistPDF = () => {
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;
    const lineHeight = 6;
    const sectionGap = 8;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(checklistData.title, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 12;

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const date = new Date().toLocaleDateString("pt-BR");
    doc.text(`Gerado em: ${date}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;
    doc.setTextColor(0);

    // Sections
    checklistData.sections.forEach((section) => {
      // Check if we need a new page
      const sectionHeight = (section.items.length + 1) * lineHeight + sectionGap;
      if (yPosition + sectionHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }

      // Section title
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${section.icon} ${section.title}`, margin, yPosition);
      yPosition += lineHeight + 2;

      // Items
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      section.items.forEach((item) => {
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`  ✓  ${item}`, margin + 5, yPosition);
        yPosition += lineHeight;
      });

      yPosition += sectionGap;
    });

    // Footer with total
    if (yPosition > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPosition = 20;
    }
    yPosition += 5;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const totalItems = checklistData.sections.reduce((acc, s) => acc + s.items.length, 0);
    doc.text(`Total: ${totalItems}+ funcionalidades implementadas 🚀`, margin, yPosition);

    // Save the PDF
    doc.save("checklist-barbearia-saas.pdf");
  };

  return (
    <Button onClick={generatePDF} className="gap-2">
      <FileDown className="h-4 w-4" />
      Baixar Checklist PDF
    </Button>
  );
};
