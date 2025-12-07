import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

const ReportPage = () => {
    const { user } = useUser();
    const role = user?.unsafeMetadata?.role;

    const allowedRoles = ['administrator', 'ministry_of_interior'];

    if (!allowedRoles.includes(role)) {
        return <Navigate to="/crime" replace />
    }

    return (
        <div>
            <h3>this page will be displayed only when admin or ministry of interior login or signup </h3>
        </div>
    )
}

export default ReportPage
