import { assets } from "../assets/assets"
//  prebuiltui for this component 
const Testimonial = () => {
    const dummyTestimonialData = [
        {
            image: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=200",
            name: 'Ahmed Al-Harbi',
            title: 'Data Analyst',
            content: 'This platform helped me quickly understand neighborhood crime patterns in Dammam. The visual maps made everything clear and easy to analyze.',
            rating: 4,
        },
        {
            image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200",
            name: 'Sarah Al-Mutairi',
            title: 'Government Employee',
            content: 'A very organized system. I was able to access the reports I needed in seconds. The role-based access is really helpful.',
            rating: 5,
        },
        {
            image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&h=200&auto=format&fit=crop",
            name: 'Fahad Al-Qahtani',
            title: 'Security Specialist',
            content: 'The seasonal crime analysis gave me insights I could not find anywhere else. It is simple, fast, and extremely useful.',
            rating: 4,
        },
    ]

    return (
        <div className='px-4 sm:px-20 xl:px-32 py-24'>
            <div className='text-center'>
                <h2 className='text-slate-700 text-[42px] font-semibold'>Reviews By Users</h2>
                <p className='text-gray-500 max-w-lg mx-auto'>
                    Don't just take our word for it. Here's what our users are saying.
                </p>
            </div>

            <div className='flex flex-wrap mt-10 justify-center'>
                {dummyTestimonialData.map((testimonial) => (
                    <div
                        key={testimonial.name}
                        className='p-8 m-4 max-w-xs rounded-lg bg-[#FDFDFE] shadow-lg border border-gray-100 hover:-translate-y-1 transition duration-300 cursor-pointer'
                    >
                        {/* ⭐ Rating Stars */}
                        <div className="flex items-center gap-1">
                            {Array(5).fill(0).map((_, i) => (
                                <img
                                    key={i}
                                    src={i < testimonial.rating ? assets.star_icon : assets.star_dull_icon}
                                    className="w-4 h-4"
                                    alt="star"
                                />
                            ))}
                        </div>

                        <p className='text-gray-500 text-sm my-5'>" {testimonial.content} "</p>
                        <hr className='mb-5 border-gray-300' />

                        <div className='flex items-center gap-4'>
                            <img
                                src={testimonial.image}
                                className='w-12 h-12 object-cover rounded-full'
                                alt={testimonial.name}
                            />
                            <div className='text-sm text-gray-600'>
                                <h3 className='font-medium'>{testimonial.name}</h3>
                                <p className='text-xs text-gray-500'>{testimonial.title}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default Testimonial