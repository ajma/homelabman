import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@shared/schemas';
import { useLogin } from '../hooks/useAuth';
import { Input } from '../components/ui/input';

export function Login() {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginInput) => {
    login.mutate(data);
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.10] bg-[rgba(255,255,255,0.03)] p-8">
        <div className="mb-6 text-center">
          <h1 className="text-[18px] font-semibold text-[rgba(255,255,255,0.92)]">HomelabMan</h1>
          <p className="mt-1 text-[13px] text-[rgba(255,255,255,0.38)]">Sign in to manage your homelab</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-[12px] font-medium text-[rgba(255,255,255,0.6)]">
              Username
            </label>
            <Input
              id="username"
              placeholder="Enter your username"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-[12px] text-[rgba(254,202,202,0.85)]">{errors.username.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[12px] font-medium text-[rgba(255,255,255,0.6)]">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-[12px] text-[rgba(254,202,202,0.85)]">{errors.password.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="mt-2 w-full rounded-xl bg-[#649ef5] py-2 text-[13px] font-medium text-[#101827] transition-colors hover:bg-[#7db0ff] disabled:opacity-40"
          >
            {login.isPending ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-center text-[12px] text-[rgba(255,255,255,0.35)]">
            First time?{' '}
            <Link
              to="/onboarding"
              className="text-[#7db0ff] hover:underline"
            >
              Set up your instance
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
