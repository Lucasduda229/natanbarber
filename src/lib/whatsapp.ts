export const generateWhatsAppLink = (phone: string, message: string): string => {
  const cleanPhone = phone.replace(/\D/g, "");
  const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
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
