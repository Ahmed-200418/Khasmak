'use client';

import LoginForm from '@/components/login-form';

export default function Home() {
  // Middleware now handles the redirection logic for authenticated users.
  // This component will only render if the user is not authenticated.
  return <LoginForm />;
}
