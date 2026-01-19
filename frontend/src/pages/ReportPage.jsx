import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const ReportPage = () => {
    const { user } = useAuth();
    const role = user?.role;

    const allowedRoles = ['administrator', 'ministry_of_interior'];

    if (!allowedRoles.includes(role)) {
        return <Navigate to="/crime" replace />
    }

    return (
        <div>
            <h3>this page will be displayed only when admin or ministry of interior login </h3>
        </div>
    )
}

export default ReportPage