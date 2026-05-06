'use client'

import { useRouter } from 'next/navigation'
import Login from '@/src/components/Login'

export default function LoginPage() {
  const router = useRouter()

  return <Login onLogin={() => router.push('/kanban')} />
}
