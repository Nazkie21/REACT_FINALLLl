import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Download, MoreVertical, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import UserStatsCards from '../../components/users/UserStatsCards';
import UserDetailModal from '../../components/users/UserDetailModal';
import UserFormModal from '../../components/users/UserFormModal';
import DeleteConfirmModal from '../../components/users/DeleteConfirmModal';

const API_BASE_URL = 'http://localhost:5000/api/admin';

const UsersManagement = () => {
  const token = localStorage.getItem('adminToken');
  
  // State Management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  
  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formMode, setFormMode] = useState('create'); // 'create' or 'edit'
  
  // Loading states
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: limit,
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedRole && { role: selectedRole }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(fromDate && { fromDate: fromDate }),
        ...(toDate && { toDate: toDate })
      });

      const response = await fetch(`${API_BASE_URL}/users?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      
      const result = await response.json();
      setUsers(result.data);
      setCurrentPage(result.pagination.current_page);
      setTotalPages(result.pagination.total_pages);
      setTotalItems(result.pagination.total_items);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, limit, sortBy, sortOrder, searchTerm, selectedRole, selectedStatus, fromDate, toDate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    if (filterName === 'role') setSelectedRole(value);
    if (filterName === 'status') setSelectedStatus(value);
    if (filterName === 'fromDate') setFromDate(value);
    if (filterName === 'toDate') setToDate(value);
    setCurrentPage(1);
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedRole('');
    setSelectedStatus('');
    setFromDate('');
    setToDate('');
    setSortBy('created_at');
    setSortOrder('DESC');
    setCurrentPage(1);
  };

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  // View user details
  const handleViewDetails = async (user) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch user details');
      
      const result = await response.json();
      setSelectedUser(result.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  // Edit user
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormMode('edit');
    setShowFormModal(true);
  };

  // Delete user
  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${selectedUser.user_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete user');
      
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // Create new user
  const handleCreateUser = () => {
    setSelectedUser(null);
    setFormMode('create');
    setShowFormModal(true);
  };

  // Handle form submission
  const handleFormSubmit = async (formData) => {
    try {
      const url = formMode === 'create' 
        ? `${API_BASE_URL}/users`
        : `${API_BASE_URL}/users/${selectedUser.user_id}`;
      
      const method = formMode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save user');
      
      setShowFormModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  // Handle export
  const handleExport = async (format = 'csv') => {
    try {
      const params = new URLSearchParams({
        format,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedRole && { role: selectedRole }),
        ...(fromDate && { fromDate: fromDate }),
        ...(toDate && { toDate: toDate })
      });

      const response = await fetch(`${API_BASE_URL}/users/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to export users');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting users:', error);
    }
  };

  // Handle pagination
  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleLimitChange = (e) => {
    setLimit(parseInt(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Users Management</h1>
        <p className="text-gray-600">Manage users, permissions, and account settings</p>
      </div>

      {/* Statistics Cards */}
      <UserStatsCards token={token} />

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow">
        {/* Toolbar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col gap-4">
            {/* Search and Actions Row */}
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search username or email..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleCreateUser}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={20} />
                Add User
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download size={20} />
                Export
              </button>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={selectedRole}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="From Date"
              />

              <input
                type="date"
                value={toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="To Date"
              />

              <button
                onClick={handleClearFilters}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Clear Filters
              </button>
            </div>

            {/* Last Updated */}
            <div className="text-sm text-gray-600">
              Last updated: {lastUpdated.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader className="animate-spin" size={32} />
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No users found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    <button onClick={() => handleSort('username')} className="flex items-center gap-2 hover:text-gray-900">
                      Username {sortBy === 'username' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    <button onClick={() => handleSort('created_at')} className="flex items-center gap-2 hover:text-gray-900">
                      Registration Date {sortBy === 'created_at' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    <button onClick={() => handleSort('last_login')} className="flex items-center gap-2 hover:text-gray-900">
                      Last Login {sortBy === 'last_login' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900">{user.username}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.registration_date}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.last_login || 'Never'}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(user)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-orange-600 hover:text-orange-900 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {users.length > 0 && (
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-600">Entries per page:</label>
              <select
                value={limit}
                onChange={handleLimitChange}
                className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
              </select>
              <span className="text-sm text-gray-600">
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalItems)} of {totalItems} users
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showDetailModal && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedUser(null);
          }}
          token={token}
        />
      )}

      {showFormModal && (
        <UserFormModal
          user={selectedUser}
          mode={formMode}
          onClose={() => {
            setShowFormModal(false);
            setSelectedUser(null);
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          user={selectedUser}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};

export default UsersManagement;
