import React from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';

const Navbar = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    return (
        <div className='fixed z-50 w-full backdrop-blur-2xl flex justify-between items-center py-3 px-4 sm:px-20 xl:px-32 cursor-pointer'>
            <img src={assets.logo} alt="" className='w-32 sm:w-15 cursor-pointer' onClick={() => navigate('/')} />
            {
                user ? (
                    <button
                        onClick={() => { logout(); navigate('/'); }}
                        className='flex items-center gap-2 rounded-full text-sm cursor-pointer bg-primary text-white px-10 py-2'
                    >
                        Logout <ArrowRight className='w-4 h-4' />
                    </button>
                ) : (
                    <button onClick={() => navigate('/login')} className='flex items-center gap-2 rounded-full text-sm cursor-pointer bg-primary text-white px-10 py-2'>
                        Get started <ArrowRight className='w-4 h-4' />
                    </button>
                )
            }
        </div>
    )
}

export default Navbar