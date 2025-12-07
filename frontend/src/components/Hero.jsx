import React, { use } from 'react'
import { useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'

const Hero = () => {

    const navigate = useNavigate()

    return (
        <div className='px-4 sm:px-20 xl:px-32 pt-24 sm:pt-32 pb-10 relative flex flex-col w-full justify-center 
    bg-[url(/gradientBackground.png)]  bg-cover bg-no-repeat min-h-screen'>

            <div className='text-center mb-6 '>
                <h1 className='text-3xl sm:text-5xl md:text-6xl 2xl:text-7xl
        font-semibold mx-auto leading-[1.2]'>
                    Check Crimes Analysis In Dammam<br />with <span className='text-primary'>Crime Analysis</span>  </h1>
                <p className='mt-4 max-w-xs sm:max-w-lg 2xl:max-w-xl m-auto
        max-sm:text-xs text-gray-600'>
                    A role-based crime analysis platform for Dammam that
                    centralizes demographic and crime data from multiple
                    government sectors into one secure system.
                    Explore neighborhood risk levels, seasonal crime trends,
                    and visual reports to support data-driven decision making.
                </p>
            </div>


            <div className='flex flex-wrap justify-center gap-4 text-sm max-sm:text-xs'>
                <button onClick={() => navigate('/crime')} className='bg-primary text-white px-10 py-3 rounded-lg hover:scale-102
         activate:scale-95 transition cursor-pointer'>
                    Start now </button>
            </div>
            <div className='flex items-center gap-4 mt-8 mx-auto text-gray-600'>
                <img src={assets.user_group} alt="" className='h-8' />
                Trusted by 1k+ users in Dammam
            </div>
        </div>
    )
}

export default Hero