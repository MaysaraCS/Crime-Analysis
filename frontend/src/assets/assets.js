import logo from "./logo.webp";
import gradientBackground from "./gradientBackground.png";
import user_group from "./user_group.png";
import star_icon from "./star_icon.svg";
import star_dull_icon from "./star_dull_icon.svg";
import profile_img_1 from "./profile_img_1.png";
import arrow_icon from "./arrow_icon.svg";
import { Database, MapPin, UserCheck, FileText, Search } from 'lucide-react'

export const assets = {
    logo,
    gradientBackground,
    user_group,
    star_icon,
    star_dull_icon,
    profile_img_1,
    arrow_icon,
};

export const CrimeServicesData = [
    {
        title: 'Crime Data Integration',
        description: 'Centralizes demographic, crime, and seasonal trend data from multiple official sectors into one unified platform.',
        Icon: Database,
        bg: { from: '#3588F2', to: '#0BB0D7' },
        path: '/'
    },
    {
        title: 'Risk Level Visualization',
        description: 'Displays neighborhood crime severity using dynamic color-coded map layers based on crime weight (1-10).',
        Icon: MapPin,
        bg: { from: '#B153EA', to: '#E549A3' },
        path: '/'
    },
    {
        title: 'Role-Based Data Management',
        description: 'Allows each user type to securely insert, update, or retrieve crime information according to their authority. ',
        Icon: UserCheck,
        bg: { from: '#20C363', to: '#11B97E' },
        path: '/'
    },
    {
        title: 'Automated Crime Reporting',
        description: 'Generates downloadable analytical reports with visual charts that summarize crime patterns and trends.',
        Icon: FileText,
        bg: { from: '#F76C1C', to: '#F04A3C' },
        path: '/'
    },
    {
        title: 'Neighborhood Search & Mapping',
        description: 'Enables users to search any Dammam neighborhood and instantly view its crime indicators on an interactive map.',
        Icon: Search,
        bg: { from: '#5C6AF1', to: '#427DF5' },
        path: '/'
    },
]

export const dummyTestimonialData = [
    {
        image: assets.profile_img_1,
        name: 'Ahmed Al-Harbi',
        title: 'Data Analyst',
        content: 'This platform helped me quickly understand neighborhood crime patterns in Dammam. The visual maps made everything clear and easy to analyze.',
        rating: 4,
    },
    {
        image: assets.profile_img_1,
        name: 'Sarah Al-Mutairi',
        title: 'Government Employee',
        content: 'A very organized system. I was able to access the reports I needed in seconds. The role-based access is really helpful.',
        rating: 5,
    },
    {
        image: assets.profile_img_1,
        name: 'Fahad Al-Qahtani',
        title: 'Security Specialist',
        content: 'The seasonal crime analysis gave me insights I could not find anywhere else. It is simple, fast, and extremely useful.',
        rating: 4,
    },
]