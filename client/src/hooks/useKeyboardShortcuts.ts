import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface ShortcutHandlers {
  onNewTrip?: () => void;
  onNewExpense?: () => void;
  onSearch?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const admin = isAdmin();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      // Ignore if user is typing in an input/textarea/select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        return;
      }

      // Also ignore if inside a contenteditable
      if ((e.target as HTMLElement).isContentEditable) {
        return;
      }

      // CMD/CTRL + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handlers.onSearch?.();
        return;
      }

      // Don't process single-key shortcuts if modifier keys are held (except the ones above)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // / for search
      if (e.key === '/') {
        e.preventDefault();
        handlers.onSearch?.();
      }
      // N for new trip
      else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handlers.onNewTrip?.();
      }
      // E for new expense
      else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handlers.onNewExpense?.();
      }
      // Number keys for navigation (role-aware)
      else if (e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        if (admin) {
          const adminRoutes = ['/', '/trips', '/expenses', '/reports', '/payments', '/trucks', '/users'];
          const idx = parseInt(e.key) - 1;
          if (idx < adminRoutes.length) navigate(adminRoutes[idx]);
        } else {
          const empRoutes = ['/trips', '/expenses'];
          const idx = parseInt(e.key) - 1;
          if (idx < empRoutes.length) navigate(empRoutes[idx]);
        }
      }
    },
    [navigate, handlers, admin]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
