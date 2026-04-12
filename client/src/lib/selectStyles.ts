// Centralized react-select theme styles for light and dark mode

export const getSelectStyles = (isDark: boolean) => ({
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: '44px',
    borderRadius: '14px',
    borderColor: state.isFocused ? (isDark ? '#3b82f6' : '#60a5fa') : (isDark ? '#334155' : '#e2e8f0'),
    backgroundColor: isDark ? '#0f172a' : 'white',
    boxShadow: state.isFocused ? (isDark ? '0 0 0 3px rgba(59,130,246,0.15)' : '0 0 0 3px rgba(37,99,235,0.1)') : 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    '&:hover': { borderColor: isDark ? '#3b82f6' : '#93c5fd' },
    cursor: 'pointer',
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.3)' : '0 12px 40px rgba(15,23,42,0.12)',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#0f172a' : 'white',
    zIndex: 50,
  }),
  menuList: (base: Record<string, unknown>) => ({
    ...base,
    padding: '4px',
  }),
  option: (base: Record<string, unknown>, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '0.875rem',
    fontWeight: state.isSelected ? 600 : 400,
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? (isDark ? '#1e293b' : '#eff6ff') : 'transparent',
    color: state.isSelected ? 'white' : (isDark ? '#e2e8f0' : '#334155'),
    cursor: 'pointer',
    '&:active': { backgroundColor: state.isSelected ? '#2563eb' : (isDark ? '#1e293b' : '#dbeafe') },
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    color: isDark ? '#e2e8f0' : '#0f172a',
    fontWeight: 500,
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: isDark ? '#64748b' : '#94a3b8',
    '&:hover': { color: isDark ? '#94a3b8' : '#64748b' },
  }),
  placeholder: (base: Record<string, unknown>) => ({
    ...base,
    color: isDark ? '#64748b' : '#94a3b8',
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    color: isDark ? '#e2e8f0' : '#0f172a',
  }),
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }),
});

export const getMiniSelectStyles = (isDark: boolean) => ({
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: '36px',
    height: '36px',
    borderRadius: '12px',
    borderColor: state.isFocused ? (isDark ? '#3b82f6' : '#60a5fa') : (isDark ? '#334155' : '#e2e8f0'),
    backgroundColor: isDark ? '#0f172a' : 'white',
    boxShadow: state.isFocused ? (isDark ? '0 0 0 2px rgba(59,130,246,0.15)' : '0 0 0 2px rgba(37,99,235,0.1)') : 'none',
    fontSize: '0.8rem',
    fontWeight: 500,
    '&:hover': { borderColor: isDark ? '#3b82f6' : '#93c5fd' },
    cursor: 'pointer',
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.25)' : '0 8px 24px rgba(15,23,42,0.1)',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#0f172a' : 'white',
    zIndex: 50,
    minWidth: '120px',
  }),
  menuList: (base: Record<string, unknown>) => ({ ...base, padding: '3px' }),
  option: (base: Record<string, unknown>, state: { isSelected: boolean; isFocused: boolean }) => ({
    ...base,
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '0.8rem',
    fontWeight: state.isSelected ? 600 : 400,
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? (isDark ? '#1e293b' : '#eff6ff') : 'transparent',
    color: state.isSelected ? 'white' : (isDark ? '#e2e8f0' : '#334155'),
    cursor: 'pointer',
  }),
  singleValue: (base: Record<string, unknown>) => ({ 
    ...base, 
    color: isDark ? '#e2e8f0' : '#334155', 
    fontWeight: 500, 
    fontSize: '0.8rem' 
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base: Record<string, unknown>) => ({ 
    ...base, 
    color: isDark ? '#64748b' : '#94a3b8', 
    padding: '0 6px' 
  }),
  valueContainer: (base: Record<string, unknown>) => ({ ...base, padding: '0 8px' }),
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }),
});
