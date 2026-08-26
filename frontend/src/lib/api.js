import axios from "axios";

// The platform injects REACT_APP_BACKEND_URL; fall back to same-origin.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

const TOKEN_KEY = "sh_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// The device token is a long-lived identity granted when the owner first logs
// in on a tablet. It stays put across shift changes so cashier/prep sessions
// can be swapped in by PIN without the owner logging in again.
const DEVICE_TOKEN_KEY = "sh_device_token";
export const getDeviceToken = () => localStorage.getItem(DEVICE_TOKEN_KEY);
export const setDeviceToken = (t) => localStorage.setItem(DEVICE_TOKEN_KEY, t);
export const clearDeviceToken = () => localStorage.removeItem(DEVICE_TOKEN_KEY);

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    if (status === 401 && !url.includes("/auth/login")) {
      clearToken();
      window.dispatchEvent(new Event("sh:unauthorized"));
    }
    return Promise.reject(error);
  }
);

// PIN login uses the DEVICE token for authorization (the active identity,
// sh_token, may be empty at this moment). We bypass the shared `api` instance
// and its interceptor so we can attach the device token explicitly for this
// one call, then the returned session token becomes the active identity.
export const loginWithPin = async (pin) => {
  const deviceToken = getDeviceToken();
  const { data } = await axios.post(
    `${BACKEND_URL}/api/auth/login-pin`,
    { pin },
    { headers: deviceToken ? { Authorization: `Bearer ${deviceToken}` } : {} }
  );
  setToken(data.token);
  return data.user;
};

export default api;
