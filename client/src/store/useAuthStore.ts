import { create } from 'zustand';
import api from '../api/client';
import { useAppStore } from './useAppStore';

export interface AuthUser {
  _id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'employee';
  truck?: string | { _id: string; truckName: string };
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  isAdmin: () => boolean;
  isEmployee: () => boolean;
}

const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem('nm_token');
  } catch {
    return null;
  }
};

const getStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem('nm_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  loading: false,
  initialized: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login', { username, password });
      const { token, user } = data;

      localStorage.setItem('nm_token', token);
      localStorage.setItem('nm_user', JSON.stringify(user));

      set({ user, token, loading: false });
    } catch (err: unknown) {
      set({ loading: false });
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      throw new Error(
        axiosErr?.response?.data?.error || axiosErr?.message || 'Login failed'
      );
    }
  },

  logout: () => {
    localStorage.removeItem('nm_token');
    localStorage.removeItem('nm_user');
    set({ user: null, token: null, initialized: true });
    // Reset app store so it re-fetches on next login
    useAppStore.setState({
      initialized: false,
      tripRows: [],
      rawTripRows: [],
      expenseRows: [],
      reportRows: [],
      rawReportRows: [],
      chartData: [],
      kpis: { gross: 0, net: 0, trips: 0, payable: 0, cashOutflow: 0, expenses: 0 },
      previousKpis: { gross: 0, net: 0, trips: 0, payable: 0, cashOutflow: 0, expenses: 0 },
      selectedTruck: '',
      selectedTripIds: [],
      rangePreset: 'CC',
      startDate: '',
      endDate: '',
      expensesMonth: 'ALL',
      reportsMonth: 'ALL',
      searchQuery: '',
    });
  },

  checkAuth: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ user: null, token: null, initialized: true });
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      const user = data.user;
      localStorage.setItem('nm_user', JSON.stringify(user));
      set({ user, token, initialized: true });
    } catch {
      // Token invalid/expired
      localStorage.removeItem('nm_token');
      localStorage.removeItem('nm_user');
      set({ user: null, token: null, initialized: true });
    }
  },

  isAdmin: () => get().user?.role === 'admin',
  isEmployee: () => get().user?.role === 'employee',
}));
