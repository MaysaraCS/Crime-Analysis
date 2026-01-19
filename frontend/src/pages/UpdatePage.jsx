import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const UpdatePage = () => {
    const { user } = useAuth();
    const role = user?.role;

    const allowedRoles = ['general_statistic', 'hr', 'civil_status', 'ministry_of_justice'];

    if (!allowedRoles.includes(role)) {
        return <Navigate to="/crime" replace />
    }

    return (
        <div>
            <h3>This page is displayed when users general statistic, Human resources, civil status, Ministry of justice login; these users will have update and view from this page.</h3>
        </div>
    )
}

export default UpdatePage