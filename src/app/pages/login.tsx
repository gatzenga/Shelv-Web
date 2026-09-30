import { LoginForm } from '@/app/components/login/form'

export default function Login() {
  return (
    <div className="flex flex-col w-screen h-screen relative">
      <main className="flex flex-col w-full h-full justify-center items-center">
        <LoginForm />
      </main>
    </div>
  )
}
