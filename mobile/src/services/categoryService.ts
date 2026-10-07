import { api } from './api';
import { Category } from '../models/Category';

export const categoryService = {
  async list(): Promise<Category[]> {
    const response = await api.get<Category[]>('/categories');
    return response.data;
  }
};
