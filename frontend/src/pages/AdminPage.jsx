import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

const AdminPage = () => {
  const { user } = useUser();
  const role = user?.unsafeMetadata?.role;

  if (role !== 'administrator') {
    return <Navigate to="/crime" replace />
  }

  return (
    <div>
      <h3>This page will be displayed only when admin login or signup, admin will have all CRUD funtions</h3>
    </div>
  )
}

export default AdminPage
