import axios from 'axios';

// 1. Get Gateway URL from Environment (Render) OR Fallback to Localhost
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5000';

// 2. Create Axios Instance
const api = axios.create({
  baseURL: `${GATEWAY_URL}/hotel`, 
});

export const hotelService = {
  // --- AUTH HELPER ---
  setToken: (token, username) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.defaults.headers.common['x-user-id'] = username || 'guest_user';
    } else {
      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['x-user-id'];
    }
  },

  // --- USER FUNCTIONS ---

  // 1. Search Hotels
  search: (location) => api.get(`/search?location=${location}`),

  // 2. ML Price Prediction
  predictPrice: (basePrice, date, roomType) => api.post('/predict', { 
    basePrice, date, roomType 
  }),

  // 3. Get My Booking History
  getMyBookings: () => api.get('/bookings/user'),

  // 4. Make a Reservation
  book: (bookingData) => api.post('/book', bookingData),
  
  // 5. User Login (Handled by Firebase usually, but if you have a custom route)
  login: () => axios.get(`${GATEWAY_URL}/login`)
};

export default api;