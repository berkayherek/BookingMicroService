import axios from 'axios';

// Connects to Gateway (Vite Proxy handles /api -> http://gateway:3000)
const api = axios.create({
  baseURL: '/api/hotel', 
});

export const hotelService = {
  // Helper to set Token
  setToken: (token, username) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // We simulate a user ID based on the username for the exam
      api.defaults.headers.common['x-user-id'] = username || 'guest_user';
    } else {
      delete api.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['x-user-id'];
    }
  },

  search: (location) => api.get(`/search?location=${location}`),
  
  predictPrice: (basePrice, date, roomType) => api.post('/predict', { 
    basePrice, date, roomType 
  }),
  
  // NEW: Fetch User History
  getMyBookings: () => api.get('/bookings/user'),

  // UPDATED: Include roomType and calculated price
  book: (bookingData) => api.post('/book', bookingData)
};