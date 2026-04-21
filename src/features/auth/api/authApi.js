import { http } from '../../../shared/services/http';

export const loginAdmin = async (payload) => {
  const response = await http.post('/auth/login', payload);
  return response.data;
};

