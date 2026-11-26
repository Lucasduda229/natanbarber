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

const formatBRL = (value: number | string): string => {
  if (typeof value === "number") {
    return value.toFixed(2).replace(".", ",");
  }
  return value || "0,00";
};

export interface ConfirmationPriceDetails {
  /** Valor base do(s) serviço(s), sem adicional noturno ou taxa extra */
  servicePrice?: number | string;
  /** Valor do adicional noturno aplicado ao agendamento */
  nightFee?: number;
  /** Valor de outra taxa adicional configurável (fora do horário noturno) */
  extraFee?: number;
  /** Rótulo da taxa adicional configurável */
  extraFeeName?: string;
}

export const getConfirmationMessage = (
  customerName: string,
  serviceName: string,
  date: string,
  time: string,
  price?: number | string,
  details?: ConfirmationPriceDetails
): string => {
  const formattedTotal = formatBRL(price ?? "0,00");
  const isNight = isAtOrAfter19h(time);
  const nightFeeAmount = details?.nightFee ?? (isNight ? 5 : 0);
  const extraFeeAmount = details?.extraFee ?? 0;

  let priceBlock: string;
  if (nightFeeAmount > 0 && details?.servicePrice !== undefined) {
    priceBlock = [
      `Valor do serviço: R$ ${formatBRL(details.servicePrice)}`,
      `Taxa adicional noturna (após as 19h): + R$ ${formatBRL(nightFeeAmount)}`,
      `Total: R$ ${formattedTotal}`,
    ].join("\n");
  } else if (extraFeeAmount > 0 && details?.servicePrice !== undefined) {
    const feeLabel = details.extraFeeName || "Taxa adicional";
    priceBlock = [
      `Valor do serviço: R$ ${formatBRL(details.servicePrice)}`,
      `${feeLabel}: + R$ ${formatBRL(extraFeeAmount)}`,
      `Total: R$ ${formattedTotal}`,
    ].join("\n");
  } else {
    priceBlock = `Valor: R$ ${formattedTotal}`;
  }

  const nightFeeNotice =
    isNight && nightFeeAmount > 0
      ? `\n\nInformamos que atendimentos após as 19h possuem um adicional de R$ ${formatBRL(nightFeeAmount)} sobre o valor do serviço.`
      : "";

  return `Olá, ${customerName}! Seu agendamento foi confirmado! ✂️

Serviço: ${serviceName}
Data: ${date}
Horário: ${time}
${priceBlock}${nightFeeNotice}

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
