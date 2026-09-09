import { KitData, KitRecord, JobProgress, User } from '../types';

const rawBase = import.meta.env.VITE_API_URL?.trim();
const API_BASE = rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('prepkit_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Authentication
  async register(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch user session');
    return data.user;
  },

  // Kit Generation & Polling
  async generateKit(payload: {
    jd: string;
    company_url: string;
    days: number;
    company_name?: string;
    api_key?: string;
  }): Promise<{ jobId: string }> {
    const headers = getAuthHeaders() as Record<string, string>;
    if (payload.api_key) {
      headers['x-gemini-api-key'] = payload.api_key;
    }
    const res = await fetch(`${API_BASE}/kits/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start kit generation');
    return data;
  },

  async getJobStatus(jobId: string): Promise<JobProgress> {
    const res = await fetch(`${API_BASE}/kits/jobs/${jobId}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to check generation status');
    return data.job;
  },

  // Kit CRUD
  async getUserKits(): Promise<KitRecord[]> {
    const res = await fetch(`${API_BASE}/kits`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch kits');
    return data.kits;
  },

  async getKitById(id: string): Promise<KitRecord> {
    const res = await fetch(`${API_BASE}/kits/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch kit');
    return data.kit;
  },

  async updateKit(id: string, data: KitData): Promise<KitRecord> {
    const res = await fetch(`${API_BASE}/kits/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ data }),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Failed to save kit updates');
    return resData.kit;
  },

  async deleteKit(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/kits/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete kit');
  },

  async regenerateSection(
    id: string,
    section: 'company_brief' | 'category' | 'schedule',
    targetCategory?: string
  ): Promise<KitRecord> {
    const res = await fetch(`${API_BASE}/kits/${id}/regenerate-section`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ section, targetCategory }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to regenerate section');
    return data.kit;
  },
};
