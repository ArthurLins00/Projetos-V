import { api } from './api';

export const demandService = {
  async listarDemandas() {
    const response = await api.get('/demands'); // Rota em inglês, conforme Swagger
    return response.data;
  },

  // Enviando exatamente os campos que a documentação exige
  async criarDemanda(dados: { title: string; description: string; category_id: number; location: string; latitude: number; longitude: number }) {
    const response = await api.post('/demands', dados);
    return response.data;
  }
};