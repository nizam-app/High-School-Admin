import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { loginAdmin } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const { setAuthData } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      phone: '',
      pin: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (payload) => {
      setAuthData(payload);
      navigate(from, { replace: true });
    },
  });

  const onSubmit = (values) => {
    loginMutation.mutate(values);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f7fe] p-4">
      <section className="w-full max-w-md rounded-xl border border-[#d6e3fb] bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-[#1f3f93]">Admin Login</h1>
     

        <form className="space-y-4 mt-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-[#17367a]">
              Phone
            </label>
            <input
              id="phone"
              type="text"
              className="w-full rounded-lg border border-[#bfd1f3] px-3 py-2 outline-none focus:border-[#1f4ca8]"
              placeholder="XXXXXXXX"
              {...register('phone', {
                required: 'Phone is required',
                pattern: {
                  value: /^[234]\d{7}$/,
                  message: 'Phone must be 8 digits and start with 2, 3, or 4',
                },
              })}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>

          <div>
            <label htmlFor="pin" className="mb-1 block text-sm font-medium text-[#17367a]">
              Pin
            </label>
            <input
              id="pin"
              type="password"
              className="w-full rounded-lg border border-[#bfd1f3] px-3 py-2 outline-none focus:border-[#1f4ca8]"
              placeholder="Enter pin"
              {...register('pin', { required: 'Pin is required' })}
            />
            {errors.pin && <p className="mt-1 text-xs text-red-600">{errors.pin.message}</p>}
          </div>

          {loginMutation.isError && (
            <p className="text-sm text-red-600">
              {loginMutation.error?.response?.data?.message || 'Login failed'}
            </p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-lg bg-[#1f3f93] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-sm text-[#6f84b4]">
          Welcome back! Please log in to access the admin dashboard.
        </p>
      </section>
    </main>
  );
};

export default LoginPage;
