// Server Management Routes
// Handles server creation, management, and viewing

const express = require('express');
const router = express.Router();
const path = require('path');
const { query, get, run, transaction } = require('../config/database');
const { serverCreationLimiter, purchaseLimiter } = require('../middleware/rateLimit');
const pterodactyl = require('../config/pterodactyl');
const { markStep } = require('./onboarding');
const { getServerHealthTimeline } = require('../config/healthPoller');
const { db } = require('../config/database');
const { sendBrandedView } = require('../config/brandingHelper');
const { writeLog } = require('../utils/auditLog');
const { sanitizePterodactylUsername } = require('../utils/helpers');

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Servers management page
router.get('/', requireAuth, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/servers.html'));
});

// Create server page
router.get('/create', requireAuth, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/servers.html'));
});

// Resource store page
router.get('/store', requireAuth, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/resource-store.html'));
});

// Server details page (real-time stats)
router.get('/view/:id', requireAuth, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/server-details.html'));
});

// API endpoint to get user's servers
router.get('/api/list', requireAuth, async (req, res) => {
    try {
        const servers = await query(
            'SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC',
            [req.session.user.id]
        );
        
        // Fetch public_address for servers that have pterodactyl_id but no public_address
        if (await pterodactyl.isConfigured()) {
            for (const server of servers) {
                if (server.pterodactyl_id && !server.public_address) {
                    try {
                        const serverDetails = await pterodactyl.getServerDetails(server.pterodactyl_id);
                        if (serverDetails.success) {
                            const publicAddress = pterodactyl.extractPublicAddress(serverDetails.data);
                            
                            // Update database if found
                            if (publicAddress) {
                                await run(
                                    'UPDATE servers SET public_address = ? WHERE id = ?',
                                    [publicAddress, server.id]
                                );
                                server.public_address = publicAddress;
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching public_address for server ${server.id}:`, error);
                        // Continue with other servers even if one fails
                    }
                }
            }
        }
        
        // Note: Real-time stats are not available via Application API
        // Users can view real-time stats by clicking "Open in Panel" button
        
        res.json({ success: true, servers });
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ success: false, message: 'Error fetching servers' });
    }
});

// API endpoint to get panel URL
router.get('/api/panel-url', requireAuth, async (req, res) => {
    try {
        const config = await pterodactyl.getConfig();
        res.json({ 
            success: true, 
            panel_url: config.url || null 
        });
    } catch (error) {
        res.json({ success: false, panel_url: null });
    }
});

// Helper function to cleanup server creation resources
async function cleanupServerCreation(serverRecordId, claimedAllocationId) {
    const cleanupErrors = [];
    
    // Delete placeholder server record if it exists
    if (serverRecordId) {
        try {
            await run('DELETE FROM servers WHERE id = ?', [serverRecordId]);
            console.log(`Cleaned up placeholder server record ${serverRecordId}`);
        } catch (error) {
            cleanupErrors.push(`Failed to delete server record: ${error.message}`);
            console.error('Failed to delete placeholder server record:', error);
        }
    }
    
    // Release claimed allocation back to pool if it exists
    if (claimedAllocationId) {
        try {
            await run('UPDATE pterodactyl_allocations SET is_active = 1 WHERE id = ?', [claimedAllocationId]);
            console.log(`Released allocation ${claimedAllocationId} back to pool`);
        } catch (error) {
            cleanupErrors.push(`Failed to release allocation: ${error.message}`);
            console.error('Failed to release allocation:', error);
        }
    }
    
    if (cleanupErrors.length > 0) {
        console.warn('Some cleanup operations failed:', cleanupErrors);
    }
}

// API endpoint to create server
router.post('/api/create', requireAuth, serverCreationLimiter, async (req, res) => {
    let pterodactyl_id = null;
    let claimedAllocationId = null;  // Track claimed allocation for cleanup on error
    let serverRecordId = null; // Track server record ID for rollback if Pterodactyl fails
    
    try {
        const { name, egg_id, ram, cpu, storage } = req.body;
        
        if (!name || !egg_id || ram === undefined || cpu === undefined || storage === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        
        // Validate server name
        if (typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Server name is required' 
            });
        }
        
        if (name.length > 50) {
            return res.status(400).json({ 
                success: false, 
                message: 'Server name must be 50 characters or less' 
            });
        }
        
        // Validate name contains only safe characters (alphanumeric, spaces, hyphens, underscores)
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(name.trim())) {
            return res.status(400).json({ 
                success: false, 
                message: 'Server name contains invalid characters. Only letters, numbers, spaces, hyphens, and underscores are allowed.' 
            });
        }
        
        // Validate minimums (ram and storage are in MB, cpu is percentage)
        const ramGB = ram / 1024;
        const storageGB = storage / 1024;
        
        if (ramGB < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'RAM must be at least 1GB' 
            });
        }
        if (cpu < 100) {
            return res.status(400).json({ 
                success: false, 
                message: 'CPU must be 100%' 
            });
        }
        if (storageGB < 5) {
            return res.status(400).json({ 
                success: false, 
                message: 'Storage must be at least 5GB' 
            });
        }
        
        // BUGFIX: Use transaction to atomically check resources and reserve them
        // This prevents race conditions where multiple concurrent requests could oversell resources
        
        // Atomically check resources and insert server record
        await transaction(async () => {
            // Get user and check available resources (within transaction for consistency)
            const user = await get('SELECT id, server_slots, purchased_ram, purchased_cpu, purchased_storage, pterodactyl_user_id FROM users WHERE id = ?', 
                [req.session.user.id]);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Check server slots (re-check within transaction)
            const userServerCount = await get('SELECT COUNT(*) as count FROM servers WHERE user_id = ?', [req.session.user.id]);
            const availableSlots = user.server_slots || 1;
            
            if (userServerCount.count >= availableSlots) {
                throw new Error(`You've reached your server limit (${availableSlots} slot${availableSlots > 1 ? 's' : ''}). Purchase more slots from the Resource Store to create additional servers.`);
            }
            
            // Calculate used resources (re-check within transaction)
            const usedResources = await get(`
                SELECT 
                    COALESCE(SUM(ram), 0) as used_ram,
                    COALESCE(SUM(cpu), 0) as used_cpu,
                    COALESCE(SUM(storage), 0) as used_storage
                FROM servers 
                WHERE user_id = ?
            `, [req.session.user.id]);
            
            const availableRam = (user.purchased_ram || 0) - (usedResources.used_ram || 0);
            const availableCpu = (user.purchased_cpu || 0) - (usedResources.used_cpu || 0);
            const availableStorage = (user.purchased_storage || 0) - (usedResources.used_storage || 0);
            
            // Check if user has enough resources
            if (availableRam < ram) {
                throw new Error(`Insufficient RAM. You have ${Math.round(availableRam / 1024)}GB available but need ${ramGB}GB.`);
            }
            if (availableCpu < cpu) {
                throw new Error(`Insufficient CPU. You have ${availableCpu}% available but need ${cpu}%.`);
            }
            if (availableStorage < storage) {
                throw new Error(`Insufficient Storage. You have ${Math.round(availableStorage / 1024)}GB available but need ${storageGB}GB.`);
            }
            
            // Insert a placeholder server record to reserve resources atomically
            // This prevents race conditions - resources are reserved immediately
            // If Pterodactyl creation fails later, we'll delete this placeholder
            const result = await run(
                `INSERT INTO servers (user_id, pterodactyl_id, name, ram, cpu, storage) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.session.user.id, null, name, ram, cpu, storage]
            );
            serverRecordId = result.lastID;
        }).catch(async (error) => {
            // Transaction failed - return error
            if (!res.headersSent) {
                return res.status(400).json({ 
                    success: false, 
                    message: error.message || 'Failed to reserve resources for server creation' 
                });
            }
        });
        
        // If transaction failed, we already returned, so exit
        if (res.headersSent) {
            return;
        }
        
        // If Pterodactyl is configured, create server there
        if (await pterodactyl.isConfigured()) {
            try {
                // Get egg information
                const egg = await get('SELECT * FROM pterodactyl_eggs WHERE egg_id = ? AND is_active = 1', [egg_id]);
                if (!egg) {
                    // Delete placeholder server record since validation failed
                    if (serverRecordId) {
                        try {
                            await run('DELETE FROM servers WHERE id = ?', [serverRecordId]);
                        } catch (deleteError) {
                            console.error('Failed to delete placeholder server record:', deleteError);
                        }
                    }
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Selected game type (egg) not found. Please contact an administrator.' 
                    });
                }
                
                // Get settings
                const settings = await get('SELECT * FROM pterodactyl_settings ORDER BY id DESC LIMIT 1');
                const nestId = settings?.default_nest_id || egg.nest_id;
                const locationId = settings?.default_location_id;
                
                // BUGFIX #16: Atomically claim an allocation to prevent race conditions
                // We mark it as inactive immediately, then delete it on success or restore on failure
                // This prevents two concurrent requests from selecting the same allocation
                
                // Step 1: Find an available allocation
                const allocation = await get(`
                    SELECT * FROM pterodactyl_allocations 
                    WHERE is_active = 1 
                    ORDER BY priority DESC, id ASC 
                    LIMIT 1
                `);
                
                if (!allocation) {
                    // Cleanup resources since no allocation available
                    await cleanupServerCreation(serverRecordId, claimedAllocationId);
                    return res.status(400).json({ 
                        success: false, 
                        message: 'No available server allocations. Please contact an administrator.' 
                    });
                }
                
                // Step 2: Atomically claim the allocation by marking it inactive
                // This uses a WHERE clause to ensure we only claim it if it's still active
                const claimResult = await run(
                    'UPDATE pterodactyl_allocations SET is_active = 0 WHERE id = ? AND is_active = 1',
                    [allocation.id]
                );
                
                // If no rows were updated, another request claimed this allocation
                if (claimResult.changes === 0) {
                    // Cleanup resources since allocation was claimed by another request
                    await cleanupServerCreation(serverRecordId, null); // No allocation was claimed
                    return res.status(409).json({ 
                        success: false, 
                        message: 'Server allocation was claimed by another request. Please try again.' 
                    });
                }
                
                // Track the claimed allocation for cleanup if something fails
                claimedAllocationId = allocation.id;
                
                // BUGFIX #9: Parse environment variables properly
                // Handle various formats from Pterodactyl API and database storage
                let environmentVariables = {};
                try {
                    if (egg.environment_variables) {
                        const envVars = JSON.parse(egg.environment_variables);
                        
                        if (Array.isArray(envVars)) {
                            // Format: [{attributes: {env_variable, default_value}}, ...]
                            envVars.forEach(variable => {
                                const attr = variable.attributes || variable;
                                if (attr.env_variable) {
                                    // Use default_value if available, otherwise empty string
                                    // This ensures required variables are always included
                                    environmentVariables[attr.env_variable] = attr.default_value ?? '';
                                }
                            });
                        } else if (typeof envVars === 'object' && envVars !== null) {
                            // Format: {ENV_VAR: "value", ...} (already parsed object)
                            Object.entries(envVars).forEach(([key, value]) => {
                                if (typeof key === 'string' && key.length > 0) {
                                    environmentVariables[key] = value ?? '';
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Error parsing environment variables:', error);
                    // If parsing fails, try to use egg startup defaults or leave empty
                }
                
                // Create server in Pterodactyl
                const pterodactylUser = await get('SELECT pterodactyl_user_id FROM users WHERE id = ?', [req.session.user.id]);
                const pterodactylUserId = pterodactylUser?.pterodactyl_user_id;
                
                if (!pterodactylUserId) {
                    // Cleanup resources since user not found
                    await cleanupServerCreation(serverRecordId, claimedAllocationId);
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Pterodactyl user not found. Please contact an administrator.' 
                    });
                }
                
                // BUGFIX #10: When using a specific allocation, we must NOT use the deploy block
                // The allocation already determines the node. Using both causes conflicts.
                // Also, the nest_id is required for server creation.
                const serverData = {
                    name: name,
                    user: parseInt(pterodactylUserId),
                    nest: parseInt(nestId),  // BUGFIX #10: nest is required
                    egg: parseInt(egg_id),
                    docker_image: egg.docker_image || 'ghcr.io/pterodactyl/yolks:java_17',
                    startup: egg.startup_command || '',
                    environment: environmentVariables,
                    skip_scripts: false,  // Run egg install scripts (important for proper server setup)
                    limits: {
                        memory: ram,
                        swap: 0,
                        disk: storage,
                        io: 500,
                        cpu: cpu
                    },
                    feature_limits: {
                        databases: 0,
                        allocations: 1,
                        backups: 0
                    },
                    allocation: {
                        default: parseInt(allocation.allocation_id)  // Must be integer
                    }
                    // NOTE: Do NOT include 'deploy' block when specifying allocation.default
                    // The allocation already determines which node the server will be on
                };
                
                // Create server in Pterodactyl with timeout protection
                console.log(`Creating server "${name}" in Pterodactyl for user ${req.session.user.id}...`);
                const createResult = await pterodactyl.createServer(serverData);
                
                if (!createResult.success) {
                    const errorMessage = createResult.error?.detail || 
                                       createResult.error?.message || 
                                       (typeof createResult.error === 'string' ? createResult.error : 'Failed to create server in Pterodactyl');
                    
                    console.error('Pterodactyl server creation failed:', errorMessage);
                    
                    // Cleanup resources since Pterodactyl creation failed
                    await cleanupServerCreation(serverRecordId, claimedAllocationId);
                    
                    if (!res.headersSent) {
                        return res.status(500).json({ 
                            success: false, 
                            message: `Failed to create server: ${errorMessage}` 
                        });
                    }
                    return;
                }
                
                pterodactyl_id = createResult.data?.id || createResult.data?.attributes?.id;
                
                // BUGFIX #3: Extract both internal ID and identifier
                // pterodactyl_id = internal numeric ID (for Application API)
                // pterodactyl_identifier = 8-char string (for Client API panel URLs)
                const pterodactyl_identifier = createResult.data?.attributes?.identifier || createResult.data?.identifier || null;
                
                // Extract public_address — prefer cached ip_alias from our allocations table
                let publicAddress = null;
                if (allocation.ip_alias && String(allocation.ip_alias).trim() !== '') {
                    publicAddress = `${String(allocation.ip_alias).trim()}:${allocation.port}`;
                } else if (allocation.ip) {
                    publicAddress = `${allocation.ip}:${allocation.port}`;
                }
                if (!publicAddress && createResult.data) {
                    publicAddress = pterodactyl.extractPublicAddress(createResult.data);
                }
                if (!publicAddress && pterodactyl_id) {
                    try {
                        const serverDetails = await pterodactyl.getServerDetails(pterodactyl_id);
                        if (serverDetails.success) {
                            publicAddress = pterodactyl.extractPublicAddress(serverDetails.data);
                        }
                    } catch (error) {
                        console.error('Error fetching server details for public_address:', error);
                    }
                }
                
                // Update the placeholder server record with Pterodactyl details
                // The server record was already inserted in the transaction above to reserve resources
                await run(
                    `UPDATE servers 
                     SET pterodactyl_id = ?, pterodactyl_identifier = ?, public_address = ? 
                     WHERE id = ?`,
                    [pterodactyl_id, pterodactyl_identifier, publicAddress, serverRecordId]
                );
                
                // BUGFIX #1: Remove the used allocation from the database
                // The allocation is now assigned to this server in Pterodactyl, so it's no longer available
                try {
                    await run('DELETE FROM pterodactyl_allocations WHERE allocation_id = ?', [allocation.allocation_id]);
                    console.log(`Allocation ${allocation.allocation_id} removed from available pool`);
                } catch (allocError) {
                    // Log but don't fail the request - the server was created successfully
                    console.error('Warning: Failed to remove allocation from database:', allocError);
                }
                
                console.log(`Server created successfully: ID ${serverRecordId}, Pterodactyl ID ${pterodactyl_id}`);
                
                if (!res.headersSent) {
                    // Onboarding checklist: created first server
                    try {
                        await markStep(req.session.user.id, 2);
                    } catch (e) {
                        // best-effort only
                    }

                    res.json({ 
                        success: true, 
                        message: 'Server created successfully',
                        server: {
                            id: serverRecordId,
                            name,
                            ram,
                            cpu,
                            storage,
                            pterodactyl_id,
                            pterodactyl_identifier,
                            public_address: publicAddress
                        }
                    });
                    writeLog(
                        req.session.user.id,
                        req.session.user.username,
                        'server_created',
                        `Created server '${name}' (RAM: ${Math.round(ram / 1024)}GB, CPU: ${cpu}%, Storage: ${Math.round(storage / 1024)}GB)`
                    ).catch(() => {});
                }
                return;
            } catch (error) {
                console.error('Error creating server in Pterodactyl:', error);
                console.error('Error stack:', error.stack);
                
                // Cleanup resources on error
                await cleanupServerCreation(serverRecordId, claimedAllocationId);
                
                if (!res.headersSent) {
                    const errorMessage = error.message || 'Unknown error occurred';
                    return res.status(500).json({ 
                        success: false, 
                        message: `Error creating server: ${errorMessage}` 
                    });
                }
                return;
            }
        } else {
            // Pterodactyl is not configured - server record was already inserted in transaction
            // Just return success response
            if (!res.headersSent) {
                    // Onboarding checklist: created first server
                    try {
                        await markStep(req.session.user.id, 2);
                    } catch (e) {
                        // best-effort only
                    }

                res.json({ 
                    success: true, 
                    message: 'Server created successfully',
                    server: {
                        id: serverRecordId,
                        name,
                        ram,
                        cpu,
                        storage,
                        pterodactyl_id: null
                    }
                });
                writeLog(
                    req.session.user.id,
                    req.session.user.username,
                    'server_created',
                    `Created server '${name}' (RAM: ${Math.round(ram / 1024)}GB, CPU: ${cpu}%, Storage: ${Math.round(storage / 1024)}GB)`
                ).catch(() => {});
            }
        }
    } catch (error) {
        console.error('Error creating server:', error);
        console.error('Error stack:', error.stack);
        
        // Cleanup resources on outer catch error (shouldn't happen, but safety net)
        await cleanupServerCreation(serverRecordId, claimedAllocationId);
        
        if (!res.headersSent) {
            const errorMessage = error.message || 'Unknown error occurred';
            res.status(500).json({ 
                success: false, 
                message: `Error creating server: ${errorMessage}` 
            });
        }
    }
});

// API endpoint to delete server
router.delete('/api/delete/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        
        // Get server to verify ownership
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, req.session.user.id]);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Server not found' 
            });
        }
        
        // If Pterodactyl is configured and server has pterodactyl_id, delete it there
        if (await pterodactyl.isConfigured() && server.pterodactyl_id) {
            try {
                await pterodactyl.deleteServer(server.pterodactyl_id);
            } catch (error) {
                console.error('Error deleting server from Pterodactyl:', error);
                // Continue with database deletion even if Pterodactyl deletion fails
            }
        }
        
        // Return resources to user's purchased pool
        const user = await get('SELECT purchased_ram, purchased_cpu, purchased_storage FROM users WHERE id = ?', 
            [req.session.user.id]);
        
        if (user) {
            // Resources are already in purchased pool, we just need to remove them from used
            // Since we're deleting the server, the used resources will automatically decrease
            // But we don't need to do anything here as the resources remain in purchased_ram/cpu/storage
            // The "used" calculation is done dynamically from servers table
        }
        
        // Delete from our database
        await run('DELETE FROM servers WHERE id = ?', [serverId]);
        
        res.json({ 
            success: true, 
            message: 'Server deleted successfully. Resources have been returned to your pool.' 
        });
        writeLog(
            req.session.user.id,
            req.session.user.username,
            'server_deleted',
            `Deleted server '${server.name}'`
        ).catch(() => {});
    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting server' 
        });
    }
});

// Update server resources (RAM/CPU/Storage) and restart
router.post('/api/update-resources/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        const { ram, cpu, storage } = req.body;

        if (ram === undefined || cpu === undefined || storage === undefined) {
            return res.status(400).json({ success: false, message: 'RAM, CPU, and Storage are required' });
        }

        const ramMB = parseInt(ram);
        const cpuPct = parseInt(cpu);
        const storageMB = parseInt(storage);

        if (isNaN(ramMB) || isNaN(cpuPct) || isNaN(storageMB)) {
            return res.status(400).json({ success: false, message: 'Invalid RAM, CPU, or Storage values' });
        }

        if (ramMB < 1024) {
            return res.status(400).json({ success: false, message: 'RAM must be at least 1GB' });
        }
        if (cpuPct < 100) {
            return res.status(400).json({ success: false, message: 'CPU must be at least 100%' });
        }
        if (storageMB < 5120) {
            return res.status(400).json({ success: false, message: 'Storage must be at least 5GB' });
        }

        // Verify ownership and get current server values
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', [serverId, req.session.user.id]);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        // Get user's purchased resources
        const user = await get('SELECT purchased_ram, purchased_cpu, purchased_storage FROM users WHERE id = ?', [req.session.user.id]);

        // Calculate resources used by OTHER servers (exclude current server from sum)
        const otherUsed = await get(`
            SELECT
                COALESCE(SUM(ram), 0)     as used_ram,
                COALESCE(SUM(cpu), 0)     as used_cpu,
                COALESCE(SUM(storage), 0) as used_storage
            FROM servers
            WHERE user_id = ? AND id != ?
        `, [req.session.user.id, serverId]);

        const availableRam     = (user?.purchased_ram     || 0) - (otherUsed?.used_ram     || 0);
        const availableCpu     = (user?.purchased_cpu     || 0) - (otherUsed?.used_cpu     || 0);
        const availableStorage = (user?.purchased_storage || 0) - (otherUsed?.used_storage || 0);

        if (ramMB > availableRam) {
            return res.status(400).json({
                success: false,
                message: `Insufficient RAM. You have ${Math.round(availableRam / 1024)}GB available across your pool.`
            });
        }
        if (cpuPct > availableCpu) {
            return res.status(400).json({
                success: false,
                message: `Insufficient CPU. You have ${availableCpu}% available across your pool.`
            });
        }
        if (storageMB > availableStorage) {
            return res.status(400).json({
                success: false,
                message: `Insufficient Storage. You have ${Math.round(availableStorage / 1024)}GB available across your pool.`
            });
        }

        // Update Pterodactyl if configured and server has an internal ID
        if (await pterodactyl.isConfigured() && server.pterodactyl_id) {
            // Fetch server details to get allocation ID and current feature limits
            const serverDetails = await pterodactyl.getServerDetails(server.pterodactyl_id);
            if (!serverDetails.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch server details from panel'
                });
            }

            const serverAttrs = serverDetails.data?.attributes || serverDetails.data;
            const currentLimits = serverAttrs.limits || {};
            const currentFeatureLimits = serverAttrs.feature_limits || {};

            // Read the primary allocation ID directly from attributes.allocation
            // This is always a flat integer on the attributes object, even when
            // relationships.allocations.data is empty — do NOT use getPrimaryAllocation()
            const allocationId = serverAttrs.allocation;
            if (!allocationId) {
                return res.status(500).json({
                    success: false,
                    message: 'Could not determine server allocation. Please check the Pterodactyl panel.'
                });
            }

            // Call PATCH /application/servers/{id}/build directly with all required fields
            const pteroResult = await pterodactyl.makeRequest(
                'PATCH',
                `/application/servers/${server.pterodactyl_id}/build`,
                {
                    allocation:   parseInt(allocationId),
                    oom_disabled: serverAttrs.oom_disabled ?? false,
                    limits: {
                        memory: ramMB,
                        swap:   currentLimits.swap ?? 0,
                        disk:   storageMB,
                        io:     currentLimits.io   ?? 500,
                        cpu:    cpuPct
                    },
                    feature_limits: {
                        databases:   currentFeatureLimits.databases   ?? 0,
                        allocations: currentFeatureLimits.allocations ?? 1,
                        backups:     currentFeatureLimits.backups      ?? 0
                    }
                }
            );

            if (!pteroResult || !pteroResult.success) {
                console.error('build update failed:', pteroResult);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to update server resources in panel. ' + (pteroResult?.error || '')
                });
            }
        }

        // Update local DB
        await run('UPDATE servers SET ram = ?, cpu = ?, storage = ? WHERE id = ?', [ramMB, cpuPct, storageMB, serverId]);

        // Restart server if it has an identifier (best-effort)
        let restarted = false;
        if (await pterodactyl.isConfigured() && server.pterodactyl_identifier) {
            try {
                const restartResult = await pterodactyl.sendServerPowerSignal(server.pterodactyl_identifier, 'restart');
                restarted = !!(restartResult && restartResult.success);
            } catch (e) {
                console.warn('Restart after resource update failed (non-fatal):', e?.message || e);
            }
        }

        res.json({
            success: true,
            message: restarted
                ? 'Resources updated and server is restarting to apply changes.'
                : 'Resources updated successfully. Restart the server to apply changes.',
            restarted,
            server: { id: serverId, ram: ramMB, cpu: cpuPct, storage: storageMB }
        });
    } catch (error) {
        console.error('update-resources error:', error);
        res.status(500).json({ success: false, message: 'An error occurred while updating resources' });
    }
});

// ============================================
// FEATURE 1: Quick Action Buttons - Power Control
// ============================================

// API endpoint to send power action to server (start, stop, restart, kill)
router.post('/api/power/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        const { action } = req.body;
        
        // Validate action
        const validActions = ['start', 'stop', 'restart', 'kill'];
        if (!action || !validActions.includes(action)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid action. Must be one of: ${validActions.join(', ')}` 
            });
        }
        
        // Verify ownership
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, req.session.user.id]);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Server not found' 
            });
        }
        
        // Check if Pterodactyl is configured
        if (!await pterodactyl.isConfigured()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pterodactyl panel is not configured' 
            });
        }
        
        // Need the server identifier (not internal ID) for Client API
        const serverIdentifier = server.pterodactyl_identifier;
        
        // #region agent log
        console.log('[DEBUG] Power action request:', { serverId, action, serverIdentifier, pterodactylId: server.pterodactyl_id, userPteroId: req.session.user?.pterodactyl_user_id });
        // #endregion
        
        if (!serverIdentifier) {
            // #region agent log
            console.log('[DEBUG] Server identifier missing, checking pterodactyl_id:', server.pterodactyl_id);
            // #endregion
            return res.status(400).json({ 
                success: false, 
                message: 'Server identifier not found. This server may have been created before the identifier system was implemented.' 
            });
        }
        
        // Send power signal via Client API using the global Client API key
        console.log('[DEBUG] Calling sendServerPowerSignal with:', { serverIdentifier, action });
        const result = await pterodactyl.sendServerPowerSignal(serverIdentifier, action);
        console.log('[DEBUG] sendServerPowerSignal result:', result);
        
        if (!result.success) {
            // Handle 409 Conflict (server still installing) with a user-friendly message
            if (result.isTransient) {
                return res.status(409).json({ 
                    success: false, 
                    message: result.error || `Server is still installing. Please wait a moment before trying to ${action} it.`,
                    isTransient: true
                });
            }
            
            return res.status(500).json({ 
                success: false, 
                message: result.error || `Failed to ${action} server` 
            });
        }
        
        // Return success with action performed
        const actionMessages = {
            start: 'Server is starting...',
            stop: 'Server is stopping...',
            restart: 'Server is restarting...',
            kill: 'Server has been force killed'
        };

        res.json({ 
            success: true, 
            message: actionMessages[action],
            action: action
        });
    } catch (error) {
        console.error('Error sending power action:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error sending power action to server' 
        });
    }
});

// ============================================
// FEATURE 4: Send command to server console
// ============================================

// API endpoint to send a command to server console
router.post('/api/command/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        const { command } = req.body;
        
        // Validate command
        if (!command || typeof command !== 'string' || command.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Command is required' 
            });
        }
        
        // Verify ownership
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, req.session.user.id]);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Server not found' 
            });
        }
        
        // Check if Pterodactyl is configured
        if (!await pterodactyl.isConfigured()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pterodactyl panel is not configured' 
            });
        }
        
        const serverIdentifier = server.pterodactyl_identifier;
        
        if (!serverIdentifier) {
            return res.status(400).json({ 
                success: false, 
                message: 'Server identifier not available' 
            });
        }
        
        // Send command
        const result = await pterodactyl.sendServerCommand(serverIdentifier, command.trim());
        
        if (!result.success) {
            // Check if server is offline
            if (result.error?.errors?.[0]?.code === 'HttpException' || 
                result.error?.message?.includes('offline')) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Server must be online to send commands' 
                });
            }
            return res.status(500).json({ 
                success: false, 
                message: result.error || 'Failed to send command' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Command sent successfully'
        });
    } catch (error) {
        console.error('Error sending command:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error sending command to server' 
        });
    }
});

// ============================================
// FEATURE 5: File Manager API Endpoints
// ============================================

// Helper to verify server ownership
async function verifyServerOwnership(req, serverId) {
    const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
        [serverId, req.session.user.id]);
    return server;
}

// List files in directory
router.get('/api/files/:id/list', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const directory = req.query.directory || '/';
        const result = await pterodactyl.listFiles(server.pterodactyl_identifier, directory, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to list files' });
        }
        
        res.json({ success: true, files: result.data?.data || [] });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ success: false, message: 'Error listing files' });
    }
});

// Get file contents
router.get('/api/files/:id/contents', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const filePath = req.query.file;
        if (!filePath) {
            return res.status(400).json({ success: false, message: 'File path is required' });
        }
        
        const result = await pterodactyl.getFileContents(server.pterodactyl_identifier, filePath, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to get file contents' });
        }
        
        // The result.data contains the raw file contents
        res.json({ success: true, content: result.data });
    } catch (error) {
        console.error('Error getting file contents:', error);
        res.status(500).json({ success: false, message: 'Error getting file contents' });
    }
});

// Write/save file
router.post('/api/files/:id/write', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { file, content } = req.body;
        if (!file) {
            return res.status(400).json({ success: false, message: 'File path is required' });
        }
        
        const result = await pterodactyl.writeFile(
            server.pterodactyl_identifier, 
            file, 
            content || '',
            req.session.user.pterodactyl_user_id || null
        );
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to write file' });
        }
        
        res.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        console.error('Error writing file:', error);
        res.status(500).json({ success: false, message: 'Error writing file' });
    }
});

// Accept Minecraft EULA
router.post('/api/eula/:id/accept', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const serverIdentifier = server.pterodactyl_identifier;
        
        // Try to read eula.txt file
        const eulaFile = await pterodactyl.getFileContents(serverIdentifier, '/eula.txt', req.session.user.pterodactyl_user_id || null);
        
        let eulaContent = '';
        let needsUpdate = false;
        
        if (eulaFile.success && eulaFile.data) {
            // File exists, check if EULA is already accepted
            const content = typeof eulaFile.data === 'string' ? eulaFile.data : String(eulaFile.data);
            
            if (content.includes('eula=true')) {
                return res.json({ 
                    success: true, 
                    message: 'EULA already accepted',
                    alreadyAccepted: true
                });
            }
            
            // Replace eula=false with eula=true
            eulaContent = content.replace(/eula\s*=\s*false/gi, 'eula=true');
            
            // If no eula=false found but eula=true also not found, append it
            if (!eulaContent.includes('eula=true')) {
                const lines = eulaContent.split('\n');
                let insertIndex = lines.length;
                
                // Find the last comment line or empty line
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim().startsWith('#') || lines[i].trim() === '') {
                        insertIndex = i + 1;
                        break;
                    }
                }
                
                lines.splice(insertIndex, 0, 'eula=true');
                eulaContent = lines.join('\n');
            }
            
            needsUpdate = true;
        } else {
            // File doesn't exist, create it with eula=true
            eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#${new Date().toISOString()}
eula=true
`;
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            // Write the EULA file
            const writeResult = await pterodactyl.writeFile(
                serverIdentifier, 
                '/eula.txt', 
                eulaContent, 
                req.session.user.pterodactyl_user_id || null
            );
            
            if (!writeResult.success) {
                return res.status(500).json({ 
                    success: false, 
                    message: writeResult.error || 'Failed to write EULA file' 
                });
            }
        }
        
        res.json({ 
            success: true, 
            message: 'EULA accepted successfully' 
        });
    } catch (error) {
        console.error('Error accepting EULA:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error accepting EULA' 
        });
    }
});

// Create directory
router.post('/api/files/:id/create-folder', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { name, root = '/' } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Folder name is required' });
        }
        
        const result = await pterodactyl.createDirectory(server.pterodactyl_identifier, name, root);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to create folder' });
        }
        
        res.json({ success: true, message: 'Folder created successfully' });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ success: false, message: 'Error creating folder' });
    }
});

// Delete files/folders
router.post('/api/files/:id/delete', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { files, root = '/' } = req.body;
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ success: false, message: 'Files to delete are required' });
        }
        
        const result = await pterodactyl.deleteFiles(server.pterodactyl_identifier, root, files);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to delete files' });
        }
        
        res.json({ success: true, message: 'Files deleted successfully' });
    } catch (error) {
        console.error('Error deleting files:', error);
        res.status(500).json({ success: false, message: 'Error deleting files' });
    }
});

// Rename file/folder
router.put('/api/files/:id/rename', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { from, to, root = '/' } = req.body;
        if (!from || !to) {
            return res.status(400).json({ success: false, message: 'From and to names are required' });
        }
        
        const result = await pterodactyl.renameFile(server.pterodactyl_identifier, root, from, to);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to rename' });
        }
        
        res.json({ success: true, message: 'Renamed successfully' });
    } catch (error) {
        console.error('Error renaming:', error);
        res.status(500).json({ success: false, message: 'Error renaming' });
    }
});

// ============================================
// FEATURE 6: Backup System API Endpoints
// ============================================

// List backups
router.get('/api/backups/:id/list', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.listBackups(server.pterodactyl_identifier, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to list backups' });
        }
        
        res.json({ success: true, backups: result.data?.data || [] });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ success: false, message: 'Error listing backups' });
    }
});

// Create backup
router.post('/api/backups/:id/create', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { name, is_locked } = req.body;
        const result = await pterodactyl.createBackup(server.pterodactyl_identifier, name || null, is_locked || false, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            // Check for backup limit error
            if (result.error?.errors?.[0]?.code === 'TooManyRequestsHttpException') {
                return res.status(400).json({ success: false, message: 'Backup limit reached. Delete an old backup first.' });
            }
            return res.status(500).json({ success: false, message: result.error || 'Failed to create backup' });
        }
        
        res.json({ success: true, message: 'Backup creation started', backup: result.data?.attributes });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ success: false, message: 'Error creating backup' });
    }
});

// Delete backup
router.delete('/api/backups/:id/:backupUuid', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.deleteBackup(server.pterodactyl_identifier, req.params.backupUuid, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to delete backup' });
        }
        
        res.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).json({ success: false, message: 'Error deleting backup' });
    }
});

// Get backup download URL
router.get('/api/backups/:id/:backupUuid/download', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.getBackupDownloadUrl(server.pterodactyl_identifier, req.params.backupUuid, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to get download URL' });
        }
        
        res.json({ success: true, url: result.data?.attributes?.url });
    } catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({ success: false, message: 'Error getting download URL' });
    }
});

// Restore backup
router.post('/api/backups/:id/:backupUuid/restore', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { truncate } = req.body;
        const result = await pterodactyl.restoreBackup(server.pterodactyl_identifier, req.params.backupUuid, truncate || false, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to restore backup' });
        }
        
        res.json({ success: true, message: 'Backup restoration started' });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).json({ success: false, message: 'Error restoring backup' });
    }
});

// ============================================
// FEATURE 7: Scheduled Tasks API Endpoints
// ============================================

// List schedules
router.get('/api/schedules/:id/list', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.listSchedules(server.pterodactyl_identifier, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to list schedules' });
        }
        
        res.json({ success: true, schedules: result.data?.data || [] });
    } catch (error) {
        console.error('Error listing schedules:', error);
        res.status(500).json({ success: false, message: 'Error listing schedules' });
    }
});

// Create schedule
router.post('/api/schedules/:id/create', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { name, minute, hour, day_of_month, month, day_of_week, is_active, only_when_online } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Schedule name is required' });
        }
        
        const result = await pterodactyl.createSchedule(
            server.pterodactyl_identifier,
            name,
            minute || '*',
            hour || '*',
            day_of_month || '*',
            month || '*',
            day_of_week || '*',
            is_active !== false,
            only_when_online !== false,
            req.session.user.pterodactyl_user_id
        );
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to create schedule' });
        }
        
        res.json({ success: true, message: 'Schedule created', schedule: result.data?.attributes });
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ success: false, message: 'Error creating schedule' });
    }
});

// Delete schedule
router.delete('/api/schedules/:id/:scheduleId', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.deleteSchedule(server.pterodactyl_identifier, req.params.scheduleId, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to delete schedule' });
        }
        
        res.json({ success: true, message: 'Schedule deleted' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ success: false, message: 'Error deleting schedule' });
    }
});

// Execute schedule now
router.post('/api/schedules/:id/:scheduleId/execute', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.executeSchedule(server.pterodactyl_identifier, req.params.scheduleId, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to execute schedule' });
        }
        
        res.json({ success: true, message: 'Schedule executed' });
    } catch (error) {
        console.error('Error executing schedule:', error);
        res.status(500).json({ success: false, message: 'Error executing schedule' });
    }
});

// Add task to schedule
router.post('/api/schedules/:id/:scheduleId/tasks', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { action, payload, time_offset } = req.body;
        
        if (!action || !payload) {
            return res.status(400).json({ success: false, message: 'Action and payload are required' });
        }
        
        const result = await pterodactyl.createScheduleTask(
            server.pterodactyl_identifier,
            req.params.scheduleId,
            action,
            payload,
            time_offset || 0,
            req.session.user.pterodactyl_user_id
        );
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to create task' });
        }
        
        res.json({ success: true, message: 'Task added', task: result.data?.attributes });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ success: false, message: 'Error creating task' });
    }
});

// ============================================
// FEATURE 8: Database Management API Endpoints
// ============================================

// List databases
router.get('/api/databases/:id/list', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.listDatabases(server.pterodactyl_identifier, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to list databases' });
        }
        
        res.json({ success: true, databases: result.data?.data || [] });
    } catch (error) {
        console.error('Error listing databases:', error);
        res.status(500).json({ success: false, message: 'Error listing databases' });
    }
});

// Create database
router.post('/api/databases/:id/create', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const { database, remote } = req.body;
        
        if (!database) {
            return res.status(400).json({ success: false, message: 'Database name is required' });
        }
        
        // Validate database name (alphanumeric and underscores only)
        if (!/^[a-zA-Z0-9_]+$/.test(database)) {
            return res.status(400).json({ success: false, message: 'Database name can only contain letters, numbers, and underscores' });
        }
        
        const result = await pterodactyl.createDatabase(server.pterodactyl_identifier, database, remote || '%', req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            if (result.error?.errors?.[0]?.code === 'TooManyRequestsHttpException') {
                return res.status(400).json({ success: false, message: 'Database limit reached' });
            }
            return res.status(500).json({ success: false, message: result.error || 'Failed to create database' });
        }
        
        res.json({ success: true, message: 'Database created', database: result.data?.attributes });
    } catch (error) {
        console.error('Error creating database:', error);
        res.status(500).json({ success: false, message: 'Error creating database' });
    }
});

// Rotate database password
router.post('/api/databases/:id/:databaseId/rotate', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.rotateDatabasePassword(server.pterodactyl_identifier, req.params.databaseId, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to rotate password' });
        }
        
        res.json({ success: true, message: 'Password rotated', database: result.data?.attributes });
    } catch (error) {
        console.error('Error rotating password:', error);
        res.status(500).json({ success: false, message: 'Error rotating password' });
    }
});

// Delete database
router.delete('/api/databases/:id/:databaseId', requireAuth, async (req, res) => {
    try {
        const server = await verifyServerOwnership(req, req.params.id);
        if (!server) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }
        
        if (!server.pterodactyl_identifier) {
            return res.status(400).json({ success: false, message: 'Server identifier not available' });
        }
        
        const result = await pterodactyl.deleteDatabase(server.pterodactyl_identifier, req.params.databaseId, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error || 'Failed to delete database' });
        }
        
        res.json({ success: true, message: 'Database deleted' });
    } catch (error) {
        console.error('Error deleting database:', error);
        res.status(500).json({ success: false, message: 'Error deleting database' });
    }
});

// API endpoint to get server status (running, offline, starting, stopping)
router.get('/api/status/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        
        // Verify ownership
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, req.session.user.id]);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Server not found' 
            });
        }
        
        // Check if Pterodactyl is configured
        if (!await pterodactyl.isConfigured()) {
            return res.json({ 
                success: true, 
                status: 'unknown',
                message: 'Pterodactyl not configured'
            });
        }
        
        const serverIdentifier = server.pterodactyl_identifier;
        
        if (!serverIdentifier) {
            return res.json({ 
                success: true, 
                status: 'installing',
                message: 'Server identifier not available - server may still be installing'
            });
        }
        
        // Get server resources which includes current state
        const result = await pterodactyl.getServerResources(serverIdentifier, req.session.user.pterodactyl_user_id);
        
        if (!result.success) {
            // Handle 409 Conflict (server still installing) gracefully
            if (result.isTransient) {
                return res.json({ 
                    success: true, 
                    status: 'installing',
                    message: result.error || 'Server is still installing. Please wait a moment.'
                });
            }
            
            return res.json({ 
                success: true, 
                status: 'checking',
                message: result.error || 'Could not fetch server status. Retrying…'
            });
        }
        
        // Extract status from response
        const currentState = result.data?.attributes?.current_state || 
                            result.data?.current_state || 
                            'unknown';
        
        // Also get resource usage if available
        const resources = result.data?.attributes?.resources || result.data?.resources || null;
        
        res.json({ 
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
        });
    } catch (error) {
        console.error('Error getting server status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error getting server status' 
        });
    }
});

// API endpoint to get live resource usage warnings
// Used for lightweight warnings on the servers list page.
router.get('/api/resource-warning/:serverId', requireAuth, async (req, res) => {
    try {
        const serverId = parseInt(req.params.serverId, 10);
        if (!serverId) {
            return res.status(400).json({ success: false, warnings: [] });
        }

        // Verify ownership
        const server = await get(
            'SELECT id, ram, cpu, storage, pterodactyl_identifier FROM servers WHERE id = ? AND user_id = ?',
            [serverId, req.session.user.id]
        );

        if (!server) {
            return res.status(404).json({ success: false, warnings: [] });
        }

        // If Pterodactyl is not configured, return empty (no error).
        const configured = await pterodactyl.isConfigured();
        if (!configured) {
            return res.json({ success: true, warnings: [] });
        }

        const serverIdentifier = server.pterodactyl_identifier;
        if (!serverIdentifier) {
            return res.json({ success: true, warnings: [] });
        }

        const pteroUserId = req.session.user?.pterodactyl_user_id || null;
        if (!pteroUserId) {
            return res.json({ success: true, warnings: [] });
        }

        const result = await pterodactyl.getServerResources(serverIdentifier, pteroUserId);

        if (!result?.success || result.isTransient) {
            return res.json({ success: true, warnings: [] });
        }

        const resources =
            result.data?.attributes?.resources ||
            result.data?.resources ||
            null;

        const memoryBytes = resources?.memory_bytes;
        const cpuAbsolute = resources?.cpu_absolute;
        const diskBytes = resources?.disk_bytes;

        // Ensure we have a usable payload.
        if (
            typeof memoryBytes !== 'number' &&
            typeof cpuAbsolute !== 'number' &&
            typeof diskBytes !== 'number'
        ) {
            return res.json({ success: true, warnings: [] });
        }

        const warnings = [];

        const thresholds = [
            { min: 90, level: 'critical' },
            { min: 80, level: 'warning' }
        ];

        const pushWarning = (type, pct) => {
            if (!Number.isFinite(pct)) return;
            const level =
                pct >= 90 ? 'critical' :
                pct >= 80 ? 'warning' :
                null;
            if (!level) return;
            warnings.push({ type, level, pct: Math.round(pct) });
        };

        // RAM: server.ram is stored in MB
        if (typeof memoryBytes === 'number' && server.ram > 0) {
            const ramPct = (memoryBytes / (server.ram * 1024 * 1024)) * 100;
            pushWarning('ram', ramPct);
        }

        // CPU: cpu_absolute is compared against server.cpu (configured as %)
        if (typeof cpuAbsolute === 'number' && server.cpu > 0) {
            const cpuPct = (cpuAbsolute / server.cpu) * 100;
            pushWarning('cpu', cpuPct);
        }

        // Disk: server.storage is stored in MB
        if (typeof diskBytes === 'number' && server.storage > 0) {
            const diskPct = (diskBytes / (server.storage * 1024 * 1024)) * 100;
            pushWarning('disk', diskPct);
        }

        return res.json({ success: true, warnings });
    } catch (error) {
        // Requirement: don't error for “unavailable resources”; return empty warnings.
        console.error('Error fetching resource warnings:', error);
        return res.json({ success: true, warnings: [] });
    }
});

// API endpoint to get server health timeline snapshots
router.get('/api/health-timeline/:serverId', requireAuth, async (req, res) => {
    try {
        const serverId = parseInt(req.params.serverId, 10);
        if (!serverId) {
            return res.status(400).json({ success: false, message: 'Invalid server ID' });
        }

        // Verify ownership
        const owned = await get(
            'SELECT id FROM servers WHERE id = ? AND user_id = ?',
            [serverId, req.session.user.id]
        );

        if (!owned) {
            return res.status(404).json({ success: false, message: 'Server not found' });
        }

        const timeline = await getServerHealthTimeline(serverId, 24);
        res.json({ success: true, timeline });
    } catch (error) {
        console.error('Error fetching health timeline:', error);
        res.status(500).json({ success: false, message: 'Error fetching health timeline' });
    }
});

// REMOVED FOR V1: Upgrade and Sync endpoints removed for production stability
// These features have been fully removed from the codebase

// REMOVED FOR V1: Sync endpoint removed for production stability
// API endpoint to sync server resources from Pterodactyl to dashboard - FULLY REMOVED

// ============================================
// FEATURE 3: Server Details API
// ============================================

// API endpoint to get server details (for server details page)
router.get('/api/details/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        
        // Verify ownership
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, req.session.user.id]);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Server not found' 
            });
        }

        // Onboarding checklist: visited server details
        try {
            await markStep(req.session.user.id, 3);
        } catch (e) {
            // best-effort only
        }
        
        res.json({ 
            success: true, 
            server: server
        });
    } catch (error) {
        console.error('Error getting server details:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error getting server details' 
        });
    }
});

// API endpoint to resolve and cache public address for a server
router.get('/api/resolve-address/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        
        // Verify ownership
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, req.session.user.id]);
        
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }
        
        // If already stored, return it directly
        if (server.public_address) {
            return res.json({
                success: true,
                public_address: server.public_address
            });
        }
        
        // Need Pterodactyl configured and an ID to resolve address
        if (!server.pterodactyl_id || !await pterodactyl.isConfigured()) {
            return res.json({
                success: false,
                public_address: null
            });
        }
        
        let publicAddress = null;
        try {
            const serverDetails = await pterodactyl.getServerDetails(server.pterodactyl_id);
            if (serverDetails.success) {
                const serverAttrs = serverDetails.data?.attributes || serverDetails.data;
                const primaryAllocationId = serverAttrs?.allocation;
                if (primaryAllocationId != null && primaryAllocationId !== '') {
                    const aid = parseInt(String(primaryAllocationId), 10);
                    const localAlloc = !Number.isNaN(aid)
                        ? await get('SELECT * FROM pterodactyl_allocations WHERE allocation_id = ?', [aid])
                        : await get('SELECT * FROM pterodactyl_allocations WHERE allocation_id = ?', [primaryAllocationId]);
                    if (localAlloc) {
                        const address = (localAlloc.ip_alias && String(localAlloc.ip_alias).trim() !== '')
                            ? String(localAlloc.ip_alias).trim()
                            : localAlloc.ip;
                        publicAddress = `${address}:${localAlloc.port}`;
                    } else {
                        publicAddress = pterodactyl.extractPublicAddress(serverDetails.data);
                    }
                } else {
                    publicAddress = pterodactyl.extractPublicAddress(serverDetails.data);
                }
            }
        } catch (error) {
            console.error('Error resolving server address:', error);
        }
        
        if (publicAddress) {
            await run(
                'UPDATE servers SET public_address = ? WHERE id = ?',
                [publicAddress, server.id]
            );
        }
        
        res.json({
            success: true,
            public_address: publicAddress || null
        });
    } catch (error) {
        console.error('Error resolving server address:', error);
        res.json({
            success: false,
            public_address: null
        });
    }
});

// API endpoint to get server statistics
router.get('/api/stats/:id', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.id;
        
        // Verify ownership
        const server = await get('SELECT * FROM servers WHERE id = ? AND user_id = ?', 
            [serverId, req.session.user.id]);
        
        if (!server) {
            return res.status(404).json({ 
                success: false, 
                message: 'Server not found' 
            });
        }
        
        // Note: Real-time statistics are not available via Application API
        // The /application/servers/{id}/resources endpoint only supports DELETE
        // Real-time stats require Client API which needs server owner's API key
        // Users should use "Open in Panel" button to view real-time stats
        
        // Return server info - stats will be null, frontend will show Panel button
        res.json({ 
            success: true, 
            server: server,
            stats: null
        });
    } catch (error) {
        console.error('Error fetching server stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching server statistics' 
        });
    }
});

// API endpoint to purchase resources
router.post('/api/purchase-resource', requireAuth, purchaseLimiter, async (req, res) => {
    try {
        const { resource_type, amount } = req.body;
        
        if (!resource_type || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Resource type and amount are required' 
            });
        }
        
        if (!['ram', 'cpu', 'storage'].includes(resource_type)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid resource type' 
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Amount must be greater than 0' 
            });
        }
        
        // Get current prices from database
        const prices = await get('SELECT * FROM resource_prices ORDER BY id DESC LIMIT 1');
        if (!prices) {
            return res.status(500).json({ 
                success: false, 
                message: 'Resource prices not configured. Please contact an administrator.' 
            });
        }
        
        // Calculate cost based on resource type and database prices
        // Formula: cost = (requested_amount / units_per_set) * coins_per_set
        // Note: For RAM and Storage, amount is in GB from frontend
        let coinsSpent = 0;
        switch(resource_type) {
            case 'ram':
                // Amount is in GB from frontend, calculate cost in GB
                const ramCoinsPerSet = prices.ram_coins_per_set || 1;
                const ramGBPerSet = prices.ram_gb_per_set || 1;
                coinsSpent = Math.ceil((amount / ramGBPerSet) * ramCoinsPerSet);
                break;
            case 'cpu':
                const cpuCoinsPerSet = prices.cpu_coins_per_set || 1;
                const cpuPercentPerSet = prices.cpu_percent_per_set || 1;
                coinsSpent = Math.ceil((amount / cpuPercentPerSet) * cpuCoinsPerSet);
                break;
            case 'storage':
                // Amount is in GB from frontend, calculate cost in GB
                const storageCoinsPerSet = prices.storage_coins_per_set || 1;
                const storageGBPerSet = prices.storage_gb_per_set || 1;
                coinsSpent = Math.ceil((amount / storageGBPerSet) * storageCoinsPerSet);
                break;
        }
        
        // BUGFIX: Use transaction to atomically check coins, deduct coins, and add resources
        // This prevents race conditions where multiple concurrent requests could overspend coins
        let resourceAmountMB = 0; // For recording purchase
        let updatedUser = null;
        
        // Determine resource amount in MB (for recording)
        switch(resource_type) {
            case 'ram':
                // Convert GB to MB for database storage (purchased_ram stores in MB)
                resourceAmountMB = amount * 1024;
                break;
            case 'cpu':
                // CPU is stored as percentage (0-100)
                resourceAmountMB = amount; // For recording, but it's actually percentage
                break;
            case 'storage':
                // Convert GB to MB for database storage (purchased_storage stores in MB)
                resourceAmountMB = amount * 1024;
                break;
        }
        
        // Atomically check coins, deduct coins, and add resources in a transaction
        await transaction(async () => {
            // Re-check user coins within transaction (for consistency)
            const user = await get('SELECT coins, purchased_ram, purchased_cpu, purchased_storage FROM users WHERE id = ?', 
                [req.session.user.id]);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Check resource limits (0 = unlimited)
            const limits = await get('SELECT max_ram_gb, max_cpu_percent, max_storage_gb FROM resource_prices ORDER BY id DESC LIMIT 1');

            if (limits) {
                if (resource_type === 'ram' && limits.max_ram_gb > 0) {
                    const currentRamGb = (user.purchased_ram || 0) / 1024;
                    if (currentRamGb + amount > limits.max_ram_gb) {
                        const remaining = Math.max(0, limits.max_ram_gb - currentRamGb);
                        throw new Error(`Purchase would exceed the RAM limit of ${limits.max_ram_gb}GB. You can purchase up to ${remaining.toFixed(1)}GB more.`);
                    }
                }
                if (resource_type === 'cpu' && limits.max_cpu_percent > 0) {
                    const currentCpu = user.purchased_cpu || 0;
                    if (currentCpu + amount > limits.max_cpu_percent) {
                        const remaining = Math.max(0, limits.max_cpu_percent - currentCpu);
                        throw new Error(`Purchase would exceed the CPU limit of ${limits.max_cpu_percent}%. You can purchase up to ${remaining}% more.`);
                    }
                }
                if (resource_type === 'storage' && limits.max_storage_gb > 0) {
                    const currentStorageGb = (user.purchased_storage || 0) / 1024;
                    if (currentStorageGb + amount > limits.max_storage_gb) {
                        const remaining = Math.max(0, limits.max_storage_gb - currentStorageGb);
                        throw new Error(`Purchase would exceed the storage limit of ${limits.max_storage_gb}GB. You can purchase up to ${remaining.toFixed(1)}GB more.`);
                    }
                }
            }
            
            if (user.coins < coinsSpent) {
                throw new Error(`Insufficient coins. You need ${coinsSpent} coins but only have ${user.coins}`);
            }
            
            // Update user's purchased resources and deduct coins atomically
            // Use WHERE clause to ensure coins are still sufficient at update time
            let updateQuery = '';
            let updateParams = [];
            
            switch(resource_type) {
                case 'ram':
                    // Convert GB to MB for database storage (purchased_ram stores in MB)
                    updateQuery = 'UPDATE users SET purchased_ram = purchased_ram + ?, coins = coins - ? WHERE id = ? AND coins >= ?';
                    updateParams = [resourceAmountMB, coinsSpent, req.session.user.id, coinsSpent];
                    break;
                case 'cpu':
                    // CPU is stored as percentage (0-100)
                    updateQuery = 'UPDATE users SET purchased_cpu = purchased_cpu + ?, coins = coins - ? WHERE id = ? AND coins >= ?';
                    updateParams = [amount, coinsSpent, req.session.user.id, coinsSpent];
                    break;
                case 'storage':
                    // Convert GB to MB for database storage (purchased_storage stores in MB)
                    updateQuery = 'UPDATE users SET purchased_storage = purchased_storage + ?, coins = coins - ? WHERE id = ? AND coins >= ?';
                    updateParams = [resourceAmountMB, coinsSpent, req.session.user.id, coinsSpent];
                    break;
            }
            
            const updateResult = await run(updateQuery, updateParams);
            
            // If no rows were updated, coins were insufficient (another request may have spent them)
            if (updateResult.changes === 0) {
                throw new Error(`Insufficient coins. Another transaction may have spent your coins. Please refresh and try again.`);
            }
            
            // Record purchase within the same transaction
            await run(
                `INSERT INTO resource_purchases (user_id, server_id, resource_type, amount, coins_spent) 
                 VALUES (?, ?, ?, ?, ?)`,
                [req.session.user.id, null, resource_type, resourceAmountMB, coinsSpent]
            );
            
            // Get updated user data within transaction
            updatedUser = await get('SELECT coins, purchased_ram, purchased_cpu, purchased_storage FROM users WHERE id = ?', 
                [req.session.user.id]);
        }).catch((error) => {
            // Transaction failed - return error
            if (!res.headersSent) {
                return res.status(400).json({ 
                    success: false, 
                    message: error.message || 'Failed to purchase resource' 
                });
            }
        });
        
        // If transaction failed, we already returned, so exit
        if (res.headersSent || !updatedUser) {
            return;
        }
        
        // Update session
        req.session.user.coins = updatedUser.coins;

        // Onboarding checklist: purchased first resources
        try {
            await markStep(req.session.user.id, 1);
        } catch (e) {
            // best-effort only
        }
        
        res.json({ 
            success: true, 
            message: 'Resource purchased successfully',
            coins_spent: coinsSpent,
            new_balance: updatedUser.coins,
            purchased_resources: {
                ram: updatedUser.purchased_ram,
                cpu: updatedUser.purchased_cpu,
                storage: updatedUser.purchased_storage
            }
        });
        if (resource_type === 'ram') {
            writeLog(
                req.session.user.id,
                req.session.user.username,
                'coins_spent_resource',
                `Purchased ${amount}GB RAM for ${coinsSpent} coins`
            ).catch(() => {});
        } else if (resource_type === 'cpu') {
            writeLog(
                req.session.user.id,
                req.session.user.username,
                'coins_spent_resource',
                `Purchased ${amount}% CPU for ${coinsSpent} coins`
            ).catch(() => {});
        } else if (resource_type === 'storage') {
            writeLog(
                req.session.user.id,
                req.session.user.username,
                'coins_spent_resource',
                `Purchased ${amount}GB Storage for ${coinsSpent} coins`
            ).catch(() => {});
        }
    } catch (error) {
        console.error('Error purchasing resource:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error purchasing resource' 
        });
    }
});

// API endpoint to purchase server slot
router.post('/api/purchase-slot', requireAuth, purchaseLimiter, async (req, res) => {
    try {
        // Get current prices from database
        const prices = await get('SELECT * FROM resource_prices ORDER BY id DESC LIMIT 1');
        if (!prices || !prices.server_slot_price) {
            return res.status(500).json({ 
                success: false, 
                message: 'Server slot price not configured. Please contact an administrator.' 
            });
        }
        
        const slotPrice = prices.server_slot_price;
        
        // BUGFIX: Use transaction to atomically check coins, deduct coins, add slot, and record purchase
        // This prevents race conditions where multiple concurrent requests could overspend coins
        // or where the purchase record insertion fails after coins are deducted
        let updatedUser = null;
        
        // Atomically check coins, deduct coins, add slot, and record purchase in a transaction
        await transaction(async () => {
            // Re-check user coins within transaction (for consistency)
            const user = await get('SELECT coins, server_slots FROM users WHERE id = ?', [req.session.user.id]);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Check server slot limit (0 = unlimited)
            const slotLimits = await get('SELECT max_server_slots FROM resource_prices ORDER BY id DESC LIMIT 1');
            if (slotLimits && slotLimits.max_server_slots > 0) {
                if ((user.server_slots || 1) >= slotLimits.max_server_slots) {
                    throw new Error(`You have reached the maximum server slot limit of ${slotLimits.max_server_slots}. Contact an administrator to increase your limit.`);
                }
            }
            
            if (user.coins < slotPrice) {
                throw new Error(`Insufficient coins. You need ${slotPrice} coins to purchase a server slot. You currently have ${user.coins} coins.`);
            }
            
            // Deduct coins and add server slot atomically
            // Use WHERE clause to ensure coins are still sufficient at update time
            const updateResult = await run(
                'UPDATE users SET coins = coins - ?, server_slots = server_slots + 1 WHERE id = ? AND coins >= ?',
                [slotPrice, req.session.user.id, slotPrice]
            );
            
            // If no rows were updated, coins were insufficient (another request may have spent them)
            if (updateResult.changes === 0) {
                throw new Error(`Insufficient coins. Another transaction may have spent your coins. Please refresh and try again.`);
            }
            
            // Record the purchase within the same transaction
            // If this fails, the entire transaction will rollback (coins won't be deducted)
            await run(
                'INSERT INTO server_slot_purchases (user_id, coins_spent) VALUES (?, ?)',
                [req.session.user.id, slotPrice]
            );
            
            // Get updated user data within transaction
            updatedUser = await get('SELECT coins, server_slots FROM users WHERE id = ?', [req.session.user.id]);
        }).catch((error) => {
            // Transaction failed - return error
            if (!res.headersSent) {
                return res.status(400).json({ 
                    success: false, 
                    message: error.message || 'Failed to purchase server slot' 
                });
            }
        });
        
        // If transaction failed, we already returned, so exit
        if (res.headersSent || !updatedUser) {
            return;
        }
        
        // Update session
        req.session.user.coins = updatedUser.coins;
        req.session.user.server_slots = updatedUser.server_slots;
        
        res.json({ 
            success: true, 
            message: 'Server slot purchased successfully!',
            coins_spent: slotPrice,
            new_balance: updatedUser.coins,
            new_slots: updatedUser.server_slots
        });
        writeLog(
            req.session.user.id,
            req.session.user.username,
            'coins_spent_slot',
            `Purchased 1 server slot for ${slotPrice} coins`
        ).catch(() => {});
    } catch (error) {
        console.error('Error purchasing server slot:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error purchasing server slot' 
        });
    }
});

// API endpoint to get purchase history
router.get('/api/purchase-history', requireAuth, async (req, res) => {
    try {
        const purchases = await query(
            `SELECT rp.*, s.name as server_name 
             FROM resource_purchases rp 
             LEFT JOIN servers s ON rp.server_id = s.id 
             WHERE rp.user_id = ? 
             ORDER BY rp.purchased_at DESC 
             LIMIT 50`,
            [req.session.user.id]
        );
        
        res.json({ success: true, purchases });
    } catch (error) {
        console.error('Error fetching purchase history:', error);
        res.status(500).json({ success: false, message: 'Error fetching purchase history' });
    }
});

// API endpoint to get resource prices (for resource store page)
router.get('/api/resource-prices', requireAuth, async (req, res) => {
    try {
        const prices = await get('SELECT * FROM resource_prices ORDER BY id DESC LIMIT 1');
        if (!prices) {
            // Return default prices if not configured
            return res.json({ 
                success: true, 
                prices: {
                    ram_coins_per_set: 1,
                    ram_gb_per_set: 1,
                    cpu_coins_per_set: 1,
                    cpu_percent_per_set: 1,
                    storage_coins_per_set: 1,
                    storage_gb_per_set: 1,
                    server_slot_price: 100
                }
            });
        }
        res.json({ success: true, prices });
    } catch (error) {
        console.error('Error fetching resource prices:', error);
        res.status(500).json({ success: false, message: 'Error fetching prices' });
    }
});

// API endpoint to get available eggs
router.get('/api/eggs', requireAuth, async (req, res) => {
    try {
        const eggs = await query('SELECT * FROM pterodactyl_eggs WHERE is_active = 1 ORDER BY name');
        res.json({ success: true, eggs });
    } catch (error) {
        console.error('Error fetching eggs:', error);
        res.status(500).json({ success: false, message: 'Error fetching eggs' });
    }
});

// ============================================
// FEATURE 2: Server Templates - Public Endpoints
// ============================================

// API endpoint to get active server templates (for users)
router.get('/api/templates', requireAuth, async (req, res) => {
    try {
        // Join with eggs table to get egg name
        const templates = await query(`
            SELECT t.*, e.name as egg_name, e.nest_id
            FROM server_templates t
            LEFT JOIN pterodactyl_eggs e ON t.egg_id = e.egg_id
            WHERE t.is_active = 1
            ORDER BY t.display_order ASC, t.created_at DESC
        `);
        res.json({ success: true, templates: templates || [] });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, message: 'Error fetching templates' });
    }
});

// API endpoint to create server from template
router.post('/api/create-from-template', requireAuth, async (req, res) => {
    try {
        const { template_id, server_name } = req.body;
        
        if (!template_id) {
            return res.status(400).json({ success: false, message: 'Template ID is required' });
        }
        
        // Fetch the template
        const template = await get(`
            SELECT t.*, e.nest_id, e.environment_variables
            FROM server_templates t
            LEFT JOIN pterodactyl_eggs e ON t.egg_id = e.egg_id
            WHERE t.id = ? AND t.is_active = 1
        `, [template_id]);
        
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found or inactive' });
        }
        
        // Use template name if no custom name provided
        const finalServerName = server_name?.trim() || `${template.name} Server`;
        
        // Get user's resources
        const user = await get(
            'SELECT purchased_ram, purchased_cpu, purchased_storage, server_slots FROM users WHERE id = ?',
            [req.session.user.id]
        );
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Calculate used resources
        const usedResources = await get(`
            SELECT COALESCE(SUM(ram), 0) as used_ram, 
                   COALESCE(SUM(cpu), 0) as used_cpu, 
                   COALESCE(SUM(storage), 0) as used_storage,
                   COUNT(*) as server_count
            FROM servers WHERE user_id = ?
        `, [req.session.user.id]);
        
        const availableRam = user.purchased_ram - (usedResources?.used_ram || 0);
        const availableCpu = user.purchased_cpu - (usedResources?.used_cpu || 0);
        const availableStorage = user.purchased_storage - (usedResources?.used_storage || 0);
        const availableSlots = user.server_slots - (usedResources?.server_count || 0);
        
        // Check server slots
        if (availableSlots <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No server slots available. Purchase more slots in the store.' 
            });
        }
        
        // Check resources
        if (template.ram_mb > availableRam) {
            return res.status(400).json({ 
                success: false, 
                message: `Not enough RAM. Need ${template.ram_mb}MB, have ${availableRam}MB available.` 
            });
        }
        if (template.cpu_percent > availableCpu) {
            return res.status(400).json({ 
                success: false, 
                message: `Not enough CPU. Need ${template.cpu_percent}%, have ${availableCpu}% available.` 
            });
        }
        if (template.storage_mb > availableStorage) {
            return res.status(400).json({ 
                success: false, 
                message: `Not enough storage. Need ${template.storage_mb}MB, have ${availableStorage}MB available.` 
            });
        }
        
        // Forward to the existing create server logic
        // Construct internal request to reuse existing server creation code
        req.body = {
            name: finalServerName,
            egg_id: template.egg_id,
            ram: template.ram_mb,
            cpu: template.cpu_percent,
            storage: template.storage_mb,
            from_template: true
        };
        
        // Call the existing server creation logic
        // This is a workaround - ideally we'd refactor to share logic
        // For now, we redirect to the create endpoint logic
        const createServerHandler = router.stack.find(r => 
            r.route && r.route.path === '/api/create' && r.route.methods.post
        );
        
        // Just call the create endpoint directly via fetch to reuse logic
        // Actually, let's duplicate the essential logic for templates
        
        // Check Pterodactyl configuration
        if (!await pterodactyl.isConfigured()) {
            return res.status(400).json({ success: false, message: 'Pterodactyl is not configured' });
        }
        
        // Get egg details
        const egg = await get('SELECT * FROM pterodactyl_eggs WHERE egg_id = ?', [template.egg_id]);
        if (!egg) {
            return res.status(400).json({ success: false, message: 'Template egg not found in database' });
        }
        
        // Get user's Pterodactyl user ID
        let pteroUserId = req.session.user.pterodactyl_user_id;
        
        if (!pteroUserId) {
            // Try to get from database
            const dbUser = await get('SELECT pterodactyl_user_id FROM users WHERE id = ?', [req.session.user.id]);
            if (dbUser?.pterodactyl_user_id) {
                pteroUserId = dbUser.pterodactyl_user_id;
                req.session.user.pterodactyl_user_id = pteroUserId;
            } else {
                // Create Pterodactyl user
                const originalUsername = req.session.user.username;
                const pteroUsername = sanitizePterodactylUsername(originalUsername);
                if (pteroUsername !== originalUsername) {
                    console.warn(`[Pterodactyl] Username sanitized: "${originalUsername}" -> "${pteroUsername}"`);
                }
                const userResult = await pterodactyl.createPterodactylUser(
                    pteroUsername,
                    req.session.user.email,
                    req.session.user.id
                );
                
                if (!userResult.success) {
                    return res.status(500).json({ success: false, message: 'Failed to create Pterodactyl user' });
                }
                
                pteroUserId = userResult.user.id;
                await run('UPDATE users SET pterodactyl_user_id = ? WHERE id = ?', [pteroUserId, req.session.user.id]);
                req.session.user.pterodactyl_user_id = pteroUserId;
            }
        }
        
        // Get an available allocation (with atomic claim)
        const claimResult = await run(
            `UPDATE pterodactyl_allocations 
             SET is_active = 0 
             WHERE id = (SELECT id FROM pterodactyl_allocations WHERE is_active = 1 LIMIT 1)`
        );
        
        if (!claimResult || claimResult.changes === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No available server allocations. Please contact an administrator.' 
            });
        }
        
        const allocation = await get('SELECT * FROM pterodactyl_allocations WHERE is_active = 0 ORDER BY id DESC LIMIT 1');
        
        if (!allocation) {
            return res.status(400).json({ success: false, message: 'Failed to claim allocation' });
        }
        
        // BUGFIX: Parse environment variables properly (same logic as regular server creation)
        // Handle various formats from Pterodactyl API and database storage
        let environment = {};
        if (egg.environment_variables) {
            try {
                const envVars = typeof egg.environment_variables === 'string' 
                    ? JSON.parse(egg.environment_variables) 
                    : egg.environment_variables;
                
                if (Array.isArray(envVars)) {
                    // Format: [{attributes: {env_variable, default_value}}, ...]
                    envVars.forEach(variable => {
                        const attr = variable.attributes || variable;
                        if (attr.env_variable) {
                            // Use default_value if available, otherwise empty string
                            // This ensures required variables are always included
                            environment[attr.env_variable] = attr.default_value ?? '';
                        }
                    });
                } else if (typeof envVars === 'object' && envVars !== null) {
                    // Format: {ENV_VAR: "value", ...} (already parsed object)
                    Object.entries(envVars).forEach(([key, value]) => {
                        if (typeof key === 'string' && key.length > 0) {
                            environment[key] = value ?? '';
                        }
                    });
                }
            } catch (error) {
                console.error('Error parsing environment variables:', error);
                // If parsing fails, try to use egg startup defaults or leave empty
            }
        }
        
        // Create server in Pterodactyl
        const serverData = {
            name: finalServerName,
            user: parseInt(pteroUserId),
            egg: template.egg_id,
            nest: egg.nest_id,
            docker_image: egg.docker_image || 'ghcr.io/pterodactyl/yolks:java_17',
            startup: egg.startup || 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar',
            environment: environment,
            limits: {
                memory: template.ram_mb,
                swap: 0,
                disk: template.storage_mb,
                io: 500,
                cpu: template.cpu_percent
            },
            feature_limits: {
                databases: 0,
                backups: 2,
                allocations: 1
            },
            allocation: {
                default: allocation.allocation_id
            },
            skip_scripts: false
        };
        
        const createResult = await pterodactyl.createServer(serverData);
        
        if (!createResult.success) {
            // Release the allocation on failure
            await run('UPDATE pterodactyl_allocations SET is_active = 1 WHERE id = ?', [allocation.id]);
            return res.status(500).json({ 
                success: false, 
                message: createResult.error || 'Failed to create server in Pterodactyl' 
            });
        }
        
        // Extract server info
        const pteroServer = createResult.data?.attributes || createResult.data;
        const pterodactylId = pteroServer?.id;
        const pterodactylIdentifier = pteroServer?.identifier;
        
        let publicAddress = null;
        if (allocation.ip_alias && String(allocation.ip_alias).trim() !== '') {
            publicAddress = `${String(allocation.ip_alias).trim()}:${allocation.port}`;
        } else if (allocation.ip) {
            publicAddress = `${allocation.ip}:${allocation.port}`;
        }
        if (!publicAddress && createResult.data) {
            publicAddress = pterodactyl.extractPublicAddress(createResult.data);
        }
        if (!publicAddress && pterodactylId) {
            try {
                const serverDetails = await pterodactyl.getServerDetails(pterodactylId);
                if (serverDetails.success) {
                    publicAddress = pterodactyl.extractPublicAddress(serverDetails.data);
                }
            } catch (e) {
                console.error('Error fetching server details:', e);
            }
        }
        
        // Delete the used allocation
        await run('DELETE FROM pterodactyl_allocations WHERE id = ?', [allocation.id]);
        
        // Save to database
        const insertResult = await run(
            `INSERT INTO servers (user_id, pterodactyl_id, pterodactyl_identifier, name, ram, cpu, storage, public_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.session.user.id, pterodactylId, pterodactylIdentifier, finalServerName, 
             template.ram_mb, template.cpu_percent, template.storage_mb, publicAddress]
        );
        
        res.json({ 
            success: true, 
            message: `Server "${finalServerName}" created from template!`,
            server_id: insertResult.lastID,
            pterodactyl_id: pterodactylId
        });
        
    } catch (error) {
        console.error('Error creating server from template:', error);
        res.status(500).json({ success: false, message: 'Error creating server from template' });
    }
});

// API endpoint to get user's purchased and used resources
router.get('/api/purchased-resources', requireAuth, async (req, res) => {
    try {
        const user = await get('SELECT purchased_ram, purchased_cpu, purchased_storage FROM users WHERE id = ?', 
            [req.session.user.id]);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Calculate used resources from all servers
        const usedResources = await get(`
            SELECT 
                SUM(ram) as used_ram,
                SUM(cpu) as used_cpu,
                SUM(storage) as used_storage
            FROM servers 
            WHERE user_id = ?
        `, [req.session.user.id]);
        
        res.json({
            success: true,
            purchased: {
                ram: user.purchased_ram || 0,
                cpu: user.purchased_cpu || 0,
                storage: user.purchased_storage || 0
            },
            used: {
                ram: usedResources.used_ram || 0,
                cpu: usedResources.used_cpu || 0,
                storage: usedResources.used_storage || 0
            },
            available: {
                ram: (user.purchased_ram || 0) - (usedResources.used_ram || 0),
                cpu: (user.purchased_cpu || 0) - (usedResources.used_cpu || 0),
                storage: (user.purchased_storage || 0) - (usedResources.used_storage || 0)
            }
        });
    } catch (error) {
        console.error('Error fetching purchased resources:', error);
        res.status(500).json({ success: false, message: 'Error fetching purchased resources' });
    }
});

module.exports = router;

