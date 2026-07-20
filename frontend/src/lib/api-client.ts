import axios, { AxiosInstance, AxiosResponse } from "axios";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  withCredentials: true, // httpOnly cookie para refresh token
});

// Inyectar access token desde memoria en cada request
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Renovar access token automáticamente con el refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original.url?.includes("/auth/");
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        );
        setAccessToken(data.data.access_token);
        original.headers.Authorization = `Bearer ${data.data.access_token}`;
        return apiClient(original);
      } catch {
        clearAccessToken();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Access token en memoria (no en localStorage)
let _accessToken: string | null = null;

export const getAccessToken = () => _accessToken;
export const setAccessToken = (token: string) => { _accessToken = token; };
export const clearAccessToken = () => { _accessToken = null; };

export default apiClient;
