import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  withCredentials: true, // Send HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Response interceptor: normalize error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error?.response?.data?.detail

    let message
    if (Array.isArray(detail)) {
      // FastAPI / Pydantic validation errors: detail is an array of { msg, loc, ... }
      message = detail.map((e) => e.msg || String(e)).join('. ')
    } else if (typeof detail === 'string') {
      message = detail
    } else {
      message =
        error?.response?.data?.message ||
        error?.message ||
        'An unexpected error occurred'
    }

    return Promise.reject(new Error(message))
  }
)

export default api
