import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Modal from './Modal';
import { useAppStore, type TripRow } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ClipboardCopy } from 'lucide-react';

interface TripModalProps {
  open: boolean;
  onClose: () => void;
  editRow?: TripRow | null;
  duplicateFrom?: TripRow | null;
}

const STATUS_OPTIONS = [
  { value: 'Working Day', label: '🟢 Working Day' },
  { value: 'Day Off', label: '⚪ Day Off' },
  { value: 'Holiday', label: '🟡 Holiday' },
];

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: '44px',
    borderRadius: '14px',
    borderColor: state.isFocused ? '#60a5fa' : '#e2e8f0',
    backgroundColor: 'white',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    '&:hover': { borderColor: '#93c5fd' },
    cursor: 'pointer',
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(15,23,42,0.12)',
    border: '1px solid #e2e8f0',
    zIndex: 100,
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
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#eff6ff' : 'transparent',
    color: state.isSelected ? 'white' : '#334155',
    cursor: 'pointer',
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    color: '#0f172a',
    fontWeight: 500,
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: '#94a3b8',
  }),
};

const selectStylesDark = {
  ...selectStyles,
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: '44px',
    borderRadius: '14px',
    borderColor: state.isFocused ? '#3b82f6' : '#334155',
    backgroundColor: '#0f172a',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    '&:hover': { borderColor: '#3b82f6' },
    cursor: 'pointer',
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    zIndex: 100,
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
    backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#1e293b' : 'transparent',
    color: state.isSelected ? 'white' : '#e2e8f0',
    cursor: 'pointer',
  }),
  singleValue: (base: Record<string, unknown>) => ({
    ...base,
    color: '#e2e8f0',
    fontWeight: 500,
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base: Record<string, unknown>) => ({
    ...base,
    color: '#64748b',
  }),
  input: (base: Record<string, unknown>) => ({
    ...base,
    color: '#e2e8f0',
  }),
};

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TripModal({ open, onClose, editRow, duplicateFrom }: TripModalProps) {
  const { selectedTruck, truckOptions, addTrip, updateTrip, getLastTrip, theme } = useAppStore();
  const { isAdmin } = useAuthStore();
  const admin = isAdmin();
  const isDark = theme === 'dark';
  const styles = isDark ? selectStylesDark : selectStyles;

  const [loading, setLoading] = useState(false);
  const [copyingLast, setCopyingLast] = useState(false);
  const [form, setForm] = useState({
    date: new Date(),
    status: 'Working Day',
    shipmentNumber: '',
    rate: '',
    trips: '',
    crewSalary: '',
    cashAdvance: '',
    reimbursements: '',
    note: '',
  });

  const prefillFromTrip = (src: TripRow, useToday = true) => {
    setForm({
      date: useToday ? new Date() : (src.dateIso ? new Date(src.dateIso + 'T00:00:00') : new Date()),
      status: src.status || 'Working Day',
      shipmentNumber: src.shipmentNumber || '',
      rate: String(src.rate || ''),
      trips: String(src.trips || ''),
      crewSalary: String(src.crewSalary || ''),
      cashAdvance: String(src.cashAdvance || ''),
      reimbursements: String(src.reimbursements || ''),
      note: src.note || '',
    });
  };

  useEffect(() => {
    if (editRow) {
      prefillFromTrip(editRow, false);
    } else if (duplicateFrom) {
      prefillFromTrip(duplicateFrom, true);
    } else {
      setForm({
        date: new Date(),
        status: 'Working Day',
        shipmentNumber: '',
        rate: '',
        trips: '',
        crewSalary: '',
        cashAdvance: '',
        reimbursements: '',
        note: '',
      });
    }
  }, [editRow, duplicateFrom, open]);

  const handleCopyFromLast = async () => {
    if (!selectedTruck) {
      toast.error('Please select a truck first!', { duration: 6000 });
      return;
    }
    setCopyingLast(true);
    try {
      const lastTrip = await getLastTrip(selectedTruck);
      if (lastTrip) {
        prefillFromTrip(lastTrip, true);
        toast.success('Copied from last trip!', { duration: 3000 });
      } else {
        toast.info('No previous trips found for this truck.', { duration: 4000 });
      }
    } catch {
      toast.error('Failed to fetch last trip.', { duration: 5000 });
    } finally {
      setCopyingLast(false);
    }
  };

  const handleRateChange = (val: string) => {
    setForm((f) => {
      const updated = { ...f, rate: val };
      if (f.status === 'Working Day' && val) {
        if (!f.trips || f.trips === '0') updated.trips = '1';
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!selectedTruck) {
      toast.error('Please select a truck first!', { duration: 6000 });
      return;
    }

    if (!admin) {
      if (!form.shipmentNumber.trim()) {
        toast.error('Shipment Number is required.', { duration: 6000 });
        return;
      }
    } else {
      if (form.status === 'Working Day' && !form.rate) {
        toast.error('Rate is required for Working Day.', { duration: 6000 });
        return;
      }
      if (form.status === 'Working Day' && !form.crewSalary) {
        toast.error('Crew Salary is required for Working Day.', { duration: 6000 });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        truckId: selectedTruck,
        date: toLocalDateString(form.date),
        status: form.status,
        shipmentNumber: form.shipmentNumber,
        rate: admin ? Number(form.rate) || 0 : 0,
        trips: admin ? Number(form.trips) || 0 : 0,
        crewSalary: admin ? Number(form.crewSalary) || 0 : 0,
        cashAdvance: admin ? Number(form.cashAdvance) || 0 : 0,
        reimbursements: admin ? Number(form.reimbursements) || 0 : 0,
        note: form.note,
      };

      if (editRow) {
        await updateTrip(editRow._id, payload);
      } else {
        await addTrip(payload);
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save trip', { duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  const selectedTruckName = truckOptions.find((t) => t._id === selectedTruck)?.truckName || 'Selected Truck';
  const inputClass =
    'w-full min-h-[44px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors';

  const modalTitle = editRow
    ? `Edit Trip - ${selectedTruckName} - ${editRow.dateText}`
    : duplicateFrom
      ? `Duplicate Trip for ${selectedTruckName}`
      : `Add Trip for ${selectedTruckName}`;

  const readOnlyForDriver = !admin;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      wide
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-[0_10px_20px_rgba(37,99,235,0.18)] hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all"
          >
            {loading ? 'Saving...' : editRow ? 'Update' : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Date</label>
          <DatePicker
            selected={form.date}
            onChange={(d: Date | null) => setForm({ ...form, date: d || new Date() })}
            dateFormat="MMM d, yyyy"
            className={inputClass + ' cursor-pointer'}
            wrapperClassName="w-full"
            showPopperArrow={false}
          />
          {!editRow && (
            <button
              type="button"
              onClick={handleCopyFromLast}
              disabled={copyingLast}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors disabled:opacity-50"
            >
              <ClipboardCopy size={14} />
              {copyingLast ? 'Loading...' : 'Copy from Last Trip'}
            </button>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Status</label>
          <Select
            options={STATUS_OPTIONS}
            value={STATUS_OPTIONS.find((o) => o.value === form.status)}
            onChange={(opt) => {
              if (opt) setForm({ ...form, status: opt.value });
            }}
            styles={{ ...styles, menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }) }}
            isSearchable={false}
            menuPortalTarget={document.body}
            classNamePrefix="nm-select"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Shipment Number</label>
          <input
            type="text"
            value={form.shipmentNumber}
            onChange={(e) => setForm({ ...form, shipmentNumber: e.target.value })}
            placeholder="e.g. SHP-0410-123"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
            Rate (₱){!readOnlyForDriver && form.status === 'Working Day' && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            type="number"
            value={form.rate}
            onChange={(e) => handleRateChange(e.target.value)}
            placeholder="0"
            disabled={readOnlyForDriver}
            className={inputClass + (readOnlyForDriver ? ' opacity-60 cursor-not-allowed' : '')}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Number of Trips</label>
          <input
            type="number"
            value={form.trips}
            onChange={(e) => setForm({ ...form, trips: e.target.value })}
            placeholder="1"
            disabled={readOnlyForDriver}
            className={inputClass + (readOnlyForDriver ? ' opacity-60 cursor-not-allowed' : '')}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
            Crew Salary (₱){!readOnlyForDriver && form.status === 'Working Day' && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <input
            type="number"
            value={form.crewSalary}
            onChange={(e) => setForm({ ...form, crewSalary: e.target.value })}
            placeholder="0"
            disabled={readOnlyForDriver}
            className={inputClass + (readOnlyForDriver ? ' opacity-60 cursor-not-allowed' : '')}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Cash Advance (₱)</label>
          <input
            type="number"
            value={form.cashAdvance}
            onChange={(e) => setForm({ ...form, cashAdvance: e.target.value })}
            placeholder="0"
            disabled={readOnlyForDriver}
            className={inputClass + (readOnlyForDriver ? ' opacity-60 cursor-not-allowed' : '')}
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Reimbursements (₱)</label>
          <input
            type="number"
            value={form.reimbursements}
            onChange={(e) => setForm({ ...form, reimbursements: e.target.value })}
            placeholder="0"
            disabled={readOnlyForDriver}
            className={inputClass + (readOnlyForDriver ? ' opacity-60 cursor-not-allowed' : '')}
          />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">Note</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputClass + ' min-h-[80px] py-2.5 resize-none'}
            rows={3}
            placeholder="Add notes..."
          />
        </div>
      </div>
    </Modal>
  );
}
