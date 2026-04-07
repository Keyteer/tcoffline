export function cleanRUT(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function formatRUT(rut: string): string {
  const cleaned = cleanRUT(rut);

  if (cleaned.length === 0) return '';

  const dv = cleaned.slice(-1);
  const numbers = cleaned.slice(0, -1);

  if (numbers.length === 0) return cleaned;

  const reversed = numbers.split('').reverse();
  const withDots = reversed.reduce((acc, digit, index) => {
    if (index > 0 && index % 3 === 0) {
      return digit + '.' + acc;
    }
    return digit + acc;
  }, '');

  return withDots + '-' + dv;
}

export function calculateDV(rut: string): string {
  const cleaned = cleanRUT(rut);
  const numbers = cleaned.slice(0, -1);

  if (numbers.length === 0) return '';

  let sum = 0;
  let multiplier = 2;

  for (let i = numbers.length - 1; i >= 0; i--) {
    sum += parseInt(numbers[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const dv = 11 - remainder;

  if (dv === 11) return '0';
  if (dv === 10) return 'K';
  return dv.toString();
}

export function validateRUT(rut: string): boolean {
  const cleaned = cleanRUT(rut);

  if (cleaned.length < 2) return false;

  const dv = cleaned.slice(-1);
  const calculatedDV = calculateDV(cleaned);

  return dv === calculatedDV;
}

export function getRUTError(rut: string): string | null {
  if (!rut || rut.trim().length === 0) {
    return null;
  }

  const cleaned = cleanRUT(rut);

  if (cleaned.length < 2) {
    return 'RUT incompleto';
  }

  if (cleaned.length < 8 || cleaned.length > 9) {
    return 'RUT debe tener entre 8 y 9 dígitos';
  }

  if (!validateRUT(rut)) {
    return 'RUT inválido (dígito verificador incorrecto)';
  }

  return null;
}
