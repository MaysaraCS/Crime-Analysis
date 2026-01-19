import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const AdminPage = () => {
  const { user } = useAuth();
  const role = user?.role;

  if (role !== 'administrator') {
    return <Navigate to="/crime" replace />
  }

  return (
    <div>
      <h3>This page will be displayed only when admin login, admin will have all CRUD functions</h3>
    </div>
  )
}

export default AdminPage