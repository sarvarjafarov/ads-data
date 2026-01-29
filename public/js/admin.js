let currentEditId = null;
let currentUserFilter = 'all';
let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Initialize
    loadUserInfo();
    loadAds();
    loadUsers();

    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('addNewBtn').addEventListener('click', () => openModal());
    document.getElementById('adForm').addEventListener('submit', handleSubmit);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('refreshExperimentsBtn').addEventListener('click', loadExperimentResults);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Filter buttons
    document.querySelectorAll('.filter-buttons .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => filterUsers(btn.dataset.filter));
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('adModal');
        if (e.target === modal) {
            closeModal();
        }
    });
});

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tabName === 'ads') {
        document.getElementById('adsTab').classList.add('active');
    } else if (tabName === 'users') {
        document.getElementById('usersTab').classList.add('active');
        loadUsers(); // Refresh users when switching to tab
    } else if (tabName === 'experiments') {
        document.getElementById('experimentsTab').classList.add('active');
        loadExperimentResults();
    }
}

async function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = '/admin/login';
        return;
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
        window.location.href = '/dashboard';
        return;
    }

    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/admin/login';
            return;
        }

        const data = await response.json();

        // Double-check role from server response
        if (data.user && data.user.role !== 'admin') {
            window.location.href = '/dashboard';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/admin/login';
    }
}

function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';
}

async function loadAds() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/admin/ads', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            displayAds(data.data);
            document.getElementById('totalAds').textContent = data.count;
        }
    } catch (error) {
        console.error('Error loading ads:', error);
        alert('Failed to load ads');
    }
}

function displayAds(ads) {
    const tbody = document.getElementById('adsTableBody');

    if (ads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #6b7280;">No ads found. Click "Add New Ad" to create one.</td></tr>';
        return;
    }

    tbody.innerHTML = ads.map(ad => `
        <tr>
            <td>${ad.id}</td>
            <td><img src="${ad.image || 'https://via.placeholder.com/60'}" alt="${ad.title}" class="ad-image" onerror="this.src='https://via.placeholder.com/60'"></td>
            <td><strong>${ad.title}</strong><br><small style="color: #6b7280;">${truncate(ad.description, 50)}</small></td>
            <td>${ad.category}</td>
            <td>$${parseFloat(ad.price).toFixed(2)}</td>
            <td><span class="status-badge status-${ad.status}">${ad.status}</span></td>
            <td class="action-buttons">
                <button class="btn btn-small btn-primary" onclick="editAd(${ad.id})">Edit</button>
                <button class="btn btn-small btn-danger" onclick="deleteAd(${ad.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openModal(ad = null) {
    const modal = document.getElementById('adModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('adForm');

    if (ad) {
        modalTitle.textContent = 'Edit Ad';
        document.getElementById('adId').value = ad.id;
        document.getElementById('adTitle').value = ad.title;
        document.getElementById('adDescription').value = ad.description;
        document.getElementById('adPrice').value = ad.price;
        document.getElementById('adCategory').value = ad.category;
        document.getElementById('adImage').value = ad.image;
        document.getElementById('adStatus').value = ad.status;
        currentEditId = ad.id;
    } else {
        modalTitle.textContent = 'Add New Ad';
        form.reset();
        document.getElementById('adId').value = '';
        currentEditId = null;
    }

    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('adModal');
    modal.classList.remove('show');
    currentEditId = null;
}

async function handleSubmit(e) {
    e.preventDefault();

    const token = localStorage.getItem('token');
    const formData = {
        title: document.getElementById('adTitle').value,
        description: document.getElementById('adDescription').value,
        price: parseFloat(document.getElementById('adPrice').value) || 0,
        category: document.getElementById('adCategory').value,
        image: document.getElementById('adImage').value || 'https://via.placeholder.com/300',
        status: document.getElementById('adStatus').value,
    };

    try {
        const url = currentEditId
            ? `/api/admin/ads/${currentEditId}`
            : '/api/admin/ads';

        const method = currentEditId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            loadAds();
        } else {
            alert(data.message || 'Operation failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred');
    }
}

async function editAd(id) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/admin/ads/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            openModal(data.data);
        }
    } catch (error) {
        console.error('Error loading ad:', error);
        alert('Failed to load ad details');
    }
}

async function deleteAd(id) {
    if (!confirm('Are you sure you want to delete this ad?')) {
        return;
    }

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/admin/ads/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            loadAds();
        } else {
            alert(data.message || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting ad:', error);
        alert('Failed to delete ad');
    }
}

// User Management Functions
async function loadUsers() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            allUsers = data.data;
            updateUserStats();
            displayUsers(allUsers);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        alert('Failed to load users');
    }
}

function updateUserStats() {
    const pendingCount = allUsers.filter(u => u.status === 'pending').length;
    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('pendingUsers').textContent = pendingCount;
}

function filterUsers(filter) {
    currentUserFilter = filter;

    // Update filter button states
    document.querySelectorAll('.filter-buttons .btn-secondary').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Filter and display users
    let filteredUsers = allUsers;
    if (filter !== 'all') {
        filteredUsers = allUsers.filter(u => u.status === filter);
    }

    displayUsers(filteredUsers);
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #6b7280;">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const isAdmin = user.role === 'admin';
        const isPending = user.status === 'pending';
        const isApproved = user.status === 'approved';

        return `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.email}</td>
                <td>${user.companyName || '-'}</td>
                <td>${user.contactPerson || '-'}</td>
                <td>${user.phone || '-'}</td>
                <td><span class="status-badge status-${user.status}">${user.status}</span></td>
                <td><span class="status-badge ${isAdmin ? 'status-active' : 'status-draft'}">${user.role}</span></td>
                <td class="action-buttons">
                    ${!isAdmin && isPending ? `
                        <button class="btn btn-small btn-success" onclick="approveUser('${user.id}')">Approve</button>
                        <button class="btn btn-small btn-danger" onclick="rejectUser('${user.id}')">Reject</button>
                    ` : ''}
                    ${!isAdmin && !isPending ? `
                        <button class="btn btn-small btn-danger" onclick="deleteUser('${user.id}')">Delete</button>
                    ` : ''}
                    ${isAdmin ? '<span style="color: #6b7280; font-size: 0.75rem;">Protected</span>' : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// A/B Experiments: load and display results from GET /api/experiments/results
async function loadExperimentResults() {
    const token = localStorage.getItem('token');
    const msgEl = document.getElementById('experimentsMessage');
    const contentEl = document.getElementById('experimentsContent');
    const updatedEl = document.getElementById('experimentsUpdated');

    msgEl.textContent = 'Loading A/B test results…';
    msgEl.style.display = 'block';
    contentEl.style.display = 'none';

    try {
        const response = await fetch('/api/experiments/results', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                msgEl.textContent = 'Please log in to view experiment results.';
            } else {
                msgEl.textContent = data.error || data.message || 'Failed to load experiment results.';
            }
            return;
        }

        if (!data.success || !data.experiments || data.experiments.length === 0) {
            msgEl.textContent = 'No experiment data yet. Run the simulation (npm run simulate-ab) or use the experiment dashboard to generate exposure and event logs.';
            updatedEl.textContent = '—';
            return;
        }

        updatedEl.textContent = data.generated_at ? new Date(data.generated_at).toLocaleString() : '—';
        msgEl.style.display = 'none';
        contentEl.style.display = 'block';

        const totalExposures = data.total_exposures ?? 0;
        const totalEvents = data.total_events ?? 0;
        const hasData = totalExposures > 0 || totalEvents > 0;

        let html = `
            <div class="experiments-summary-cards">
                <div class="experiments-summary-card">
                    <div class="label">Total exposures</div>
                    <div class="value">${totalExposures.toLocaleString()}</div>
                </div>
                <div class="experiments-summary-card">
                    <div class="label">Total events</div>
                    <div class="value">${totalEvents.toLocaleString()}</div>
                </div>
            </div>
        `;

        if (!hasData) {
            html += `
                <div class="experiments-get-data-callout">
                    <strong>No data yet</strong>
                    To see results here, generate exposure and event logs by either:
                    <ul style="margin: 0.5rem 0 0 1rem;">
                        <li>Running the simulation: <code>npm run simulate-ab</code> (with the server running)</li>
                        <li>Sending traffic to <code>GET /api/experiments/dashboard</code> and <code>POST /api/experiments/events</code></li>
                    </ul>
                    Then click <strong>Refresh results</strong>.
                </div>
            `;
        }

        data.experiments.forEach(exp => {
            const r = exp.results || {};
            const a = r.A || { exposures: 0, events: 0, conversion_rate: 0 };
            const b = r.B || { exposures: 0, events: 0, conversion_rate: 0 };
            const labelA = (exp.variants && exp.variants.A) || 'A';
            const labelB = (exp.variants && exp.variants.B) || 'B';
            const rateA = (a.conversion_rate * 100).toFixed(2);
            const rateB = (b.conversion_rate * 100).toFixed(2);
            const leadingRate = a.conversion_rate >= b.conversion_rate ? a.conversion_rate : b.conversion_rate;

            html += `
                <div class="experiment-card">
                    <h3 class="experiment-card-title">
                        <span class="test-id">${escapeHtml(exp.test_id)}</span>
                    </h3>
                    <p class="experiment-card-desc">${escapeHtml(exp.description || '')}</p>
                    <p class="experiment-card-target"><strong>Target event:</strong> ${escapeHtml(exp.target_event || '—')}</p>
                    <table class="experiments-variant-table">
                        <thead>
                            <tr>
                                <th>Variant</th>
                                <th>Exposures</th>
                                <th>Events</th>
                                <th>Conversion rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span class="variant-badge variant-badge-a">${escapeHtml(labelA)}</span></td>
                                <td>${a.exposures.toLocaleString()}</td>
                                <td>${a.events.toLocaleString()}</td>
                                <td class="conversion-cell ${a.conversion_rate === leadingRate && leadingRate > 0 ? 'leading' : 'trailing'}">${rateA}%</td>
                            </tr>
                            <tr>
                                <td><span class="variant-badge variant-badge-b">${escapeHtml(labelB)}</span></td>
                                <td>${b.exposures.toLocaleString()}</td>
                                <td>${b.events.toLocaleString()}</td>
                                <td class="conversion-cell ${b.conversion_rate === leadingRate && leadingRate > 0 ? 'leading' : 'trailing'}">${rateB}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });

        contentEl.innerHTML = html;
    } catch (error) {
        console.error('Error loading experiment results:', error);
        msgEl.textContent = 'Failed to load experiment results. Check the console.';
        updatedEl.textContent = '—';
    }
}

async function approveUser(userId) {
    if (!confirm('Are you sure you want to approve this user?')) {
        return;
    }

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/admin/users/${userId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            alert('User approved successfully');
            loadUsers();
        } else {
            alert(data.message || 'Approval failed');
        }
    } catch (error) {
        console.error('Error approving user:', error);
        alert('Failed to approve user');
    }
}

async function rejectUser(userId) {
    if (!confirm('Are you sure you want to reject this user?')) {
        return;
    }

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/admin/users/${userId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            alert('User rejected successfully');
            loadUsers();
        } else {
            alert(data.message || 'Rejection failed');
        }
    } catch (error) {
        console.error('Error rejecting user:', error);
        alert('Failed to reject user');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.success) {
            alert('User deleted successfully');
            loadUsers();
        } else {
            alert(data.message || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
    }
}

async function logout() {
    // Get token before clearing
    const token = localStorage.getItem('token');

    // Clear localStorage FIRST to prevent race conditions
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    try {
        // Call logout API to clear server-side cookie
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error('Logout API error:', error);
    }

    // Redirect with logout parameter to skip auth check
    window.location.href = '/admin/login?logout=true';
}
