import React from 'react'
import Navbar from '../components/Navbar.jsx'
import Hero from '../components/Hero.jsx'
import Testimonial from '../components/Testimonial.jsx'
import CrimeServices from '../components/CrimeServices.jsx'
import Footer from '../components/Footer.jsx'

const Home = () => {
    return (
        <>
            <Navbar />
            <Hero />
            <CrimeServices />
            <Testimonial />
            <Footer />
        </>
    )
}

export default Home