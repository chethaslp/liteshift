'use client';

import React, { useEffect, useState } from "react";
import { useSocketContext } from "@/context/SocketContext";
import Button from "@/components/ui/button/Button";
import InputField from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Alert from "@/components/ui/alert/Alert";
import { Modal } from "@/components/ui/modal";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface EditUserData {
  username?: string;
  email?: string;
  role?: string;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Edit profile modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editData, setEditData] = useState<EditUserData>({});
  
  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: ''
  });
  
  const { socket, user } = useSocketContext();

  const handleEditProfile = async () => {
    if (!socket || !user) return;
    
    try {
      setEditLoading(true);
      setError(null);
      
      const response = await socket.emitWithAck('user:edit', {
        userId: user.id,
        ...editData
      });
      
      if (response.success) {
        setSuccess('Profile updated successfully');
        setShowEditModal(false);
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Failed to update profile');
      console.error('Error updating profile:', err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!socket || !user) return;
    
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setError('Both current and new passwords are required');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    
    try {
      setPasswordLoading(true);
      setError(null);
      
      const response = await socket.emitWithAck('user:changePassword', {
        userId: user.id,
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (response.success) {
        setSuccess('Password changed successfully. You will be disconnected for security.');
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '' });
      } else {
        setError(response.error || 'Failed to change password');
      }
    } catch (err) {
      setError('Failed to change password');
      console.error('Error changing password:', err);
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    if(!socket || !user) return;
     setEditData({
          username: user.username,
          email: user.email,
          role: user.role
        });
  }, [socket]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading || !socket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">
          {!socket ? 'Connecting to server...' : 'Loading profile...'}
        </span>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="p-6">
        <Alert
          variant="error"
          title="Error"
          message={error}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Profile
          </h3>
          <Button
            onClick={() => setShowEditModal(true)}
            disabled={!socket}
            variant="outline"
            size="sm"
          >
            Edit Profile
          </Button>
        </div>

        {error && (
          <div className="mb-6">
            <Alert
              variant="error"
              title="Error"
              message={error}
            />
          </div>
        )}

        {success && (
          <div className="mb-6">
            <Alert
              variant="success"
              title="Success"
              message={success}
            />
          </div>
        )}

        {user && (
          <div className="space-y-6">
            {/* User Info Section */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
                Account Information
              </h4>
              
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Username
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {user.username}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Email Address
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {user.email}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    Role
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90 capitalize">
                    {user.role}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                    User ID
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {user.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    Security
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Manage your account security settings
                  </p>
                </div>
                <Button
                  onClick={() => setShowPasswordModal(true)}
                  disabled={!socket}
                  variant="outline"
                  size="sm"
                >
                  Change Password
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => {
          setShowEditModal(false);
          setError(null);
          if (user) {
            setEditData({
              username: user.username,
              email: user.email,
              role: user.role
            });
          }
        }}
      >
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Edit Profile</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-username">Username</Label>
              <InputField
                id="edit-username"
                type="text"
                defaultValue={editData.username || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter username"
              />
            </div>

            <div>
              <Label htmlFor="edit-email">Email</Label>
              <InputField
                id="edit-email"
                type="email"
                defaultValue={editData.email || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email"
              />
            </div>

            <div>
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                value={editData.role || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              onClick={() => {
                setShowEditModal(false);
                setError(null);
                if (user) {
                  setEditData({
                    username: user.username,
                    email: user.email,
                    role: user.role
                  });
                }
              }}
              variant="outline"
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProfile}
              variant="primary"
              disabled={editLoading || !socket}
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal 
        isOpen={showPasswordModal} 
        onClose={() => {
          setShowPasswordModal(false);
          setError(null);
          setPasswordData({ currentPassword: '', newPassword: '' });
        }}
      >
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Change Password</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-password">Current Password</Label>
              <InputField
                id="current-password"
                type="password"
                defaultValue={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <Label htmlFor="new-password">New Password</Label>
              <InputField
                id="new-password"
                type="password"
                defaultValue={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              onClick={() => {
                setShowPasswordModal(false);
                setError(null);
                setPasswordData({ currentPassword: '', newPassword: '' });
              }}
              variant="outline"
              disabled={passwordLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              variant="primary"
              disabled={passwordLoading || !socket || !passwordData.currentPassword || !passwordData.newPassword}
            >
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
