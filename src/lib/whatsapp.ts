export const generateWhatsAppLink = (phone: string, message: string): string => {
  const cleanPhone = phone.replace(/\D/g, "");
  const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
};

export const openWhatsApp = (phone: string, message: string): void => {
  const url = generateWhatsAppLink(phone, message);
  window.open(url, "_blank", "noopener,noreferrer");
};

export const getConfirmationMessage = (
  customerName: string,
  serviceName: string,
  date: string,
  time: string
): string => {
  return `Olá ${customerName}! 👋

Seu agendamento foi *CONFIRMADO*! ✅

📅 *${serviceName}*
📆 Data: ${date}
⏰ Horário: ${time}

Até lá! 💈

_Natan BarberShop_`;
};

export const getCancellationMessage = (
  customerName: string,
  serviceName: string,
  date: string,
  time: string
): string => {
  return `Olá ${customerName}! 👋

Infelizmente seu agendamento foi *CANCELADO*. ❌

📅 *${serviceName}*
📆 Data: ${date}
⏰ Horário: ${time}

Se desejar, você pode reagendar pelo nosso site ou entrar em contato.

Desculpe pelo inconveniente! 🙏

_Natan BarberShop_`;
};
