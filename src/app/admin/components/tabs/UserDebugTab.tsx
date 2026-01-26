'use client'

import { useState, useCallback } from 'react'
import { MetricCard, MetricGrid } from '../MetricCard'
import { DataTable, StatusBadge, getStatusVariant } from '../DataTable'
import { useAdminUsers, useUserDebug } from '../../hooks/useAdminQueries'
import { useQueryClient } from '@tanstack/react-query'

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let timeoutId: NodeJS.Timeout
    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => fn(...args), delay)
    }) as T
}

export function UserDebugTab() {
    const queryClient = useQueryClient()
    
    // Search and list state
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [sortBy, setSortBy] = useState<'lastOnlineAt' | 'createdAt'>('lastOnlineAt')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const pageSize = 20

    // Modal states
    const [showDisplayNameModal, setShowDisplayNameModal] = useState(false)
    const [displayNameAction, setDisplayNameAction] = useState<'reset' | 'edit' | null>(null)
    const [editDisplayNameValue, setEditDisplayNameValue] = useState('')
    const [updatingDisplayName, setUpdatingDisplayName] = useState(false)

    const [showEmailModal, setShowEmailModal] = useState(false)
    const [emailSubject, setEmailSubject] = useState('')
    const [emailBody, setEmailBody] = useState('')
    const [sendingEmail, setSendingEmail] = useState(false)

    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deletingUser, setDeletingUser] = useState(false)

    // Message state
    const [message, setMessage] = useState<string | null>(null)

    // Debounced search
    const debouncedSetSearch = useCallback(
        debounce((value: string) => {
            setDebouncedSearch(value)
            setPage(1)
        }, 300),
        []
    )

    const handleSearchChange = (value: string) => {
        setSearch(value)
        debouncedSetSearch(value)
    }

    const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useAdminUsers({
        search: debouncedSearch || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        sortBy,
        sortOrder,
    })

    const { data: userDebug, isLoading: debugLoading, refetch: refetchUserDebug } = useUserDebug(selectedUserId)

    const users = usersData?.users ?? []
    const totalUsers = usersData?.totalCount ?? 0

    // Get the selected user object from the users list
    const selectedUser = users.find(u => u.id === selectedUserId) || userDebug?.user

    // Invalidate queries after user updates
    const refreshData = () => {
        refetchUsers()
        if (selectedUserId) {
            refetchUserDebug()
        }
    }

    return (
        <div className="space-y-6">
            {/* Success/Error Message */}
            {message && (
                <div className={`p-4 rounded-lg ${
                    message.includes('Error') || message.includes('Failed') 
                        ? 'bg-red-100 border border-red-400 text-red-700' 
                        : 'bg-green-100 border border-green-400 text-green-700'
                }`}>
                    <div className="flex justify-between items-center">
                        <span>{message}</span>
                        <button onClick={() => setMessage(null)} className="text-lg font-bold">&times;</button>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* User List Panel */}
                <div className="w-full lg:w-1/3 lg:min-w-[320px]">
                    <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                        {/* Search */}
                        <div className="p-3 border-b border-gray-200">
                            <input
                                type="text"
                                placeholder="Search users by email, name, or display name..."
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            />
                        </div>

                        {/* Sort Controls */}
                        <div className="p-2 border-b border-gray-200 flex flex-wrap gap-2 items-center bg-gray-50">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'lastOnlineAt' | 'createdAt')}
                                className="px-2 py-1 text-xs border rounded bg-white text-gray-900"
                            >
                                <option value="lastOnlineAt">Last Online</option>
                                <option value="createdAt">Created</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className={`px-2 py-1 text-xs border rounded flex items-center justify-center gap-1 w-16 font-mono ${
                                    sortOrder === 'desc' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-300 text-gray-700'
                                }`}
                            >
                                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                            </button>
                            <button
                                onClick={() => refetchUsers()}
                                className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Refresh
                            </button>
                        </div>
                        
                        {/* User List */}
                        <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                            {usersLoading ? (
                                <div className="p-4 text-center text-gray-500">Loading...</div>
                            ) : users.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">No users found</div>
                            ) : (
                                users.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={`
                                            w-full px-3 py-2 text-left border-b border-gray-100
                                            hover:bg-gray-50 transition-colors
                                            ${selectedUserId === user.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                                        `}
                                    >
                                        <div className="font-medium text-sm text-gray-900">
                                            {user.displayName || user.name || 'No name'}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {user.email || 'No email'}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                                            <span>
                                                {user.lastOnlineAt 
                                                    ? `Last seen: ${new Date(user.lastOnlineAt).toLocaleDateString()}`
                                                    : 'Never online'
                                                }
                                            </span>
                                            {user.games && user.games.length > 0 && (
                                                <span className="text-blue-600">
                                                    {user.games.length} in-progress
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Pagination */}
                        {totalUsers > pageSize && (
                            <div className="p-2 border-t border-gray-200 flex justify-between items-center text-xs">
                                <span className="text-gray-500">
                                    {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalUsers)} of {totalUsers}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-2 py-1 border rounded disabled:opacity-50 text-gray-700"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={page * pageSize >= totalUsers}
                                        className="px-2 py-1 border rounded disabled:opacity-50 text-gray-700"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* User Debug Panel */}
                <div className="flex-1">
                    {!selectedUserId ? (
                        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 h-96 flex items-center justify-center">
                            <p className="text-gray-500">Select a user to view their debug info</p>
                        </div>
                    ) : debugLoading ? (
                        <div className="bg-white rounded-lg border-2 border-gray-200 h-96 flex items-center justify-center">
                            <div className="text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                <p className="text-gray-500">Loading user data...</p>
                            </div>
                        </div>
                    ) : userDebug ? (
                        <div className="space-y-4">
                            {/* User Profile Section with Actions */}
                            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {userDebug.user.displayName || userDebug.user.name || 'No name'}
                                            </h3>
                                            <StatusBadge
                                                status={userDebug.user.role}
                                                variant={userDebug.user.role === 'ADMIN' ? 'danger' : 'default'}
                                            />
                                        </div>
                                        <p className="text-sm text-gray-600">{userDebug.user.email}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            ID: <code className="bg-gray-100 px-1 rounded">{userDebug.user.id}</code>
                                        </p>
                                        {userDebug.user.clerkUserId && (
                                            <p className="text-xs text-gray-400">
                                                Clerk ID: <code className="bg-gray-100 px-1 rounded">{userDebug.user.clerkUserId}</code>
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => {
                                                setShowDisplayNameModal(true)
                                                setDisplayNameAction(null)
                                                setEditDisplayNameValue(userDebug.user.displayName || '')
                                            }}
                                            className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 whitespace-nowrap"
                                        >
                                            Display Name
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowEmailModal(true)
                                                setEmailSubject('')
                                                setEmailBody('')
                                            }}
                                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 whitespace-nowrap"
                                        >
                                            Email
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowDeleteModal(true)
                                                setDeleteConfirmText('')
                                            }}
                                            className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 whitespace-nowrap"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200">
                                    <div>
                                        <p className="text-xs text-gray-500">Created</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {new Date(userDebug.user.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Last Online</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {userDebug.user.lastOnlineAt 
                                                ? new Date(userDebug.user.lastOnlineAt).toLocaleString()
                                                : 'Never'
                                            }
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Last Path</p>
                                        <p className="text-sm font-medium font-mono truncate text-gray-900">
                                            {userDebug.user.lastSeenPath || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Streaks</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            Current: {userDebug.user.currentStreak} / Best: {userDebug.user.longestStreak}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Section */}
                            <MetricGrid columns={5}>
                                <MetricCard
                                    title="Games Played"
                                    value={userDebug.stats.games.total}
                                    subtitle={`${userDebug.stats.games.inProgress} in progress`}
                                    color="blue"
                                    size="sm"
                                />
                                <MetricCard
                                    title="Daily Challenges"
                                    value={userDebug.stats.dailyChallenges.total}
                                    subtitle={`${userDebug.stats.dailyChallenges.accuracy.toFixed(0)}% accuracy`}
                                    color="purple"
                                    size="sm"
                                />
                                <MetricCard
                                    title="Recent Accuracy"
                                    value={`${userDebug.stats.recentHistory.accuracy.toFixed(0)}%`}
                                    subtitle={`${userDebug.stats.recentHistory.correct}/${userDebug.stats.recentHistory.total}`}
                                    color={userDebug.stats.recentHistory.accuracy > 50 ? 'green' : 'yellow'}
                                    size="sm"
                                />
                                <MetricCard
                                    title="Achievements"
                                    value={userDebug.stats.achievementsUnlocked}
                                    color="yellow"
                                    size="sm"
                                />
                                <MetricCard
                                    title="Disputes"
                                    value={userDebug.stats.disputes.total}
                                    subtitle={`${userDebug.stats.disputes.pending} pending`}
                                    color={userDebug.stats.disputes.pending > 0 ? 'red' : 'gray'}
                                    size="sm"
                                />
                            </MetricGrid>

                            {/* Recent Games */}
                            <DataTable
                                title="Recent Games"
                                data={userDebug.recentActivity.games.slice(0, 10)}
                                keyField="id"
                                compact
                                maxHeight="250px"
                                stickyHeader
                                columns={[
                                    {
                                        key: 'status',
                                        header: 'Status',
                                        render: (row) => (
                                            <StatusBadge
                                                status={row.status}
                                                variant={getStatusVariant(row.status)}
                                            />
                                        ),
                                    },
                                    {
                                        key: 'currentScore',
                                        header: 'Score',
                                        align: 'right',
                                        render: (row) => `$${row.currentScore.toLocaleString()}`,
                                    },
                                    {
                                        key: 'currentRound',
                                        header: 'Round',
                                    },
                                    {
                                        key: 'questionCount',
                                        header: 'Questions',
                                        align: 'right',
                                    },
                                    {
                                        key: 'updatedAt',
                                        header: 'Last Activity',
                                        render: (row) => new Date(row.updatedAt).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        }),
                                    },
                                    {
                                        key: 'actions',
                                        header: '',
                                        width: '80px',
                                        render: (row) => row.status === 'IN_PROGRESS' && row.seed ? (
                                            <a
                                                href={`/play/${row.seed}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                            >
                                                View
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        ) : null,
                                    },
                                ]}
                            />

                            {/* Recent Daily Challenges */}
                            <DataTable
                                title="Recent Daily Challenges"
                                data={userDebug.recentActivity.dailyChallenges.slice(0, 10)}
                                keyField="id"
                                compact
                                maxHeight="200px"
                                stickyHeader
                                columns={[
                                    {
                                        key: 'correct',
                                        header: 'Result',
                                        render: (row) => (
                                            <StatusBadge
                                                status={row.correct ? 'Correct' : 'Incorrect'}
                                                variant={row.correct ? 'success' : 'danger'}
                                            />
                                        ),
                                    },
                                    {
                                        key: 'userAnswer',
                                        header: 'Answer Given',
                                        render: (row) => (
                                            <span className="text-xs truncate max-w-[150px] block text-gray-900">
                                                {row.userAnswer || '-'}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: 'challenge',
                                        header: 'Date',
                                        render: (row) => new Date(row.challenge.date).toLocaleDateString(),
                                    },
                                    {
                                        key: 'completedAt',
                                        header: 'Completed',
                                        render: (row) => new Date(row.completedAt).toLocaleString(),
                                    },
                                ]}
                            />

                            {/* Disputes */}
                            {userDebug.recentActivity.disputes.length > 0 && (
                                <DataTable
                                    title="Disputes"
                                    data={userDebug.recentActivity.disputes}
                                    keyField="id"
                                    compact
                                    maxHeight="200px"
                                    stickyHeader
                                    columns={[
                                        {
                                            key: 'status',
                                            header: 'Status',
                                            render: (row) => (
                                                <StatusBadge
                                                    status={row.status}
                                                    variant={getStatusVariant(row.status)}
                                                />
                                            ),
                                        },
                                        {
                                            key: 'mode',
                                            header: 'Mode',
                                        },
                                        {
                                            key: 'userAnswer',
                                            header: 'User Answer',
                                            render: (row) => (
                                                <span className="text-xs truncate max-w-[150px] block text-gray-900">
                                                    {row.userAnswer}
                                                </span>
                                            ),
                                        },
                                        {
                                            key: 'createdAt',
                                            header: 'Created',
                                            render: (row) => new Date(row.createdAt).toLocaleDateString(),
                                        },
                                    ]}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg border-2 border-gray-200 h-96 flex items-center justify-center">
                            <p className="text-gray-500">User not found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Display Name Modal */}
            {showDisplayNameModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Manage Display Name</h3>
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>User:</strong> {selectedUser.displayName || selectedUser.name || 'No name'} ({selectedUser.email})
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Current Display Name:</strong> {selectedUser.displayName || <span className="text-gray-400">Not set</span>}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Action Selection */}
                            {!displayNameAction && (
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setDisplayNameAction('reset')}
                                        className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-left"
                                    >
                                        <div className="font-semibold">Reset Display Name</div>
                                        <div className="text-sm opacity-90">Generate a new random display name</div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDisplayNameAction('edit')
                                            setEditDisplayNameValue(selectedUser.displayName || '')
                                        }}
                                        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-left"
                                    >
                                        <div className="font-semibold">Edit Display Name</div>
                                        <div className="text-sm opacity-90">Set a custom display name</div>
                                    </button>
                                </div>
                            )}

                            {/* Reset Confirmation */}
                            {displayNameAction === 'reset' && (
                                <div className="space-y-4">
                                    <p className="text-gray-700">
                                        This will generate a new random display name for this user. The current display name will be replaced.
                                    </p>
                                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                                        <button
                                            onClick={() => setDisplayNameAction(null)}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setUpdatingDisplayName(true)
                                                try {
                                                    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ action: 'reset' }),
                                                    })

                                                    if (response.ok) {
                                                        const data = await response.json()
                                                        setMessage(data.message || 'Display name reset successfully')
                                                        setShowDisplayNameModal(false)
                                                        setDisplayNameAction(null)
                                                        refreshData()
                                                    } else {
                                                        const error = await response.json()
                                                        alert(error.error || 'Failed to reset display name')
                                                    }
                                                } catch (error) {
                                                    console.error('Error resetting display name:', error)
                                                    alert('Failed to reset display name')
                                                } finally {
                                                    setUpdatingDisplayName(false)
                                                }
                                            }}
                                            disabled={updatingDisplayName}
                                            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {updatingDisplayName ? 'Resetting...' : 'Reset Display Name'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Edit Form */}
                            {displayNameAction === 'edit' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            New Display Name
                                        </label>
                                        <input
                                            type="text"
                                            value={editDisplayNameValue}
                                            onChange={(e) => setEditDisplayNameValue(e.target.value)}
                                            placeholder="Enter display name"
                                            className="w-full p-2 border rounded text-gray-900"
                                            maxLength={50}
                                            autoFocus
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {editDisplayNameValue.length}/50 characters
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                                        <button
                                            onClick={() => {
                                                setDisplayNameAction(null)
                                                setEditDisplayNameValue(selectedUser.displayName || '')
                                            }}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!editDisplayNameValue.trim()) {
                                                    alert('Display name cannot be empty')
                                                    return
                                                }

                                                setUpdatingDisplayName(true)
                                                try {
                                                    const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            action: 'edit',
                                                            displayName: editDisplayNameValue.trim(),
                                                        }),
                                                    })

                                                    if (response.ok) {
                                                        const data = await response.json()
                                                        setMessage(data.message || 'Display name updated successfully')
                                                        setShowDisplayNameModal(false)
                                                        setDisplayNameAction(null)
                                                        setEditDisplayNameValue('')
                                                        refreshData()
                                                    } else {
                                                        const error = await response.json()
                                                        alert(error.error || 'Failed to update display name')
                                                    }
                                                } catch (error) {
                                                    console.error('Error updating display name:', error)
                                                    alert('Failed to update display name')
                                                } finally {
                                                    setUpdatingDisplayName(false)
                                                }
                                            }}
                                            disabled={updatingDisplayName || !editDisplayNameValue.trim()}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {updatingDisplayName ? 'Updating...' : 'Update Display Name'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Close button when no action selected */}
                        {!displayNameAction && (
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => {
                                        setShowDisplayNameModal(false)
                                        setDisplayNameAction(null)
                                        setEditDisplayNameValue('')
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Send Email Modal */}
            {showEmailModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Send Email</h3>
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>To:</strong> {selectedUser.displayName || selectedUser.name || 'No name'} ({selectedUser.email})
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    placeholder="Email subject"
                                    className="w-full p-2 border rounded text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Message
                                </label>
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    placeholder="Email message"
                                    rows={6}
                                    className="w-full p-2 border rounded text-gray-900"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowEmailModal(false)
                                    setEmailSubject('')
                                    setEmailBody('')
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!emailSubject.trim() || !emailBody.trim()) {
                                        alert('Subject and message are required')
                                        return
                                    }

                                    if (!confirm('Are you sure you want to send this email?')) {
                                        return
                                    }

                                    setSendingEmail(true)
                                    try {
                                        const response = await fetch('/api/admin/users/send-email', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                userId: selectedUser.id,
                                                subject: emailSubject,
                                                body: emailBody,
                                            }),
                                        })

                                        if (response.ok) {
                                            const data = await response.json()
                                            setMessage(data.message || 'Email sent successfully')
                                            setShowEmailModal(false)
                                            setEmailSubject('')
                                            setEmailBody('')
                                        } else {
                                            const error = await response.json()
                                            alert(error.error || 'Failed to send email')
                                        }
                                    } catch (error) {
                                        console.error('Error sending email:', error)
                                        alert('Failed to send email. Please check your SMTP configuration.')
                                    } finally {
                                        setSendingEmail(false)
                                    }
                                }}
                                disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {sendingEmail ? 'Sending...' : 'Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete User Modal */}
            {showDeleteModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl my-auto">
                        <h3 className="text-xl font-bold text-red-600 mb-4">Delete User Account</h3>
                        <p className="text-gray-700 mb-4">
                            You are about to delete the account for <strong>{selectedUser.displayName || selectedUser.name || selectedUser.email}</strong> ({selectedUser.email}).
                        </p>
                        <p className="text-gray-700 mb-4">
                            This will permanently delete all user data from the database, including:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
                            <li>All games and game history</li>
                            <li>User progress and achievements</li>
                            <li>Daily challenge completions</li>
                            <li>Disputes and answer overrides</li>
                        </ul>
                        <p className="text-yellow-600 font-semibold mb-4">
                            Note: This does NOT delete the Clerk account. The user will still be able to sign in, but will need to create a new account.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type the user&apos;s email to confirm deletion:
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder={selectedUser.email ?? undefined}
                                className="w-full p-2 border rounded text-gray-900"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false)
                                    setDeleteConfirmText('')
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 whitespace-nowrap"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (deleteConfirmText !== selectedUser.email) {
                                        alert('Email does not match. Please type the email exactly to confirm deletion.')
                                        return
                                    }

                                    setDeletingUser(true)
                                    try {
                                        const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                                            method: 'DELETE',
                                        })

                                        if (response.ok) {
                                            setMessage(`Successfully deleted user ${selectedUser.email}`)
                                            setShowDeleteModal(false)
                                            setDeleteConfirmText('')
                                            setSelectedUserId(null)
                                            refreshData()
                                        } else {
                                            const error = await response.json()
                                            alert(error.error || 'Failed to delete user')
                                        }
                                    } catch (error) {
                                        console.error('Error deleting user:', error)
                                        alert('Failed to delete user')
                                    } finally {
                                        setDeletingUser(false)
                                    }
                                }}
                                disabled={deletingUser || deleteConfirmText !== selectedUser.email}
                                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {deletingUser ? 'Deleting...' : 'Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
