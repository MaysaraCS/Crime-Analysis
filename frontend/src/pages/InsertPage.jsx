import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

const InsertPage = () => {
    const { user } = useUser();
    const role = user?.unsafeMetadata?.role;

    if (role !== 'general_statistic') {
        return <Navigate to="/crime" replace />
    }

    return (
        <div>
            <h3>This page will be displayed only when general statistic user login or signup, general statistic  will have insert funtion</h3>
        </div>
    )
}

export default InsertPage
