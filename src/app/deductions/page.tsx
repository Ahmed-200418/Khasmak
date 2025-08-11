import DeductionForm from '@/components/deduction-form';

export const metadata = {
  title: 'تقرير جديد | نموذج الذاتي والمقطوعية',
}

export default function DeductionsPage() {
  return (
    <main>
      <DeductionForm />
    </main>
  );
}
