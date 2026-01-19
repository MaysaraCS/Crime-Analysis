import { Lock, Mail } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import toast from 'react-hot-toast';

const EMAIL_OPTIONS = [
  { value: 'generalStatistics123@gmail.com', label: 'General Statistics' },
  { value: 'HumanResources456@gmail.com', label: 'Human Resources' },
  { value: 'CivilStatus789@gmail.com', label: 'Civil Status' },
  { value: 'MinistryOfJustice456@gmail.com', label: 'Ministry of Justice' },
  { value: 'admin5678@gmail.com', label: 'Administrator' },
  { value: 'MinistryOfInterior456123@gmail.com', label: 'Ministry of Interior' },
];

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = React.useState({
    email: EMAIL_OPTIONS[0].value,
    password: '',
  });

  const [loading, setLoading] = React.useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      login(data); // store user + token in context/localStorage
      toast.success(data.message || 'Login successful');
      navigate('/crime');
    } catch (error) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-50'>
      <form onSubmit={handleSubmit} className="sm:w-[500px] w-full text-center border border-gray-300/60 rounded-2xl px-8 bg-white">
        <h1 className="text-gray-900 text-3xl mt-10 font-medium">Login</h1>
        <p className="text-gray-500 text-sm mt-2">Please login to continue</p>

        {/* Email dropdown */}
        <div className="flex items-center w-full mt-6 bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
          <Mail size={13} color='#6B7280' />
          <select
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="border-none outline-none ring-0 w-full text-sm bg-transparent"
          >
            {EMAIL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value})
              </option>
            ))}
          </select>
        </div>

        {/* Password */}
        <div className="flex items-center mt-4 w-full bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
          <Lock size={13} color='#6B7280' />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="border-none outline-none ring-0 w-full text-sm"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mt-4 text-left text-blue-700 text-sm">
          {/* No real reset flow, just a placeholder button */}
          <button className="text-sm" type="button" onClick={() => toast('Contact admin to reset password.')}>Forget password?</button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full h-11 rounded-full text-white bg-blue-900 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 w-full h-10 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Back to Home
        </button>

        <p className="text-gray-500 text-sm mt-3 mb-11">
          Only pre-registered system accounts can log in.
        </p>
      </form>
    </div>
  );
};

export default Login;
