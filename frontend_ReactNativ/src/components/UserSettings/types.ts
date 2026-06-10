export interface FiltrosState {
  user: string;
  Tipo: string;
  Hospital: string;
  Local: string;
  Profesional: string;
}

export function parseFiltros(raw: string | null | undefined): FiltrosState {
  const d: FiltrosState = { user: '', Tipo: '', Hospital: '', Local: '', Profesional: '' };
  if (!raw) return d;
  for (const part of raw.split('&')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim() as keyof FiltrosState;
    const v = part.slice(idx + 1).trim();
    if (k in d) d[k] = v;
  }
  return d;
}

export function serializeFiltros(f: FiltrosState): string {
  return [
    f.user.trim() && `user=${f.user.trim()}`,
    f.Tipo.trim() && `Tipo=${f.Tipo.trim()}`,
    f.Hospital.trim() && `Hospital=${f.Hospital.trim()}`,
    f.Local.trim() && `Local=${f.Local.trim()}`,
    f.Profesional.trim() && `Profesional=${f.Profesional.trim()}`,
  ].filter(Boolean).join('&');
}
