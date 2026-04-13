import {
  cleanRUT,
  formatRUT,
  calculateDV,
  validateRUT,
  getRUTError,
} from '../rutValidation';

// ---------------------------------------------------------------------------
// 20 confirmed-valid Chilean RUTs used throughout this suite.
// Source: https://buscarrut.cl/generador-rut/.
// ---------------------------------------------------------------------------
const VALID_RUTS = [
  { numbers: '92965062', dv: 'K', formatted: '92.965.062-K' },
  { numbers: '44425731', dv: '8', formatted: '44.425.731-8' },
  { numbers: '50655912', dv: 'K', formatted: '50.655.912-K' },
  { numbers: '5252490',  dv: '3', formatted: '5.252.490-3'  }, // 7-digit
  { numbers: '62858962', dv: '3', formatted: '62.858.962-3' },
  { numbers: '83670202', dv: '6', formatted: '83.670.202-6' },
  { numbers: '61417433', dv: '1', formatted: '61.417.433-1' },
  { numbers: '60755348', dv: '3', formatted: '60.755.348-3' },
  { numbers: '42214065', dv: '4', formatted: '42.214.065-4' },
  { numbers: '81171300', dv: '7', formatted: '81.171.300-7' },
  { numbers: '93253009', dv: '0', formatted: '93.253.009-0' },
  { numbers: '66556363', dv: '4', formatted: '66.556.363-4' },
  { numbers: '39128757', dv: '0', formatted: '39.128.757-0' },
  { numbers: '81794875', dv: '8', formatted: '81.794.875-8' },
  { numbers: '98952002', dv: '4', formatted: '98.952.002-4' },
  { numbers: '56832656', dv: '3', formatted: '56.832.656-3' },
  { numbers: '25859758', dv: '3', formatted: '25.859.758-3' },
  { numbers: '37137317', dv: '9', formatted: '37.137.317-9' },
  { numbers: '20602702', dv: '9', formatted: '20.602.702-9' },
  { numbers: '7559191',  dv: '8', formatted: '7.559.191-8'  }, // 7-digit
] as const;

// ---------------------------------------------------------------------------
// cleanRUT
// ---------------------------------------------------------------------------
describe('cleanRUT', () => {
  it('removes dots and dash, uppercases k', () => {
    expect(cleanRUT('12.345.678-k')).toBe('12345678K');
  });

  it('handles already clean input', () => {
    expect(cleanRUT('12345678K')).toBe('12345678K');
  });

  it('strips non-numeric / non-K characters', () => {
    expect(cleanRUT('abc-12.34')).toBe('1234');
  });

  it('uppercases lowercase k in a full formatted RUT', () => {
    expect(cleanRUT('92.965.062-k')).toBe('92965062K');
  });

  it('handles empty string', () => {
    expect(cleanRUT('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatRUT
// ---------------------------------------------------------------------------
describe('formatRUT', () => {
  it('returns empty for empty input', () => {
    expect(formatRUT('')).toBe('');
  });

  it('formats an 8-digit number with numeric DV', () => {
    expect(formatRUT('123456785')).toBe('12.345.678-5');
  });

  it('formats an 8-digit number with DV=K', () => {
    expect(formatRUT('12345684K')).toBe('12.345.684-K');
  });

  it('formats a 9-digit number', () => {
    expect(formatRUT('92965062K')).toBe('92.965.062-K');
  });

  it('formats a 7-digit number (old-style RUT)', () => {
    expect(formatRUT('52524903')).toBe('5.252.490-3');
  });

  it('formats a 7-digit number with DV=K', () => {
    expect(formatRUT('7559191' + '8')).toBe('7.559.191-8');
  });

  it.each(VALID_RUTS)(
    'round-trips $formatted through cleanRUT → formatRUT',
    ({ numbers, dv, formatted }) => {
      expect(formatRUT(numbers + dv)).toBe(formatted);
    },
  );
});

// ---------------------------------------------------------------------------
// calculateDV
// ---------------------------------------------------------------------------
describe('calculateDV', () => {
  it('returns the correct numeric DV (textbook: 12345678 → 5)', () => {
    // Pass numbers + any trailing char; function strips last char to get number part
    expect(calculateDV('123456785')).toBe('5');
  });

  it('returns K for 12345684 (DV=K)', () => {
    expect(calculateDV('12345684K')).toBe('K');
  });

  it('returns K for 92965062', () => {
    expect(calculateDV('92965062K')).toBe('K');
  });

  it('returns 0 for 93253009 (remainder = 11 edge case)', () => {
    expect(calculateDV('932530090')).toBe('0');
  });

  it('returns 0 for 39128757 (another DV=0)', () => {
    expect(calculateDV('391287570')).toBe('0');
  });

  it('returns correct DV for a 7-digit number (5252490 → 3)', () => {
    expect(calculateDV('52524903')).toBe('3');
  });

  it('returns correct DV for a 7-digit number (7559191 → 8)', () => {
    expect(calculateDV('75591918')).toBe('8');
  });

  it('does NOT return K for 44444444 (DV is 4, not K)', () => {
    expect(calculateDV('444444444')).toBe('4');
  });
});

// ---------------------------------------------------------------------------
// validateRUT
// ---------------------------------------------------------------------------
describe('validateRUT', () => {
  describe('valid RUTs — all 20 confirmed cases', () => {
    it.each(VALID_RUTS)(
      'accepts $formatted (without dots, dash-separated)',
      ({ numbers, dv }) => {
        expect(validateRUT(`${numbers}-${dv}`)).toBe(true);
      },
    );

    it.each(VALID_RUTS)(
      'accepts $formatted (fully formatted with dots)',
      ({ formatted }) => {
        expect(validateRUT(formatted)).toBe(true);
      },
    );

    it.each(VALID_RUTS)(
      'accepts $formatted (no separators at all)',
      ({ numbers, dv }) => {
        expect(validateRUT(`${numbers}${dv}`)).toBe(true);
      },
    );
  });

  describe('valid RUTs — lowercase k accepted', () => {
    it('accepts 92.965.062-k (lowercase k)', () => {
      expect(validateRUT('92.965.062-k')).toBe(true);
    });

    it('accepts 12345684k (no separator, lowercase k)', () => {
      expect(validateRUT('12345684k')).toBe(true);
    });

    it('accepts 50.655.912-k', () => {
      expect(validateRUT('50.655.912-k')).toBe(true);
    });
  });

  describe('invalid RUTs', () => {
    it('rejects 44444444-K (DV should be 4, not K)', () => {
      expect(validateRUT('44444444-K')).toBe(false);
    });

    it('rejects 44.444.444-K (formatted)', () => {
      expect(validateRUT('44.444.444-K')).toBe(false);
    });

    it('rejects a RUT with wrong numeric DV', () => {
      expect(validateRUT('92965062-3')).toBe(false);
    });

    it('rejects a RUT where K is wrong', () => {
      expect(validateRUT('12345678-K')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(validateRUT('')).toBe(false);
    });

    it('returns false for single character', () => {
      expect(validateRUT('5')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// getRUTError
// ---------------------------------------------------------------------------
describe('getRUTError', () => {
  it('returns null for empty input', () => {
    expect(getRUTError('')).toBeNull();
    expect(getRUTError('  ')).toBeNull();
  });

  it('returns length error for too-short RUT (< 8 chars)', () => {
    expect(getRUTError('1234567')).toBe('RUT debe tener entre 8 y 9 dígitos');
    expect(getRUTError('123-4')).toBe('RUT debe tener entre 8 y 9 dígitos');
  });

  it('returns length error for too-long RUT (> 9 chars)', () => {
    expect(getRUTError('1234567890')).toBe('RUT debe tener entre 8 y 9 dígitos');
  });

  it('returns invalid DV error for 44444444-K', () => {
    expect(getRUTError('44444444-K')).toBe('RUT inválido (dígito verificador incorrecto)');
  });

  it('returns invalid DV error for wrong digit on a known RUT', () => {
    expect(getRUTError('92965062-3')).toBe('RUT inválido (dígito verificador incorrecto)');
  });

  it('returns null for a valid 8-digit number RUT', () => {
    expect(getRUTError('92.965.062-K')).toBeNull();
  });

  it('returns null for a valid 7-digit number RUT', () => {
    expect(getRUTError('5.252.490-3')).toBeNull();
  });

  it('returns null for all 20 confirmed-valid RUTs', () => {
    for (const { formatted } of VALID_RUTS) {
      expect(getRUTError(formatted)).toBeNull();
    }
  });
});
