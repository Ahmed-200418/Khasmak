import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define interfaces for our state
export interface Deduction {
  id: string;
  contractName: string;
  personName: string;
  itemName: string;
  meterEquivalentValue: number | '';
  meterEquivalentUnit: string;
  workDescription: string;
  quantity: number | '';
  unitPrice: number | '';
}

export interface Contractor {
  id: string;
  contractorName: string;
  notes: string;
  deductions: Deduction[];
}

export type Company = "DMC" | "CURVE";

// Define the state structure
interface DeductionsState {
  company: Company | null;
  contractors: Contractor[];
  setCompany: (company: Company) => void;
  addContractor: () => void;
  removeContractor: (contractorId: string) => void;
  updateContractorName: (contractorId: string, name: string) => void;
  updateContractorNotes: (contractorId: string, notes: string) => void;
  addDeduction: (contractorId: string) => void;
  removeDeduction: (contractorId: string, deductionId: string) => void;
  updateDeduction: (contractorId: string, deductionId: string, field: keyof Omit<Deduction, 'id'>, value: string | number) => void;
  reset: () => void;
}

const initialDeduction: Omit<Deduction, 'id'> = {
  contractName: '',
  personName: '',
  itemName: '',
  meterEquivalentValue: '',
  meterEquivalentUnit: 'متر مسطح',
  workDescription: '',
  quantity: '',
  unitPrice: '',
};

const initialContractor: Omit<Contractor, 'id' | 'deductions'> = {
  contractorName: '',
  notes: '',
};

let contractorCounter = 0;
const generateContractorId = () => `contractor-${Date.now()}-${contractorCounter++}`;

let deductionCounter = 0;
const generateDeductionId = () => `deduction-${Date.now()}-${deductionCounter++}`;


export const useDeductionsStore = create<DeductionsState>()(
  persist(
    (set) => ({
      company: null,
      contractors: [],
      setCompany: (company) => set({ company }),
      addContractor: () => {
        set((state) => ({
          contractors: [
            ...state.contractors,
            {
              ...initialContractor,
              id: generateContractorId(),
              deductions: [{ ...initialDeduction, id: generateDeductionId() }],
            },
          ],
        }));
      },
      removeContractor: (contractorId) => {
        set((state) => ({
          contractors: state.contractors.filter((c) => c.id !== contractorId),
        }));
      },
      updateContractorName: (contractorId, name) => {
        set((state) => ({
          contractors: state.contractors.map((c) =>
            c.id === contractorId ? { ...c, contractorName: name } : c
          ),
        }));
      },
      updateContractorNotes: (contractorId, notes) => {
        set((state) => ({
          contractors: state.contractors.map((c) =>
            c.id === contractorId ? { ...c, notes } : c
          ),
        }));
      },
      addDeduction: (contractorId) => {
        set((state) => ({
          contractors: state.contractors.map((c) =>
            c.id === contractorId
              ? {
                  ...c,
                  deductions: [...c.deductions, { ...initialDeduction, id: generateDeductionId() }],
                }
              : c
          ),
        }));
      },
      removeDeduction: (contractorId, deductionId) => {
        set((state) => ({
          contractors: state.contractors.map((c) =>
            c.id === contractorId
              ? { ...c, deductions: c.deductions.filter((d) => d.id !== deductionId) }
              : c
          ),
        }));
      },
      updateDeduction: (contractorId, deductionId, field, value) => {
        set((state) => ({
          contractors: state.contractors.map((c) =>
            c.id === contractorId
              ? {
                  ...c,
                  deductions: c.deductions.map((d) =>
                    d.id === deductionId ? { ...d, [field]: value } : d
                  ),
                }
              : c
          ),
        }));
      },
      reset: () => {
        set({ contractors: [], company: null });
      },
    }),
    {
      name: 'deductions-storage',
    }
  )
);
