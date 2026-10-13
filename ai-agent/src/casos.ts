export const CASOS_DE_TESTE = [
  {
    id: 'CT-01',
    titulo: 'Emergência elétrica com chamados similares próximos',
    prompt:
      'Tem um poste com fiação exposta soltando faísca na Av. Boa Viagem, bem em frente ao meu prédio. ' +
      'Minha localização é latitude -8.1197 e longitude -34.8986.',
  },
  {
    id: 'CT-02',
    titulo: 'Esgoto em via (Crítica) roteado para a COMPESA',
    prompt: 'Há esgoto em via pública correndo pela Rua da Aurora há dois dias. Coordenadas: -8.0597, -34.8811.',
  },
  {
    id: 'CT-03',
    titulo: 'Buraco comum (Alta) sem chamados similares',
    prompt: 'Apareceu um buraco grande no asfalto da rua aqui na Madalena. Estou em -8.0545, -34.9105.',
  },
] as const;
