import AdminDashboard from '@/components/admin-dashboard';

export const metadata = {
  title: 'لوحة تحكم المدير',
}

export default function AdminPage() {
  return (
    <main>
      <AdminDashboard />
    </main>
  );
}
