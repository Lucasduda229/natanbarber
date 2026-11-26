export const generateWhatsAppLink = (phone: string, message: string): string => {
  const cleanPhone = phone.replace(/\D/g, "");
  const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
};

export const openWhatsApp = (phone: string, message: string): void => {
  const url = generateWhatsAppLink(phone, message);
  window.open(url, "_blank", "noopener,noreferrer");
};

const isAtOrAfter19h = (time: string): boolean => {
  const hour = parseInt(time.split(":")[0], 10);
  return !isNaN(hour) && hour >= 19;
};

export const getConfirmationMessage = (
  customerName: string,
  serviceName: string,
  date: string,
  time: string,
  price?: number | string
): string => {
  const formattedPrice =
    typeof price === "number"
      ? price.toFixed(2).replace(".", ",")
      : price || "0,00";

  const nightFeeNotice = isAtOrAfter19h(time)
    ? "\n\nInformamos que atendimentos após as 19h possuem um adicional de R$ 5,00 sobre o valor do serviço."
    : "";

  return `Olá, ${customerName}! Seu agendamento foi confirmado! ✂️

Serviço: ${serviceName}
Data: ${date}
Horário: ${time}
Valor: R$ ${formattedPrice}${nightFeeNotice}

Até lá!
Natan Barber Shop`;
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

_Natan Barber_`;
};
