import { parseSpokenDate, cleanSpokenRut, parseCommandTranscript, fuzzyMatchOption } from '../speechParsers';

describe('parseSpokenDate', () => {
  test('returns ISO when already ISO', () => {
    expect(parseSpokenDate('1980-03-12')).toBe('1980-03-12');
    expect(parseSpokenDate('1980-3-2')).toBe('1980-03-02');
  });

  test('parses dd/mm/yyyy', () => {
    expect(parseSpokenDate('12/03/1980')).toBe('1980-03-12');
    expect(parseSpokenDate('1-1-2024')).toBe('2024-01-01');
    expect(parseSpokenDate('1.1.99')).toBe('1999-01-01');
  });

  test('parses spoken Spanish date', () => {
    expect(parseSpokenDate('12 de marzo de 1980')).toBe('1980-03-12');
    expect(parseSpokenDate('1 de enero de 2024')).toBe('2024-01-01');
  });

  test('parses spoken English date', () => {
    expect(parseSpokenDate('march 12 1980')).toBe('1980-03-12');
    expect(parseSpokenDate('12 of march 1980')).toBe('1980-03-12');
  });

  test('returns trimmed input when not parseable', () => {
    expect(parseSpokenDate('  hello world  ')).toBe('hello world');
  });
});

describe('cleanSpokenRut', () => {
  test('replaces spoken hyphen words', () => {
    expect(cleanSpokenRut('12345678 guion 9')).toBe('12345678-9');
    expect(cleanSpokenRut('12345678 guión 9')).toBe('12345678-9');
    expect(cleanSpokenRut('12345678 dash K')).toBe('12345678-K');
  });

  test('strips dots and spaces', () => {
    expect(cleanSpokenRut('12.345.678-9')).toBe('12345678-9');
  });

  test('uppercases trailing K', () => {
    expect(cleanSpokenRut('12345678-k')).toBe('12345678-K');
  });
});

describe('parseCommandTranscript', () => {
  const vocab = {
    firstName: ['nombre', 'primer nombre'],
    lastName: ['apellido', 'apellidos'],
    sex: ['sexo'],
    episodeType: ['tipo', 'tipo de episodio'],
    birthDate: ['fecha de nacimiento', 'nacimiento'],
  };

  test('splits multi-field utterance in order', () => {
    const segs = parseCommandTranscript(
      'nombre Juan apellidos Pérez sexo masculino tipo urgencia',
      vocab,
    );
    expect(segs).toEqual([
      { field: 'firstName', value: 'juan' },
      { field: 'lastName', value: 'perez' },
      { field: 'sex', value: 'masculino' },
      { field: 'episodeType', value: 'urgencia' },
    ]);
  });

  test('prefers longer alias over shorter substring', () => {
    const segs = parseCommandTranscript('fecha de nacimiento 12 de marzo de 1980', vocab);
    expect(segs).toEqual([{ field: 'birthDate', value: '12 de marzo de 1980' }]);
  });

  test('uses defaultField for leading text before any keyword', () => {
    const segs = parseCommandTranscript('Juan Pablo apellidos Pedro', vocab, 'firstName');
    expect(segs).toEqual([
      { field: 'firstName', value: 'juan pablo' },
      { field: 'lastName', value: 'pedro' },
    ]);
  });

  test('keyword without value emits empty value (focus switch)', () => {
    const segs = parseCommandTranscript('nombre', vocab);
    expect(segs).toEqual([{ field: 'firstName', value: '' }]);
  });

  test('returns empty array when nothing matches and no default', () => {
    expect(parseCommandTranscript('hola mundo', vocab)).toEqual([]);
  });

  test('self-switch is folded into value (e.g. "habitación box 3")', () => {
    const roomVocab = {
      firstName: ['nombre'],
      roomBox: ['habitacion', 'box'],
    };
    const segs = parseCommandTranscript('nombre Juan habitacion box 3', roomVocab);
    expect(segs).toEqual([
      { field: 'firstName', value: 'juan' },
      { field: 'roomBox', value: 'box 3' },
    ]);
  });

  test('same-alias re-trigger while already active is folded into value', () => {
    const roomVocab = { roomBox: ['habitacion', 'box'] };
    // active=roomBox, says "box 3" → stays in roomBox with full text as value
    const segs = parseCommandTranscript('box 3', roomVocab, 'roomBox');
    expect(segs).toEqual([{ field: 'roomBox', value: 'box 3' }]);
  });

  test('next alias advances to next field in declared order', () => {
    const segs = parseCommandTranscript(
      'nombre Juan siguiente Pérez siguiente masculino',
      vocab,
      null,
      { nextAliases: ['siguiente'], fieldOrder: ['firstName', 'lastName', 'sex', 'episodeType', 'birthDate'] },
    );
    expect(segs).toEqual([
      { field: 'firstName', value: 'juan' },
      { field: 'lastName', value: 'perez' },
      { field: 'sex', value: 'masculino' },
    ]);
  });

  test('next without an active field is dropped', () => {
    const segs = parseCommandTranscript('siguiente Juan', vocab, null, {
      nextAliases: ['siguiente'],
      fieldOrder: ['firstName', 'lastName'],
    });
    expect(segs).toEqual([]);
  });
});

describe('fuzzyMatchOption', () => {
  test('matches exact string in option list', () => {
    expect(fuzzyMatchOption('Urgencias', ['Urgencias', 'Hospitalización'])).toBe('Urgencias');
  });

  test('matches case- and accent-insensitive substring', () => {
    expect(fuzzyMatchOption('hospitalizacion', ['Urgencias', 'Hospitalización'])).toBe('Hospitalización');
  });

  test('matches alias map (e.g. sex codes)', () => {
    const aliases = { M: ['masculino', 'hombre'], F: ['femenino', 'mujer'] };
    expect(fuzzyMatchOption('hombre', aliases)).toBe('M');
    expect(fuzzyMatchOption('Mujer', aliases)).toBe('F');
  });

  test('returns null when nothing matches', () => {
    expect(fuzzyMatchOption('xyz', ['Urgencias', 'UCI'])).toBeNull();
  });
});
