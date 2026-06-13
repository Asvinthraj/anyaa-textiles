import axios from 'axios';

const API_URL = 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
});

export const getProducts = () => api.get('/products');
export const addProduct = (product) => api.post('/products', product);
export const updateProduct = (id, product) => api.put(`/products/${id}`, product);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

export const getCustomers = () => api.get('/customers');
export const addCustomer = (customer) => api.post('/customers', customer);
export const updateCustomer = (id, customer) => api.put(`/customers/${id}`, customer);

export const getBills = () => api.get('/bills');
export const addBill = (bill) => api.post('/bills', bill);
export const updateBill = (id, bill) => api.put(`/bills/${id}`, bill);
export const deleteBill = (id) => api.delete(`/bills/${id}`);

export const getDashboardStats = () => api.get('/dashboardStats');
export const getUsers = () => api.get('/users');

export const getReturns = () => api.get('/returns');
export const addReturn = (req) => api.post('/returns', req);
export const updateReturn = (id, req) => api.put(`/returns/${id}`, req);
export const deleteReturn = (id) => api.delete(`/returns/${id}`);

// Mock login API since json-server doesn't do real auth
export const login = async (email, password) => {
  const response = await api.get(`/users?email=${email}&password=${password}`);
  if (response.data.length > 0) {
    return response.data[0];
  }
  throw new Error('Invalid credentials');
};

export const uploadInvoiceFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

