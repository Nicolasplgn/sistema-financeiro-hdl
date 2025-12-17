import axios from 'axios';
import { API_ENDPOINT } from '../config';

const api = axios.create({
  baseURL: API_ENDPOINT,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;