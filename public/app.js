let songs = [];
let allMappings = [];
let filteredMappings = [];
let intents = [];
let intentsPage = 1;
let songsPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    loadSettings();
    loadSongs();
    loadIntents();
    loadIntentsConfig();

    // Multi-File Upload Logic
    const multiInput = document.getElementById('multiple-upload');
    const addSongsBtn = document.getElementById('add-songs-btn');
    
    addSongsBtn.addEventListener('click', () => multiInput.click());

    multiInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;

        const formData = new FormData();
        for (const file of e.target.files) {
            formData.append('songs', file);
        }

        try {
            addSongsBtn.disabled = true;
            addSongsBtn.textContent = 'Uploading...';
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                showStatus(`Success! ${result.count} songs uploaded and scanned.`, 'success');
                loadSongs();
            } else {
                showStatus('Upload failed: ' + result.error, 'error');
            }
        } catch (error) {
            showStatus('Upload error: ' + error.message, 'error');
        } finally {
            addSongsBtn.disabled = false;
            addSongsBtn.textContent = '+ Add Songs';
            multiInput.value = '';
        }
    });

    // Sync Songs Logic
    const syncSongsBtn = document.getElementById('sync-songs-btn');
    const syncModal = document.getElementById('sync-modal');
    const syncModalBody = document.getElementById('sync-modal-body');
    const confirmSyncBtn = document.getElementById('confirm-sync-btn');
    const cancelSyncBtn = document.getElementById('cancel-sync-btn');

    if (syncSongsBtn) {
        syncSongsBtn.addEventListener('click', () => handleSync(false));
    }
    if (confirmSyncBtn) {
        confirmSyncBtn.addEventListener('click', () => handleSync(true));
    }
    if (cancelSyncBtn) {
        cancelSyncBtn.addEventListener('click', () => syncModal.style.display = 'none');
    }

    async function handleSync(force = false) {
        try {
            syncSongsBtn.disabled = true;
            syncSongsBtn.textContent = 'Syncing...';
            
            const response = await fetch('/api/songs/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force })
            });

            const result = await response.json();
            
            if (result.requiresConfirmation) {
                renderSyncConfirmation(result.missing);
                syncModal.style.display = 'block';
                return;
            }

            if (result.success) {
                syncModal.style.display = 'none';
                let msg = `Sync complete!`;
                if (result.added?.length > 0) msg += ` Added ${result.added.length} songs.`;
                if (result.removed > 0) msg += ` Removed ${result.removed} songs.`;
                if (result.renames?.length > 0) msg += ` Updated ${result.renames.length} renames.`;
                
                showStatus(msg, 'success');
                loadSongs();
                loadIntents();
            } else {
                showStatus('Sync failed: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showStatus('Sync error: ' + error.message, 'error');
        } finally {
            syncSongsBtn.disabled = false;
            syncSongsBtn.textContent = '🔄 Sync Songs';
        }
    }

    function renderSyncConfirmation(missing) {
        let html = `
            <p>The following songs are missing from your folder but are linked to intent mappings. <strong>Syncing will delete these mappings.</strong></p>
            <div class="impact-list">
        `;

        missing.forEach(m => {
            if (m.mappingsCount > 0) {
                html += `
                    <div class="impact-item">
                        <div class="impact-song">📁 ${m.path}</div>
                        <div class="impact-mappings">
                            <strong>Impacted Intents:</strong><br>
                            ${m.mappings.map(map => `• "${map.query}" (${map.intent})`).join('<br>')}
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="impact-item">
                        <div class="impact-song">📁 ${m.path} (No mappings affected)</div>
                    </div>
                `;
            }
        });

        html += `</div><p style="margin-top: 1rem; color: #ef4444; font-weight: 600;">Are you sure you want to proceed?</p>`;
        syncModalBody.innerHTML = html;
    }

    // Settings Logic
    document.getElementById('setting-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = document.getElementById('edit-setting-key').value;
        const value = document.getElementById('edit-setting-value').value;

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });

            if (response.status === 200) {
                document.getElementById('setting-modal').style.display = 'none';
                loadSettings();
                // If SONGS_PATH changed, refresh songs
                if (key === 'SONGS_PATH') loadSongs();
                // If UI_REFRESH_INTERVAL changed, update poller
                if (key === 'UI_REFRESH_INTERVAL') window.updateAutoPoll(value);
            }
        } catch (error) {
            alert('Settings update failed: ' + error.message);
        }
    });

    document.getElementById('close-setting-modal').addEventListener('click', () => {
        document.getElementById('setting-modal').style.display = 'none';
    });

    // Search Logic
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filteredMappings = allMappings.filter(m => 
            m.query.toLowerCase().includes(term) ||
            m.intent.toLowerCase().includes(term) ||
            m.song_name.toLowerCase().includes(term) ||
            (m.song_path && m.song_path.toLowerCase().includes(term))
        );
        intentsPage = 1;
        renderIntents();
    });

    // Player Logic
    const closePlayer = document.getElementById('close-player');
    const playerContainer = document.getElementById('player-container');
    const audioPlayer = document.getElementById('audio-player');

    closePlayer.addEventListener('click', () => {
        audioPlayer.pause();
        playerContainer.style.display = 'none';
    });

    // Song Logic
    document.getElementById('song-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-song-id').value;
        const title = document.getElementById('edit-song-title').value;
        const artist = document.getElementById('edit-song-artist').value;
        const album = document.getElementById('edit-song-album').value;

        try {
            const response = await fetch(`/api/songs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, artist, album })
            });

            if (response.ok) {
                document.getElementById('song-modal').style.display = 'none';
                loadSongs();
            } else {
                const err = await response.json();
                alert('Update failed: ' + (err.error || response.statusText));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });

    document.getElementById('close-song-modal').addEventListener('click', () => {
        document.getElementById('song-modal').style.display = 'none';
    });

    // Modal Logic
    document.getElementById('add-intent-btn').addEventListener('click', openAdd);
    
    // Refresh Intents Logic
    const refreshIntentsBtn = document.getElementById('refresh-intents-btn');
    if (refreshIntentsBtn) {
        refreshIntentsBtn.addEventListener('click', () => {
            refreshIntentsBtn.disabled = true;
            refreshIntentsBtn.textContent = 'Refreshing...';
            loadIntents().finally(() => {
                refreshIntentsBtn.disabled = false;
                refreshIntentsBtn.textContent = '🔄 Refresh';
            });
        });
    }

    // Auto-Poll Logic
    let refreshInterval = null;
    window.updateAutoPoll = function(seconds) {
        if (refreshInterval) clearInterval(refreshInterval);
        const ms = (parseInt(seconds) || 30) * 1000;
        console.log(`Setting UI refresh interval to ${ms}ms`);
        refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadIntents();
            }
        }, ms);
    };

    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('edit-modal').style.display = 'none';
    });

    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldQuery = document.getElementById('original-query').value;
        const newQuery = document.getElementById('edit-query').value;
        const intent = document.getElementById('edit-intent').value;
        const songSelect = document.getElementById('edit-song');
        const songId = parseInt(songSelect.value);
        const songName = songSelect.options[songSelect.selectedIndex].text;

        const isAdd = !oldQuery;
        const url = isAdd ? '/api/intents' : `/api/intents/${encodeURIComponent(oldQuery)}`;
        const method = isAdd ? 'POST' : 'PUT';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: newQuery, intent, song_name: songName, song_id: songId })
            });

            if (response.ok) {
                document.getElementById('edit-modal').style.display = 'none';
                loadIntents();
            } else {
                const err = await response.json();
                alert('Action failed: ' + (err.error || response.statusText));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });
});

async function loadSongs() {
    try {
        const response = await fetch('/api/songs');
        const data = await response.json();
        if (Array.isArray(data)) {
            songs = data;
            songsPage = 1; // Reset to page 1 on load
            renderSongs();
            
            // Populate intent mapping dropdown
            const songSelect = document.getElementById('edit-song');
            if (songSelect) {
                songSelect.innerHTML = songs.map(s => 
                    `<option value="${s.id}">${s.title} ${s.artist ? ` - ${s.artist}` : ''}</option>`
                ).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load songs:', error);
    }
}

function renderSongs() {
    const body = document.getElementById('songs-body');
    if (!body) return;

    const start = (songsPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedSongs = songs.slice(start, end);

    body.innerHTML = paginatedSongs.map(s => {
        const titleEscaped = s.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        return `
            <tr>
                <td>${s.title}</td>
                <td>${s.artist || '-'}</td>
                <td>${s.album || '-'}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn-play" onclick="playSong(${s.id}, '${titleEscaped}')" title="Play Preview">▶</button>
                        <button class="btn-primary" onclick="window.openSongEdit(${s.id})" style="padding: 0.5rem 1rem;">Edit</button>
                        <button class="btn-danger" onclick="window.deleteSong(${s.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination('songs-pagination-controls', songs.length, songsPage, 'changeSongsPage');
}

async function openSongEdit(id) {
    const song = songs.find(s => s.id === id);
    if (!song) return;

    document.getElementById('edit-song-id').value = song.id;
    document.getElementById('edit-song-title').value = song.title;
    document.getElementById('edit-song-artist').value = song.artist || '';
    document.getElementById('edit-song-album').value = song.album || '';
    
    document.getElementById('song-modal').style.display = 'block';
}

async function deleteSong(id) {
    if (!confirm('Are you sure you want to delete this song? This will also remove the file.')) return;

    try {
        const response = await fetch(`/api/songs/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadSongs();
        } else {
            const err = await response.json();
            alert('Delete failed: ' + (err.error || response.statusText));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        renderSettings(settings);

        // Initialize or update auto-poll based on setting
        const refreshSetting = settings.find(s => s.key === 'UI_REFRESH_INTERVAL');
        if (refreshSetting && window.updateAutoPoll) {
            window.updateAutoPoll(refreshSetting.value);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

function renderSettings(settings) {
    const body = document.getElementById('settings-body');
    if (!body) return;

    body.innerHTML = settings.map(s => {
        const isSensitive = s.key === 'GEMINI_API_KEY';
        const displayValue = isSensitive ? '••••••••' : s.value;
        const toggleBtn = isSensitive ? `
            <button class="btn-icon" onclick="toggleSettingVisibility(this, '${s.value.replace(/'/g, "\\'")}')" title="Toggle Visibility">👁️</button>
        ` : '';

        return `
            <tr>
                <td><code>${s.key}</code></td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="setting-value">${displayValue}</span>
                        ${toggleBtn}
                    </div>
                </td>
                <td>
                    <button class="btn-primary" onclick="window.openSettingEdit('${s.key}', '${s.value.replace(/\\/g, '\\\\')}')">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.toggleSettingVisibility = function(btn, actualValue) {
    const span = btn.previousElementSibling;
    const isHidden = span.textContent === '••••••••';
    span.textContent = isHidden ? actualValue : '••••••••';
    btn.textContent = isHidden ? '🔒' : '👁️';
};

window.openSettingEdit = function(key, value) {
    document.getElementById('edit-setting-key').value = key;
    document.getElementById('edit-setting-value').value = value;
    document.getElementById('setting-modal').style.display = 'block';
};

async function loadIntentsConfig() {
    try {
        const response = await fetch('/api/config/intents');
        intents = await response.json();
        
        const intentSelect = document.getElementById('edit-intent');
        intentSelect.innerHTML = intents.map(i => 
            `<option value="${i.id}">${i.label}</option>`
        ).join('');
        console.log(`Loaded ${intents.length} intents into config.`);
    } catch (error) {
        console.error('Failed to load intents config:', error);
    }
}

async function loadIntents() {
    try {
        const response = await fetch('/api/intents');
        allMappings = await response.json();
        filteredMappings = [...allMappings];
        renderIntents();
    } catch (error) {
        console.error('Failed to load intents:', error);
    }
}

function renderIntents() {
    const body = document.getElementById('intent-body');
    if (!body) return;

    const start = (intentsPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = filteredMappings.slice(start, end);

    body.innerHTML = paginatedItems.map(m => {
        const queryEscaped = m.query.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        
        return `
            <tr>
                <td>${m.query}</td>
                <td><code>${m.intent}</code></td>
                <td>${m.song_name}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-primary" onclick="window.openEdit('${queryEscaped}', '${m.intent}', ${m.song_id})" style="padding: 0.5rem 1rem;">Edit</button>
                        <button class="btn-danger" onclick="window.deleteIntent('${queryEscaped}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination('pagination-controls', filteredMappings.length, intentsPage, 'changeIntentsPage');
}

function renderPagination(containerId, totalItems, currentPage, changeFuncName) {
    const controls = document.getElementById(containerId);
    if (!controls) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) {
        controls.innerHTML = '';
        return;
    }

    let html = `<button onclick="${changeFuncName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button onclick="${changeFuncName}(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span>...</span>`;
        }
    }

    html += `<button onclick="${changeFuncName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
    controls.innerHTML = html;
}

function changeIntentsPage(page) {
    intentsPage = page;
    renderIntents();
    window.scrollTo({ top: document.getElementById('intent-section').offsetTop - 20, behavior: 'smooth' });
}

function changeSongsPage(page) {
    songsPage = page;
    renderSongs();
    window.scrollTo({ top: document.getElementById('songs-section').offsetTop - 20, behavior: 'smooth' });
}

function playSong(id, title) {
    const playerContainer = document.getElementById('player-container');
    const audioPlayer = document.getElementById('audio-player');
    const playingTitle = document.getElementById('playing-title');

    playingTitle.textContent = `Playing: ${title}`;
    audioPlayer.src = `/stream?id=${id}`;
    playerContainer.style.display = 'flex';
    audioPlayer.play();
}

function openAdd() {
    document.getElementById('modal-title').textContent = 'Add New Mapping';
    document.getElementById('original-query').value = '';
    document.getElementById('edit-query').value = '';
    
    // Ensure dropdowns are populated
    populateDropdowns();
    
    document.getElementById('edit-intent').value = 'play_song';
    document.getElementById('edit-modal').style.display = 'block';
}

function openEdit(query, intent, songId) {
    document.getElementById('modal-title').textContent = 'Edit Mapping';
    document.getElementById('original-query').value = query;
    document.getElementById('edit-query').value = query;
    
    // Ensure dropdowns are populated
    populateDropdowns();
    
    document.getElementById('edit-intent').value = intent;
    document.getElementById('edit-song').value = songId;
    document.getElementById('edit-modal').style.display = 'block';
}

function populateDropdowns() {
    const songSelect = document.getElementById('edit-song');
    if (songSelect.options.length === 0 && songs.length > 0) {
        songSelect.innerHTML = songs.map(s => 
            `<option value="${s.id}">${s.title}</option>`
        ).join('');
    }

    const intentSelect = document.getElementById('edit-intent');
    if (intentSelect.options.length === 0 && intents.length > 0) {
        intentSelect.innerHTML = intents.map(i => 
            `<option value="${i.id}">${i.label}</option>`
        ).join('');
    }
}

async function deleteIntent(query) {
    if (!confirm(`Are you sure you want to delete the mapping for "${query}"?`)) return;

    try {
        const response = await fetch(`/api/intents/${encodeURIComponent(query)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadIntents();
        }
    } catch (error) {
        alert('Delete failed: ' + error.message);
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('upload-status');
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.style.background = type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
    statusDiv.style.color = type === 'success' ? '#10b981' : '#ef4444';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Global functions
window.openAdd = openAdd;
window.openEdit = openEdit;
window.openSongEdit = openSongEdit;
window.deleteIntent = deleteIntent;
window.deleteSong = deleteSong;
window.playSong = playSong;
window.changeIntentsPage = changeIntentsPage;
window.changeSongsPage = changeSongsPage;
