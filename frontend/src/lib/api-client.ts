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

// Mutex para evitar múltiples refreshes simultáneos
let _refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = axios
    .post(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
      {},
      { withCredentials: true }
    )
    .then((res) => {
      const token = res.data.data.access_token;
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

// Renovar access token automáticamente con el refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original.url?.includes("/auth/");
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        const token = await refreshToken();
        original.headers.Authorization = `Bearer ${token}`;
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
