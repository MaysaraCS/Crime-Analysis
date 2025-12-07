import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

const UpdatePage = () => {
    const { user } = useUser();
    const role = user?.unsafeMetadata?.role;

    const allowedRoles = ['general_statistic', 'hr', 'civil_status', 'ministry_of_justice'];

    if (!allowedRoles.includes(role)) {
        return <Navigate to="/crime" replace />
    }

    return (
        <div>
            <h3>This page is displayed when users general statistic , Human resources , civil status , Ministry of justice
                login or sigup , these users will have update and view from this page the data will be displayed here and they can update it as well  </h3>
        </div>
    )
}

export default UpdatePage
