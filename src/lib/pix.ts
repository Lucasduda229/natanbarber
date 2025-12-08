// Gerador de Payload PIX seguindo o padrão EMV/BR Code

function computeCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xFFFF;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
}

interface PixPayloadOptions {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  description?: string;
  txId?: string;
}

export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  description,
  txId = '***'
}: PixPayloadOptions): string {
  // Limita o nome do comerciante a 25 caracteres
  const formattedMerchantName = merchantName.substring(0, 25).toUpperCase();
  // Limita a cidade a 15 caracteres
  const formattedMerchantCity = merchantCity.substring(0, 15).toUpperCase();
  
  // Campo 00: Payload Format Indicator
  let payload = formatField('00', '01');
  
  // Campo 01: Point of Initiation Method (12 = dinâmico, pode ser usado várias vezes)
  payload += formatField('01', '12');
  
  // Campo 26: Merchant Account Information (GUI do PIX + chave)
  const gui = formatField('00', 'br.gov.bcb.pix');
  const key = formatField('01', pixKey);
  const merchantAccountInfo = gui + key + (description ? formatField('02', description.substring(0, 50)) : '');
  payload += formatField('26', merchantAccountInfo);
  
  // Campo 52: Merchant Category Code
  payload += formatField('52', '0000');
  
  // Campo 53: Transaction Currency (986 = BRL)
  payload += formatField('53', '986');
  
  // Campo 54: Transaction Amount (opcional)
  if (amount && amount > 0) {
    payload += formatField('54', amount.toFixed(2));
  }
  
  // Campo 58: Country Code
  payload += formatField('58', 'BR');
  
  // Campo 59: Merchant Name
  payload += formatField('59', formattedMerchantName);
  
  // Campo 60: Merchant City
  payload += formatField('60', formattedMerchantCity);
  
  // Campo 62: Additional Data Field Template (txId)
  const additionalDataField = formatField('05', txId);
  payload += formatField('62', additionalDataField);
  
  // Campo 63: CRC16 (checksum)
  payload += '6304';
  const crc = computeCRC16(payload);
  payload += crc;
  
  return payload;
}
