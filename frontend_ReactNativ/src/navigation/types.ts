export type RootStackParamList = {
  ServerDiscovery: { skipAutoConnect?: boolean } | undefined;
  Login: undefined;
  Episodes: undefined;
  NewEpisode: undefined;
  ClinicalNote: { id: number };
};
