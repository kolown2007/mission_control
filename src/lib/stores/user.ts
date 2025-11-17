import { writable } from 'svelte/store';

// Initialize from server-injected pageData when available for instant UI
const initial = (typeof window !== 'undefined' && (window as any).pageData?.user)
  ? (window as any).pageData.user
  : null;

export const user = writable<{ id: string | number; name?: string | null; email?: string | null } | null>(initial);
export const ssoPresent = writable<boolean>(typeof window !== 'undefined' && !!(window as any).pageData?.ssoPresent);
