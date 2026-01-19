import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const InsertPage = () => {
    const { user } = useAuth();
    const role = user?.role;

    if (role !== 'general_statistic') {
        return <Navigate to="/crime" replace />
    }

    return (
        <div>
            <h3>This page will be displayed only when general statistic user login, general statistic will have insert function</h3>
        </div>
    )
}

export default InsertPage