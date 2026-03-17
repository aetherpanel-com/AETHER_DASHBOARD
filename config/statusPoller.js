// Status Poller Manager
// Central polling system for server status updates via WebSocket
// This reduces API calls by polling each server once, regardless of how many users are watching

const { get } = require('./database');
const pterodactyl = require('./pterodactyl');

// Store io instance (set by server.js)
let ioInstance = null;

// Map to track active server subscriptions
// Key: serverId (database ID), Value: { timer, lastData, sockets: Set<socketId>, lastPollTime }
const statusSubscriptions = new Map();

// Polling interval (5 seconds - matches current frontend polling)
const POLL_INTERVAL = 5000;

// Maximum time between polls (prevents stale data)
const MAX_POLL_AGE = 10000; // 10 seconds

/**
 * Fetch server status from Pterodactyl
 * Reuses the same logic as routes/servers.js /api/status/:id endpoint
 */
async function fetchServerStatus(serverId, userId) {
    try {
        // Verify ownership (security check)
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, userId]);
        
        if (!server) {
            return {
                success: false,
                error: 'Server not found or access denied'
            };
        }
        
        // Check if Pterodactyl is configured
        if (!await pterodactyl.isConfigured()) {
            return {
                success: true,
                status: 'unknown',
                message: 'Pterodactyl not configured',
                resources: null
            };
        }
        
        const serverIdentifier = server.pterodactyl_identifier;
        
        if (!serverIdentifier) {
            return {
                success: true,
                status: 'installing',
                message: 'Server identifier not available - server may still be installing',
                resources: null
            };
        }
        
        // Get server resources which includes current state
        // Need to get user's pterodactyl_user_id for Client API access
        const user = await get('SELECT pterodactyl_user_id FROM users WHERE id = ?', [userId]);
        const pterodactylUserId = user?.pterodactyl_user_id;
        
        if (!pterodactylUserId) {
            return {
                success: true,
                status: 'unknown',
                message: 'User not linked to Pterodactyl',
                resources: null
            };
        }
        
        const result = await pterodactyl.getServerResources(serverIdentifier, pterodactylUserId);
        
        if (!result.success) {
            // Handle 409 Conflict (server still installing) gracefully
            if (result.isTransient) {
                return {
                    success: true,
                    status: 'installing',
                    message: result.error || 'Server is still installing. Please wait a moment.',
                    resources: null
                };
            }
            
            return {
                success: true,
                status: 'checking',
                message: result.error || 'Could not fetch server status. Retrying…',
                resources: null
            };
        }
        
        // Extract status from response
        const currentState = result.data?.attributes?.current_state || 
                            result.data?.current_state || 
                            'unknown';
        
        // Also get resource usage if available
        const resources = result.data?.attributes?.resources || result.data?.resources || null;
        
        return {
            success: true,
            status: currentState,
            resources: resources ? {
                cpu_absolute: resources.cpu_absolute,
                memory_bytes: resources.memory_bytes,
                disk_bytes: resources.disk_bytes,
                network_rx_bytes: resources.network_rx_bytes,
                network_tx_bytes: resources.network_tx_bytes,
                uptime: resources.uptime
            } : null
        };
    } catch (error) {
        console.error(`[StatusPoller] Error fetching status for server ${serverId}:`, error);
        return {
            success: false,
            error: error.message || 'Error fetching server status'
        };
    }
}

/**
 * Start polling for a server if not already polling
 */
function ensurePollerForServer(serverId, userId) {
    let entry = statusSubscriptions.get(serverId);
    
    // If poller already exists and is active, return
    if (entry && entry.timer) {
        return;
    }
    
    // Create new entry if needed
    if (!entry) {
        entry = {
            sockets: new Set(),
            lastData: null,
            timer: null,
            lastPollTime: null,
            userId: userId // Store userId for permission checks
        };
        statusSubscriptions.set(serverId, entry);
    }
    
    // Start polling
    entry.timer = setInterval(async () => {
        try {
            const data = await fetchServerStatus(serverId, entry.userId);
            entry.lastData = data;
            entry.lastPollTime = Date.now();
            
            // Phase 3: Broadcast to room instead of individual sockets
            if (ioInstance && data.success) {
                const room = `server:${serverId}`;
                ioInstance.to(room).emit('server_status', {
                    serverId: parseInt(serverId),
                    status: data.status,
                    resources: data.resources
                });
                console.log(`[WebSocket] Status update sent for server ${serverId}: ${data.status}`);
            }
        } catch (error) {
            console.error(`[StatusPoller] Error in poller for server ${serverId}:`, error);
        }
    }, POLL_INTERVAL);
    
    console.log(`[StatusPoller] Started polling for server ${serverId}`);
}

/**
 * Stop polling for a server if no sockets are subscribed
 */
function stopPollerIfNoSubscribers(serverId) {
    const entry = statusSubscriptions.get(serverId);
    if (!entry) return;
    
    if (entry.sockets.size === 0 && entry.timer) {
        clearInterval(entry.timer);
        entry.timer = null;
        statusSubscriptions.delete(serverId);
        console.log(`[StatusPoller] Stopped polling for server ${serverId} (no subscribers)`);
    }
}

/**
 * Subscribe a socket to server status updates
 */
async function subscribeSocketToServer(socketId, serverId, userId) {
    let entry = statusSubscriptions.get(serverId);
    
    if (!entry) {
        entry = {
            sockets: new Set(),
            lastData: null,
            timer: null,
            lastPollTime: null,
            userId: userId
        };
        statusSubscriptions.set(serverId, entry);
    }
    
    // Add socket to subscription set
    entry.sockets.add(socketId);
    
    // Update userId if needed (in case of ownership change)
    entry.userId = userId;
    
    // Start polling if not already active
    ensurePollerForServer(serverId, userId);
    
    // Phase 3: Send cached data immediately if available and fresh (emit to room)
    if (entry.lastData && entry.lastPollTime) {
        const age = Date.now() - entry.lastPollTime;
        if (age < MAX_POLL_AGE) {
            if (ioInstance && entry.lastData.success) {
                const room = `server:${serverId}`;
                ioInstance.to(room).emit('server_status', {
                    serverId: parseInt(serverId),
                    status: entry.lastData.status,
                    resources: entry.lastData.resources
                });
                console.log(`[WebSocket] Status update sent for server ${serverId}: ${entry.lastData.status}`);
            }
        } else {
            // Data is stale, trigger immediate poll
            const data = await fetchServerStatus(serverId, userId);
            entry.lastData = data;
            entry.lastPollTime = Date.now();
            
            if (ioInstance && data.success) {
                const room = `server:${serverId}`;
                ioInstance.to(room).emit('server_status', {
                    serverId: parseInt(serverId),
                    status: data.status,
                    resources: data.resources
                });
                console.log(`[WebSocket] Status update sent for server ${serverId}: ${data.status}`);
            }
        }
    } else {
        // No cached data, fetch immediately
        const data = await fetchServerStatus(serverId, userId);
        entry.lastData = data;
        entry.lastPollTime = Date.now();
        
        if (ioInstance && data.success) {
            const room = `server:${serverId}`;
            ioInstance.to(room).emit('server_status', {
                serverId: parseInt(serverId),
                status: data.status,
                resources: data.resources
            });
            console.log(`[WebSocket] Status update sent for server ${serverId}: ${data.status}`);
        }
    }
    
    console.log(`[StatusPoller] Socket ${socketId} subscribed to server ${serverId}`);
}

/**
 * Unsubscribe a socket from server status updates
 */
function unsubscribeSocketFromServer(socketId, serverId) {
    const entry = statusSubscriptions.get(serverId);
    if (!entry) return;
    
    entry.sockets.delete(socketId);
    console.log(`[StatusPoller] Socket ${socketId} unsubscribed from server ${serverId}`);
    
    // Stop polling if no more subscribers
    stopPollerIfNoSubscribers(serverId);
}

/**
 * Unsubscribe a socket from all servers (called on disconnect)
 */
function unsubscribeSocketFromAll(socketId) {
    for (const [serverId, entry] of statusSubscriptions) {
        if (entry.sockets.has(socketId)) {
            entry.sockets.delete(socketId);
            stopPollerIfNoSubscribers(serverId);
        }
    }
    console.log(`[StatusPoller] Socket ${socketId} unsubscribed from all servers`);
}

/**
 * Initialize the status poller with Socket.IO instance
 * Must be called from server.js after io is created
 */
function initialize(io) {
    ioInstance = io;
}

module.exports = {
    initialize,
    subscribeSocketToServer,
    unsubscribeSocketFromServer,
    unsubscribeSocketFromAll
};
