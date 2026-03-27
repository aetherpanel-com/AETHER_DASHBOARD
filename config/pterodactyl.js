// Pterodactyl API Integration
// Helper functions to interact with Pterodactyl Panel API

const axios = require('axios');
const { get } = require('./database');
const { decrypt } = require('./encryption');
const { sanitizePterodactylUsername } = require('../utils/helpers');

// Cache for database config (to avoid repeated queries)
let configCache = {
    url: null,
    apiKey: null,
    client_api_key: null,
    lastChecked: null
};

// Cache expiration time (5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;

// Get Pterodactyl configuration (database first, then .env fallback)
async function getConfig() {
    // Check cache first
    const now = Date.now();
    if (configCache.url && configCache.apiKey && configCache.lastChecked && 
        (now - configCache.lastChecked) < CACHE_EXPIRY) {
        return {
            url: configCache.url,
            apiKey: configCache.apiKey,
            client_api_key: configCache.client_api_key
        };
    }
    
    try {
        // Try database first - include client_api_key
        const dbConfig = await get('SELECT panel_url, api_key, client_api_key FROM pterodactyl_config ORDER BY id DESC LIMIT 1');
        
        if (dbConfig && dbConfig.panel_url && dbConfig.api_key) {
            // Decrypt API key (Application API key is encrypted)
            const decryptedKey = decrypt(dbConfig.api_key);
            // Client API key is stored plain (not encrypted) in database
            const clientApiKey = dbConfig.client_api_key || '';
            
            // Update cache
            configCache = {
                url: dbConfig.panel_url,
                apiKey: decryptedKey,
                client_api_key: clientApiKey,
                lastChecked: now
            };
            
            return {
                url: dbConfig.panel_url,
                apiKey: decryptedKey,
                client_api_key: clientApiKey
            };
        }
    } catch (error) {
        console.error('Error fetching Pterodactyl config from database:', error);
    }
    
    // Fallback to .env
    const envUrl = process.env.PTERODACTYL_URL || '';
    const envKey = process.env.PTERODACTYL_API_KEY || '';
    const envClientKey = process.env.PTERODACTYL_CLIENT_API_KEY || '';
    
    // Update cache
    configCache = {
        url: envUrl,
        apiKey: envKey,
        client_api_key: envClientKey,
        lastChecked: now
    };
    
    return {
        url: envUrl,
        apiKey: envKey,
        client_api_key: envClientKey
    };
}

// Clear config cache (call this after updating config)
function clearConfigCache() {
    configCache = {
        url: null,
        apiKey: null,
        client_api_key: null,
        lastChecked: null
    };
}

// Create axios instance (will be updated dynamically)
let pterodactylAPI = axios.create({
    baseURL: '',
    headers: {
        'Authorization': '',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Update axios instance with current config
async function updateAxiosConfig() {
    const config = await getConfig();
    pterodactylAPI = axios.create({
        baseURL: config.url ? `${config.url}/api` : '',
        headers: {
            'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : '',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout for all Pterodactyl API requests
    });
}

// Helper function to make API requests with timeout protection
async function makeRequest(method, endpoint, data = null, timeoutMs = 30000) {
    try {
        // Update axios config with latest settings
        await updateAxiosConfig();
        
        const pterodactylConfig = await getConfig();
        
        if (!pterodactylConfig.url || !pterodactylConfig.apiKey) {
            throw new Error('Pterodactyl configuration is missing. Please configure it in Admin Panel → Panel or set PTERODACTYL_URL and PTERODACTYL_API_KEY in .env file');
        }

        // Create a new axios instance with custom timeout for this request
        const requestAPI = axios.create({
            baseURL: pterodactylConfig.url ? `${pterodactylConfig.url}/api` : '',
            headers: {
                'Authorization': pterodactylConfig.apiKey ? `Bearer ${pterodactylConfig.apiKey}` : '',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: timeoutMs
        });

        const requestConfig = {
            method: method,
            url: endpoint,
            ...(data && { data })
        };

        // #region agent log
        console.log('[DEBUG] makeRequest calling:', { method, endpoint, hasData: !!data, baseURL: `${pterodactylConfig.url}/api` });
        // #endregion
        
        const response = await requestAPI(requestConfig);

        // #region agent log
        console.log('[DEBUG] makeRequest success:', { status: response.status, endpoint });
        // #endregion

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        // #region agent log
        console.error('[DEBUG] makeRequest error:', { 
            endpoint, 
            method,
            errorCode: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            errorData: error.response?.data,
            errorMessage: error.message,
            errorStack: error.stack?.substring(0, 200)
        });
        // #endregion
        
        // Handle timeout errors specifically
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            console.error('Pterodactyl API Timeout:', endpoint, `(timeout: ${timeoutMs}ms)`);
            return {
                success: false,
                error: 'Request timeout: Pterodactyl API did not respond in time. Please try again.'
            };
        }
        
        // Extract error message from response
        let errorMessage = error.message;
        if (error.response?.data) {
            if (typeof error.response.data === 'string') {
                // Check if it's an HTML error page (like Cloudflare 504)
                if (error.response.data.includes('<!DOCTYPE html>') || error.response.data.includes('<html')) {
                    // Extract readable error information from HTML
                    const statusCode = error.response?.status || 'Unknown';
                    const statusText = error.response?.statusText || 'Error';
                    
                    // Try to extract title or error message from HTML
                    const titleMatch = error.response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
                    const h1Match = error.response.data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                    
                    if (titleMatch) {
                        // Extract just the error part (e.g., "504: Gateway time-out" -> "Gateway time-out")
                        const title = titleMatch[1].replace(/^[^:]+:\s*/, '').trim();
                        errorMessage = `${statusText} (${statusCode}): ${title}`;
                    } else if (h1Match) {
                        errorMessage = `${statusText} (${statusCode}): ${h1Match[1].trim()}`;
                    } else {
                        errorMessage = `${statusText} (${statusCode}): The server returned an error page. Please try again in a few moments.`;
                    }
                } else {
                    errorMessage = error.response.data;
                }
            } else if (error.response.data.errors) {
                // Pterodactyl API error format
                const errors = error.response.data.errors;
                errorMessage = errors.map(e => e.detail || e.code || JSON.stringify(e)).join(', ');
            } else if (error.response.data.message) {
                errorMessage = error.response.data.message;
            } else {
                errorMessage = JSON.stringify(error.response.data);
            }
        }
        
        console.error('Pterodactyl API Error:', errorMessage);
        return {
            success: false,
            error: errorMessage
        };
    }
}

// Helper: make a request to the Client API using the global Client API key
// NOTE: pterodactylUserId is kept for backward compatibility but is not required
async function makeClientRequest(method, endpoint, data = null, pterodactylUserId = null, timeoutMs = 30000) {
    try {
        const configRow = await get('SELECT panel_url, client_api_key FROM pterodactyl_config ORDER BY id DESC LIMIT 1');
        const url = configRow?.panel_url || process.env.PTERODACTYL_URL || '';
        const clientApiKey = configRow?.client_api_key || process.env.PTERODACTYL_CLIENT_API_KEY || '';

        if (!url || !clientApiKey) {
            throw new Error('Client API key or panel URL is missing. Please configure a Client API key in Admin Panel → Panel.');
        }

        const requestAPI = axios.create({
            baseURL: `${url}/api`,
            headers: {
                'Authorization': `Bearer ${clientApiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: timeoutMs
        });

        const requestConfig = {
            method: method,
            url: endpoint,
            ...(data && { data })
        };

        console.log('[DEBUG] makeClientRequest calling:', { method, endpoint, hasData: !!data });

        const response = await requestAPI(requestConfig);

        console.log('[DEBUG] makeClientRequest success:', { status: response.status, endpoint });

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        // Handle 409 Conflict first (before logging) - these are expected during server installation
        // Log as warning instead of error to reduce production log noise
        if (error.response?.status === 409) {
            // Check if it's a resources endpoint (server not ready) or power endpoint
            const isResourcesEndpoint = endpoint.includes('/resources');
            const isPowerEndpoint = endpoint.includes('/power');
            
            if (isResourcesEndpoint || isPowerEndpoint) {
                // Log as warning since this is expected behavior during server installation
                console.warn(`[INFO] Server not ready yet (409) for ${method} ${endpoint} - this is normal during installation`);
                return {
                    success: false,
                    error: 'Server is still installing or not ready yet. Please wait a moment and try again.',
                    isTransient: true // Flag to indicate this is a temporary state
                };
            }
            
            // Generic 409 handling
            let conflictMessage = 'Server is in a transitional state. Please try again in a moment.';
            if (error.response?.data?.errors) {
                const errors = error.response.data.errors;
                const detail = errors[0]?.detail || errors[0]?.code;
                if (detail) {
                    conflictMessage = detail;
                }
            }
            console.warn(`[INFO] Server in transitional state (409) for ${method} ${endpoint}`);
            return {
                success: false,
                error: conflictMessage,
                isTransient: true
            };
        }

        // Log other errors as errors (not expected behavior)
        console.error('[DEBUG] makeClientRequest error:', {
            endpoint,
            method,
            errorCode: error.code,
            status: error.response?.status,
            errorData: error.response?.data,
            errorMessage: error.message
        });

        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return {
                success: false,
                error: 'Request timeout: Pterodactyl Client API did not respond in time.'
            };
        }

        let errorMessage = error.message;
        if (error.response?.data) {
            if (typeof error.response.data === 'string') {
                // Check if it's an HTML error page (like Cloudflare 504)
                if (error.response.data.includes('<!DOCTYPE html>') || error.response.data.includes('<html')) {
                    // Extract readable error information from HTML
                    const statusCode = error.response?.status || 'Unknown';
                    const statusText = error.response?.statusText || 'Error';
                    
                    // Try to extract title or error message from HTML
                    const titleMatch = error.response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
                    const h1Match = error.response.data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                    
                    if (titleMatch) {
                        // Extract just the error part (e.g., "504: Gateway time-out" -> "Gateway time-out")
                        const title = titleMatch[1].replace(/^[^:]+:\s*/, '').trim();
                        errorMessage = `${statusText} (${statusCode}): ${title}`;
                    } else if (h1Match) {
                        errorMessage = `${statusText} (${statusCode}): ${h1Match[1].trim()}`;
                    } else {
                        errorMessage = `${statusText} (${statusCode}): The server returned an error page. Please try again in a few moments.`;
                    }
                } else {
                    errorMessage = error.response.data;
                }
            } else if (error.response.data.errors) {
                const errors = error.response.data.errors;
                errorMessage = errors.map(e => e.detail || e.code || JSON.stringify(e)).join(', ');
            } else if (error.response.data.message) {
                errorMessage = error.response.data.message;
            } else {
                errorMessage = JSON.stringify(error.response.data);
            }
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

// Get all servers (with pagination support)
async function getAllServers() {
    // Request up to 100 servers per page to reduce API calls
    // For very large deployments, full pagination would be needed
    return await makeRequest('GET', '/application/servers?per_page=100');
}

// Get server by ID
async function getServer(serverId) {
    return await makeRequest('GET', `/application/servers/${serverId}`);
}

// Helper function to extract public_address from server allocations
function extractPublicAddress(serverData) {
    // serverData should be the response from getServerDetails
    let alias = null;
    let ip = null;
    let port = null;
    
    // Method 1: Check relationships for allocations
    if (serverData?.relationships?.allocations?.data) {
        const allocations = serverData.relationships.allocations.data;
        
        // Find primary allocation (is_default === true or first one)
        const primaryAllocation = allocations.find(a => {
            const attrs = a.attributes || a;
            return attrs.is_default === true || attrs.is_default === 1;
        }) || allocations[0];
        
        if (primaryAllocation) {
            const attrs = primaryAllocation.attributes || primaryAllocation;
            alias = attrs.ip_alias && String(attrs.ip_alias).trim() !== '' ? String(attrs.ip_alias).trim() : null;
            ip = attrs.ip;
            port = attrs.port;
        }
    }
    // Method 2: Check included allocations
    else if (serverData?.included) {
        const allocations = serverData.included.filter(item => item.type === 'allocation');
        
        // Find primary allocation (is_default === true or first one)
        const primaryAllocation = allocations.find(item => {
            const attrs = item.attributes || item;
            return attrs.is_default === true || attrs.is_default === 1;
        }) || allocations[0];
        
        if (primaryAllocation) {
            const attrs = primaryAllocation.attributes || primaryAllocation;
            alias = attrs.ip_alias && String(attrs.ip_alias).trim() !== '' ? String(attrs.ip_alias).trim() : null;
            ip = attrs.ip;
            port = attrs.port;
        }
    }
    
    // Return public_address as alias:port or ip:port (empty ip_alias treated as absent)
    if (port) {
        const address = (alias && alias.trim() !== '') ? alias.trim() : ip;
        return address ? `${address}:${port}` : null;
    }
    
    return null;
}

// Get primary allocation for a server
async function getPrimaryAllocation(serverId) {
    try {
        const serverDetails = await getServerDetails(serverId);
        
        if (!serverDetails.success) {
            throw new Error('Failed to fetch server details');
        }
        
        const serverData = serverDetails.data;
        const serverAttributes = serverData.attributes || serverData;
        
        // Step 1: Get primary allocation ID from response.attributes.allocation (source of truth)
        const primaryAllocationId = serverAttributes.allocation;
        
        if (!primaryAllocationId) {
            throw new Error('Primary allocation ID not found in server attributes');
        }
        
        // Step 2: Find the allocation in relationships.allocations.data where id matches
        const allocations = serverData.relationships?.allocations?.data || [];
        
        if (!allocations || allocations.length === 0) {
            throw new Error('No allocations found in relationships');
        }
        
        // Find allocation where allocation.id === primaryAllocationId
        const primaryAllocation = allocations.find(allocation => {
            const allocationId = allocation.id || allocation.attributes?.id;
            return allocationId === primaryAllocationId || 
                   parseInt(allocationId) === parseInt(primaryAllocationId);
        });
        
        if (!primaryAllocation) {
            throw new Error(`Primary allocation ID ${primaryAllocationId} exists but allocation details not found in relationships`);
        }
        
        // Step 3: Extract allocation details
        const allocationAttributes = primaryAllocation.attributes || primaryAllocation;
        
        const allocationId = parseInt(allocationAttributes.id || primaryAllocation.id);
        
        if (isNaN(allocationId)) {
            throw new Error('Invalid allocation ID format');
        }
        
        return {
            id: allocationId,
            alias: allocationAttributes.ip_alias || null,
            ip: allocationAttributes.ip || null,
            port: allocationAttributes.port || null
        };
    } catch (error) {
        console.error(`Error getting primary allocation for server ${serverId}:`, error);
        throw new Error(`Failed to get primary allocation: ${error.message}`);
    }
}

// Get server details (including resources)
async function getServerDetails(serverId) {
    return await makeRequest('GET', `/application/servers/${serverId}?include=allocations,user,subusers`);
}

// BUGFIX #6: Get server resources/usage (real-time stats)
// The Application API does NOT have a /resources endpoint
// Real-time resource usage is only available via the Client API
// NOTE: Requires server IDENTIFIER (8-char string), not internal numeric ID
// Requires user's Pterodactyl user ID to obtain a Client API token
async function getServerResources(serverIdentifier, pterodactylUserId) {
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/resources`, null, pterodactylUserId);
}

// Create a new server (with extended timeout for server creation)
async function createServer(serverData) {
    // serverData should include:
    // - name, user, egg, docker_image, startup, environment, limits, feature_limits, allocation
    // Server creation can take longer, so use 60 second timeout
    return await makeRequest('POST', '/application/servers', serverData, 60000);
}

// Update server resources
async function updateServerResources(serverId, resources) {
    // resources should include: memory, swap, disk, io, cpu
    // First, get the current server details to preserve required fields
    try {
        const serverDetails = await getServerDetails(serverId);
        
        if (!serverDetails.success) {
            throw new Error('Failed to fetch server details');
        }
        
        // Log the full response for debugging
        console.log('Server details response structure:', JSON.stringify(serverDetails.data, null, 2));
        
        const server = serverDetails.data?.attributes || serverDetails.data;
        
        // Extract current values
        const currentLimits = server.limits || {};
        const currentFeatureLimits = server.feature_limits || {};
        
        // Build base update payload (without allocation first)
        let updateData = {
            limits: {
                memory: resources.memory,
                swap: resources.swap !== undefined ? resources.swap : (currentLimits.swap || 0),
                disk: resources.disk,
                io: resources.io !== undefined ? resources.io : (currentLimits.io || 500),
                cpu: resources.cpu
            },
            feature_limits: {
                databases: currentFeatureLimits.databases !== undefined ? currentFeatureLimits.databases : 0,
                allocations: currentFeatureLimits.allocations !== undefined ? currentFeatureLimits.allocations : 1,
                backups: currentFeatureLimits.backups !== undefined ? currentFeatureLimits.backups : 0
            }
        };
        
        console.log(`Updating server ${serverId} resources (memory: ${resources.memory}MB, cpu: ${resources.cpu}%, disk: ${resources.disk}MB)`);
        console.log('Update payload (without allocation):', JSON.stringify(updateData, null, 2));
        
        // Try update without allocation first
        let result = await makeRequest('PATCH', `/application/servers/${serverId}/build`, updateData);
        
        // If it fails with "allocation required" error, retry with allocation
        if (!result.success && result.error) {
            const errorDetail = result.error.detail || result.error.message || '';
            const errorData = result.error.errors || [];
            const needsAllocation = errorDetail.includes('allocation') || 
                                   (Array.isArray(errorData) && errorData.some(e => e.detail && e.detail.includes('allocation')));
            
            if (needsAllocation) {
                console.log('Update failed - allocation required. Extracting allocation ID...');
                
                // Extract allocation ID from relationships/included data
                let allocationId = null;
                
                // Method 1: Get from relationships - find the default allocation
                if (serverDetails.data?.relationships?.allocations?.data) {
                    const allocations = serverDetails.data.relationships.allocations.data;
                    
                    // Find default allocation (is_default === true or 1)
                    const defaultAlloc = allocations.find(a => {
                        const attrs = a.attributes || a;
                        return attrs.is_default === true || attrs.is_default === 1;
                    }) || allocations[0];
                    
                    if (defaultAlloc) {
                        const allocId = defaultAlloc.id || defaultAlloc.attributes?.id;
                        
                        // Get full allocation from included data
                        if (serverDetails.data?.included) {
                            const fullAllocation = serverDetails.data.included.find(
                                item => item.type === 'allocation' && 
                                       (item.id === allocId || item.attributes?.id === allocId)
                            );
                            
                            if (fullAllocation) {
                                allocationId = parseInt(fullAllocation.attributes?.id || fullAllocation.id);
                                console.log('Found default allocation from relationships/included:', allocationId);
                            } else if (allocId) {
                                allocationId = parseInt(allocId);
                                console.log('Found allocation ID from relationships:', allocationId);
                            }
                        } else if (allocId) {
                            allocationId = parseInt(allocId);
                            console.log('Found allocation ID from relationships:', allocationId);
                        }
                    }
                }
                // Method 2: Check included data directly
                else if (serverDetails.data?.included) {
                    const defaultAlloc = serverDetails.data.included.find(
                        item => item.type === 'allocation' && 
                               (item.attributes?.is_default === true || item.attributes?.is_default === 1)
                    ) || serverDetails.data.included.find(item => item.type === 'allocation');
                    
                    if (defaultAlloc) {
                        allocationId = parseInt(defaultAlloc.attributes?.id || defaultAlloc.id);
                        console.log('Found allocation from included:', allocationId);
                    }
                }
                
                if (allocationId && !isNaN(allocationId)) {
                    // Add allocation to payload and retry
                    updateData.allocation = {
                        default: allocationId
                    };
                    
                    console.log(`Retrying with allocation ID: ${allocationId}`);
                    console.log('Update payload (with allocation):', JSON.stringify(updateData, null, 2));
                    
                    result = await makeRequest('PATCH', `/application/servers/${serverId}/build`, updateData);
                } else {
                    console.error('Could not extract allocation ID. Server details structure:');
                    console.error('Full response:', JSON.stringify(serverDetails.data, null, 2));
                    throw new Error('Update failed and could not find allocation ID. Please check server configuration in Pterodactyl panel.');
                }
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error in updateServerResources:', error);
        // Re-throw with more context
        if (error.message && !error.message.includes('Error in updateServerResources')) {
            throw new Error(`Failed to update server resources: ${error.message}`);
        }
        throw error;
    }
}

// Update server build configuration (simplified, always includes all required fields)
async function updateServerBuild(serverId, limits) {
    // limits should include: memory, swap, cpu, io, disk
    // First, get current server details to preserve feature_limits and get allocation
    try {
        const serverDetails = await getServerDetails(serverId);
        
        if (!serverDetails.success) {
            throw new Error('Failed to fetch server details');
        }
        
        const server = serverDetails.data?.attributes || serverDetails.data;
        const currentLimits = server.limits || {};
        const currentFeatureLimits = server.feature_limits || {};
        
        // Get primary allocation ID (required for build update)
        const primaryAllocation = await getPrimaryAllocation(serverId);
        
        // Build update payload with ALL required fields including allocation
        // BUGFIX #4: Include oom_disabled field - required by Pterodactyl API
        const updateData = {
            allocation: primaryAllocation.id, // Always include allocation ID
            oom_disabled: server.oom_disabled !== undefined ? server.oom_disabled : false, // Preserve existing or default to false
            limits: {
                memory: limits.memory,
                swap: limits.swap !== undefined ? limits.swap : (currentLimits.swap || 0),
                cpu: limits.cpu,
                io: limits.io !== undefined ? limits.io : (currentLimits.io || 500),
                disk: limits.disk
            },
            feature_limits: {
                databases: currentFeatureLimits.databases !== undefined ? currentFeatureLimits.databases : 0,
                allocations: currentFeatureLimits.allocations !== undefined ? currentFeatureLimits.allocations : 1,
                backups: currentFeatureLimits.backups !== undefined ? currentFeatureLimits.backups : 0
            }
        };
        
        console.log(`Updating server ${serverId} build configuration:`, JSON.stringify(updateData, null, 2));
        
        const result = await makeRequest('PATCH', `/application/servers/${serverId}/build`, updateData);
        
        if (!result.success) {
            const errorMsg = result.error?.detail || result.error?.message || JSON.stringify(result.error);
            throw new Error(`Pterodactyl API error: ${errorMsg}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error in updateServerBuild:', error);
        throw error;
    }
}

/**
 * Patch feature_limits (and preserve limits/allocation) via Application API.
 * Used so purchased database/backup entitlements can raise per-server panel limits before Client API create.
 */
async function patchServerBuildFeatureLimits(serverApplicationId, overrides) {
    if (!overrides || typeof overrides !== 'object') {
        return { success: false, error: 'Invalid overrides' };
    }
    const serverDetails = await getServerDetails(serverApplicationId);
    if (!serverDetails.success) {
        return { success: false, error: serverDetails.error || 'Failed to fetch server details' };
    }
    const serverAttrs = serverDetails.data?.attributes || serverDetails.data;
    const currentLimits = serverAttrs.limits || {};
    const currentFeatureLimits = serverAttrs.feature_limits || {};
    const allocationId = serverAttrs.allocation;
    if (!allocationId) {
        return { success: false, error: 'Server allocation missing' };
    }

    const feature_limits = {
        databases: overrides.databases !== undefined
            ? overrides.databases
            : (currentFeatureLimits.databases !== undefined ? currentFeatureLimits.databases : 0),
        allocations: currentFeatureLimits.allocations !== undefined ? currentFeatureLimits.allocations : 1,
        backups: overrides.backups !== undefined
            ? overrides.backups
            : (currentFeatureLimits.backups !== undefined ? currentFeatureLimits.backups : 0)
    };

    const payload = {
        allocation: parseInt(allocationId, 10),
        oom_disabled: serverAttrs.oom_disabled ?? false,
        limits: {
            memory: currentLimits.memory,
            swap: currentLimits.swap ?? 0,
            disk: currentLimits.disk,
            io: currentLimits.io ?? 500,
            cpu: currentLimits.cpu
        },
        feature_limits
    };

    return await makeRequest('PATCH', `/application/servers/${serverApplicationId}/build`, payload);
}

// BUGFIX #5: Send power signal to server (start, stop, restart, kill)
// Power signals use the CLIENT API (not Application API) and require the server IDENTIFIER (not internal ID)
// The Application API does not have a /power endpoint - it only has /suspend and /unsuspend
// Uses the global Client API key; pterodactylUserId is optional for compatibility
async function sendServerPowerSignal(serverIdentifier, signal, pterodactylUserId = null) {
    // signal should be: 'start', 'stop', 'restart', 'kill'
    // serverIdentifier should be the 8-char identifier (e.g., 'a1b2c3d4'), NOT the internal numeric ID
    // #region agent log
    console.log('[DEBUG] sendServerPowerSignal called:', { serverIdentifier, signal, endpoint: `/client/servers/${serverIdentifier}/power` });
    // #endregion
    const result = await makeClientRequest('POST', `/client/servers/${serverIdentifier}/power`, { signal }, pterodactylUserId);
    // #region agent log
    console.log('[DEBUG] sendServerPowerSignal result:', result);
    // #endregion
    return result;
}

// Restart server (convenience wrapper for power signal)
async function restartServer(serverIdentifier, pterodactylUserId = null) {
    return await sendServerPowerSignal(serverIdentifier, 'restart', pterodactylUserId);
}

// ============================================
// FEATURE 4: Send command to server console
// ============================================
async function sendServerCommand(serverIdentifier, command, pterodactylUserId) {
    // Uses Client API to send a command to the server console
    // serverIdentifier should be the 8-char identifier (e.g., 'a1b2c3d4')
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/command`, { command }, pterodactylUserId);
}

// ============================================
// FEATURE 5: File Manager
// ============================================

// List files in a directory
async function listFiles(serverIdentifier, directory = '/', pterodactylUserId) {
    // Encode the directory path for URL
    const encodedDir = encodeURIComponent(directory);
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/files/list?directory=${encodedDir}`, null, pterodactylUserId);
}

// Get file contents
async function getFileContents(serverIdentifier, filePath, pterodactylUserId) {
    try {
        const encodedPath = encodeURIComponent(filePath);
        const result = await makeClientRequest('GET', `/client/servers/${serverIdentifier}/files/contents?file=${encodedPath}`, null, pterodactylUserId);
        
        if (result.success) {
            // Handle both string and object responses
            const content = typeof result.data === 'string' ? result.data : (result.data?.content || result.data?.data || JSON.stringify(result.data));
            return { success: true, data: content };
        } else {
            // Check if it's a 404 (file not found) - that's okay, we'll create it
            if (result.error && (result.error.includes('404') || result.error.includes('not found') || result.error.includes('Not Found'))) {
                return { success: false, error: 'File not found', notFound: true };
            }
            return result;
        }
    } catch (error) {
        // Handle 404 errors gracefully
        if (error.response?.status === 404 || error.message?.includes('404')) {
            return { success: false, error: 'File not found', notFound: true };
        }
        console.error('Error getting file contents:', error);
        return { success: false, error: error.message || 'Failed to read file' };
    }
}

// Write file contents
// Note: Pterodactyl expects raw text body for file writes, not JSON
// Always uses Client API for /client/servers/ endpoints
async function writeFile(serverIdentifier, filePath, content, pterodactylUserId = null) {
    try {
        const pterodactylConfig = await getConfig();
        
        if (!pterodactylConfig.url) {
            return { success: false, error: 'Pterodactyl not configured' };
        }
        
        // Client API endpoints always require Client API key
        const clientApiKey = pterodactylConfig.client_api_key;
        if (!clientApiKey) {
            return { success: false, error: 'Client API key not configured. Please configure it in Admin Panel → Panel.' };
        }
        
        const encodedPath = encodeURIComponent(filePath);
        const url = `${pterodactylConfig.url}/api/client/servers/${serverIdentifier}/files/write?file=${encodedPath}`;
        
        const response = await axios.post(url, content, {
            headers: {
                'Authorization': `Bearer ${clientApiKey}`,
                'Content-Type': 'text/plain',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error writing file:', error.response?.data || error.message);
        return { 
            success: false, 
            error: error.response?.data?.errors?.[0]?.detail || error.message 
        };
    }
}

// Create directory
async function createDirectory(serverIdentifier, name, root = '/') {
    return await makeRequest('POST', `/client/servers/${serverIdentifier}/files/create-folder`, {
        root: root,
        name: name
    });
}

// Delete files/folders
async function deleteFiles(serverIdentifier, root, files) {
    return await makeRequest('POST', `/client/servers/${serverIdentifier}/files/delete`, {
        root: root,
        files: files
    });
}

// Rename file/folder
async function renameFile(serverIdentifier, root, from, to) {
    return await makeRequest('PUT', `/client/servers/${serverIdentifier}/files/rename`, {
        root: root,
        files: [{ from: from, to: to }]
    });
}

// Compress files
async function compressFiles(serverIdentifier, root, files) {
    return await makeRequest('POST', `/client/servers/${serverIdentifier}/files/compress`, {
        root: root,
        files: files
    });
}

// Decompress file
async function decompressFile(serverIdentifier, root, file) {
    return await makeRequest('POST', `/client/servers/${serverIdentifier}/files/decompress`, {
        root: root,
        file: file
    });
}

// ============================================
// FEATURE 6: Backup System
// ============================================

// List backups for a server
async function listBackups(serverIdentifier, pterodactylUserId) {
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/backups`, null, pterodactylUserId);
}

// Create a new backup
async function createBackup(serverIdentifier, name = null, isLocked = false, pterodactylUserId) {
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/backups`, {
        name: name,
        is_locked: isLocked
    }, pterodactylUserId);
}

// Get backup details
async function getBackup(serverIdentifier, backupUuid, pterodactylUserId) {
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/backups/${backupUuid}`, null, pterodactylUserId);
}

// Get backup download URL
async function getBackupDownloadUrl(serverIdentifier, backupUuid, pterodactylUserId) {
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/backups/${backupUuid}/download`, null, pterodactylUserId);
}

// Delete a backup
async function deleteBackup(serverIdentifier, backupUuid, pterodactylUserId) {
    return await makeClientRequest('DELETE', `/client/servers/${serverIdentifier}/backups/${backupUuid}`, null, pterodactylUserId);
}

// Restore from a backup
async function restoreBackup(serverIdentifier, backupUuid, truncate = false, pterodactylUserId) {
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/backups/${backupUuid}/restore`, {
        truncate: truncate
    }, pterodactylUserId);
}

// ============================================
// FEATURE 7: Scheduled Tasks (Schedules)
// ============================================

// List all schedules
async function listSchedules(serverIdentifier, pterodactylUserId) {
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/schedules`, null, pterodactylUserId);
}

// Get schedule details
async function getSchedule(serverIdentifier, scheduleId, pterodactylUserId) {
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/schedules/${scheduleId}`, null, pterodactylUserId);
}

// Create a schedule
async function createSchedule(serverIdentifier, name, minute, hour, dayOfMonth, month, dayOfWeek, isActive = true, onlyWhenOnline = true, pterodactylUserId) {
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/schedules`, {
        name: name,
        is_active: isActive,
        minute: minute,
        hour: hour,
        day_of_month: dayOfMonth,
        month: month,
        day_of_week: dayOfWeek,
        only_when_online: onlyWhenOnline
    }, pterodactylUserId);
}

// Update a schedule
async function updateSchedule(serverIdentifier, scheduleId, data, pterodactylUserId) {
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/schedules/${scheduleId}`, data, pterodactylUserId);
}

// Delete a schedule
async function deleteSchedule(serverIdentifier, scheduleId, pterodactylUserId) {
    return await makeClientRequest('DELETE', `/client/servers/${serverIdentifier}/schedules/${scheduleId}`, null, pterodactylUserId);
}

// Execute a schedule now
async function executeSchedule(serverIdentifier, scheduleId, pterodactylUserId) {
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/schedules/${scheduleId}/execute`, null, pterodactylUserId);
}

// Create a task for a schedule
async function createScheduleTask(serverIdentifier, scheduleId, action, payload, timeOffset = 0, pterodactylUserId) {
    // action: 'command', 'power', or 'backup'
    // payload: for command = the command string, for power = 'start', 'stop', 'restart', 'kill'
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/schedules/${scheduleId}/tasks`, {
        action: action,
        payload: payload,
        time_offset: timeOffset
    }, pterodactylUserId);
}

// Delete a task from a schedule
async function deleteScheduleTask(serverIdentifier, scheduleId, taskId, pterodactylUserId) {
    return await makeClientRequest('DELETE', `/client/servers/${serverIdentifier}/schedules/${scheduleId}/tasks/${taskId}`, null, pterodactylUserId);
}

// ============================================
// FEATURE 8: Database Management
// ============================================

// List databases for a server
async function listDatabases(serverIdentifier, pterodactylUserId) {
    return await makeClientRequest('GET', `/client/servers/${serverIdentifier}/databases`, null, pterodactylUserId);
}

// Create a database
async function createDatabase(serverIdentifier, database, remote = '%', pterodactylUserId) {
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/databases`, {
        database: database,
        remote: remote
    }, pterodactylUserId);
}

// Rotate database password
async function rotateDatabasePassword(serverIdentifier, databaseId, pterodactylUserId) {
    return await makeClientRequest('POST', `/client/servers/${serverIdentifier}/databases/${databaseId}/rotate-password`, null, pterodactylUserId);
}

// Delete a database
async function deleteDatabase(serverIdentifier, databaseId, pterodactylUserId) {
    return await makeClientRequest('DELETE', `/client/servers/${serverIdentifier}/databases/${databaseId}`, null, pterodactylUserId);
}

// Assign an additional allocation to a server (Application API).
// Some panel versions do not support POST /servers/:id/allocations.
// PATCH /servers/:id/build with add_allocations is broadly compatible.
async function addServerAllocation(serverId, allocationId) {
    const serverDetails = await getServerDetails(serverId);
    if (!serverDetails.success) {
        return serverDetails;
    }

    const serverAttrs = serverDetails.data?.attributes || serverDetails.data;
    const currentLimits = serverAttrs.limits || {};
    const currentFeatureLimits = serverAttrs.feature_limits || {};
    const primaryAllocationId = parseInt(serverAttrs.allocation, 10);
    const addAllocationId = parseInt(allocationId, 10);

    if (!primaryAllocationId || Number.isNaN(primaryAllocationId) || Number.isNaN(addAllocationId)) {
        return { success: false, error: 'Invalid allocation information' };
    }

    return await makeRequest('PATCH', `/application/servers/${serverId}/build`, {
        allocation: primaryAllocationId,
        oom_disabled: serverAttrs.oom_disabled ?? false,
        limits: {
            memory: currentLimits.memory,
            swap: currentLimits.swap ?? 0,
            disk: currentLimits.disk,
            io: currentLimits.io ?? 500,
            cpu: currentLimits.cpu
        },
        feature_limits: {
            databases: currentFeatureLimits.databases !== undefined ? currentFeatureLimits.databases : 0,
            allocations: currentFeatureLimits.allocations !== undefined ? currentFeatureLimits.allocations : 1,
            backups: currentFeatureLimits.backups !== undefined ? currentFeatureLimits.backups : 0
        },
        add_allocations: [addAllocationId]
    });
}

// Remove an additional allocation from a server (Application API).
// Prefer PATCH /build with remove_allocations; fall back to DELETE endpoint if needed.
async function removeServerAllocation(serverId, allocationId) {
    const serverDetails = await getServerDetails(serverId);
    if (!serverDetails.success) {
        return serverDetails;
    }

    const serverAttrs = serverDetails.data?.attributes || serverDetails.data;
    const currentLimits = serverAttrs.limits || {};
    const currentFeatureLimits = serverAttrs.feature_limits || {};
    const primaryAllocationId = parseInt(serverAttrs.allocation, 10);
    const removeAllocationId = parseInt(allocationId, 10);

    if (!primaryAllocationId || Number.isNaN(primaryAllocationId) || Number.isNaN(removeAllocationId)) {
        return { success: false, error: 'Invalid allocation information' };
    }

    const patchResult = await makeRequest('PATCH', `/application/servers/${serverId}/build`, {
        allocation: primaryAllocationId,
        oom_disabled: serverAttrs.oom_disabled ?? false,
        limits: {
            memory: currentLimits.memory,
            swap: currentLimits.swap ?? 0,
            disk: currentLimits.disk,
            io: currentLimits.io ?? 500,
            cpu: currentLimits.cpu
        },
        feature_limits: {
            databases: currentFeatureLimits.databases !== undefined ? currentFeatureLimits.databases : 0,
            allocations: currentFeatureLimits.allocations !== undefined ? currentFeatureLimits.allocations : 1,
            backups: currentFeatureLimits.backups !== undefined ? currentFeatureLimits.backups : 0
        },
        remove_allocations: [removeAllocationId]
    });
    if (patchResult.success) {
        return patchResult;
    }

    // Fallback path for panels that expose dedicated allocation remove endpoint.
    return await makeRequest('DELETE', `/application/servers/${serverId}/allocations/${removeAllocationId}`);
}

// Suspend server
async function suspendServer(serverId) {
    return await makeRequest('POST', `/application/servers/${serverId}/suspend`);
}

// Unsuspend server
async function unsuspendServer(serverId) {
    return await makeRequest('POST', `/application/servers/${serverId}/unsuspend`);
}

// Delete server
async function deleteServer(serverId) {
    return await makeRequest('DELETE', `/application/servers/${serverId}`);
}

// Get all users (with pagination support)
async function getAllUsers() {
    // Request up to 100 users per page to reduce API calls
    return await makeRequest('GET', '/application/users?per_page=100');
}

// Get all users with full pagination (returns all pages combined)
async function getAllUsersPaginated() {
    const allUsers = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
        const response = await makeRequest('GET', `/application/users?per_page=100&page=${page}`);
        
        // Handle error response
        if (!response || !response.success) {
            console.error('Error fetching users from Pterodactyl:', response?.error || 'Unknown error');
            throw new Error(response?.error || 'Failed to fetch users from Pterodactyl');
        }
        
        // Pterodactyl API returns: { data: [...users...], meta: {...} }
        // makeRequest wraps it as: { success: true, data: { data: [...], meta: {...} } }
        const pterodactylResponse = response.data;
        
        if (pterodactylResponse && pterodactylResponse.data && Array.isArray(pterodactylResponse.data)) {
            allUsers.push(...pterodactylResponse.data);
            
            // Check if there are more pages
            if (pterodactylResponse.meta && pterodactylResponse.meta.pagination) {
                const { current_page, total_pages } = pterodactylResponse.meta.pagination;
                hasMorePages = current_page < total_pages;
                page++;
            } else {
                hasMorePages = false;
            }
        } else {
            // No more data or invalid response
            hasMorePages = false;
        }
    }
    
    return allUsers;
}

// Get user by ID
async function getUser(userId) {
    return await makeRequest('GET', `/application/users/${userId}`);
}

// Create user
async function createUser(userData) {
    // userData should include: email, username, first_name, last_name, password
    return await makeRequest('POST', '/application/users', userData);
}

// BUGFIX #13: Delete user from Pterodactyl
async function deleteUser(userId) {
    return await makeRequest('DELETE', `/application/users/${userId}`);
}

// BUGFIX #6: Get server statistics (real-time)
// The Application API does NOT have a /resources endpoint
// Real-time stats are only available via the Client API
// NOTE: Requires server IDENTIFIER (8-char string), not internal numeric ID
async function getServerStats(serverIdentifier) {
    return await makeRequest('GET', `/client/servers/${serverIdentifier}/resources`);
}

// Get all nests
async function getAllNests() {
    return await makeRequest('GET', '/application/nests');
}

// Get eggs for a nest
async function getEggsForNest(nestId) {
    return await makeRequest('GET', `/application/nests/${nestId}/eggs?include=variables`);
}

// Get all eggs (from all nests)
async function getAllEggs() {
    try {
        const nestsResult = await getAllNests();
        if (!nestsResult.success) {
            return nestsResult;
        }
        
        const nests = nestsResult.data.data || [];
        const allEggs = [];
        
        for (const nest of nests) {
            const eggsResult = await getEggsForNest(nest.attributes.id);
            if (eggsResult.success && eggsResult.data.data) {
                eggsResult.data.data.forEach(egg => {
                    allEggs.push({
                        ...egg.attributes,
                        nest_id: nest.attributes.id,
                        nest_name: nest.attributes.name
                    });
                });
            }
        }
        
        return {
            success: true,
            data: allEggs
        };
    } catch (error) {
        console.error('Error fetching all eggs:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Get all locations
async function getAllLocations() {
    return await makeRequest('GET', '/application/locations');
}

// Get all nodes
async function getAllNodes() {
    return await makeRequest('GET', '/application/nodes');
}

// Get allocations for a node
async function getAllocationsForNode(nodeId) {
    return await makeRequest('GET', `/application/nodes/${nodeId}/allocations?per_page=500`);
}

// Get all available allocations
async function getAllAllocations() {
    try {
        const nodesResult = await getAllNodes();
        if (!nodesResult.success) {
            return nodesResult;
        }
        
        const nodes = nodesResult.data.data || [];
        const allAllocations = [];
        
        for (const node of nodes) {
            const allocationsResult = await getAllocationsForNode(node.attributes.id);
            if (allocationsResult.success && allocationsResult.data.data) {
                allocationsResult.data.data.forEach(allocation => {
                    if (!allocation.attributes.assigned) {
                        // Only include unassigned allocations
                        allAllocations.push({
                            ...allocation.attributes,
                            node_id: node.attributes.id,
                            node_name: node.attributes.name
                        });
                    }
                });
            }
        }
        
        return {
            success: true,
            data: allAllocations
        };
    } catch (error) {
        console.error('Error fetching all allocations:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Create user in Pterodactyl
// userData should include: email, username, first_name, last_name, password
// Optionally include external_id for linking with dashboard user ID
async function createPterodactylUser(userData) {
    return await makeRequest('POST', '/application/users', userData);
}

// Update user in Pterodactyl (ALL fields required by Pterodactyl API)
async function updatePterodactylUser(userId, userData) {
    // userData MUST include: email, username, first_name, last_name, password
    // Pterodactyl returns 422 if any of these are missing
    const safeUsername = sanitizePterodactylUsername(userData?.username);
    if (userData?.username && safeUsername !== userData.username) {
        console.warn(`[Pterodactyl] Username sanitized: "${userData.username}" -> "${safeUsername}"`);
    }

    const safeUserData = {
        ...userData,
        username: safeUsername
    };

    return await makeRequest('PATCH', `/application/users/${userId}`, safeUserData);
}

// Get user by external ID (useful for linking dashboard users to Pterodactyl)
async function getPterodactylUserByExternalId(externalId) {
    try {
        const result = await makeRequest('GET', `/application/users/external/${externalId}`);
        if (result.success && result.data) {
            return {
                success: true,
                data: result.data.attributes || result.data
            };
        }
        return {
            success: false,
            error: 'User not found'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Get user by email (using API filter for efficiency)
async function getPterodactylUserByEmail(email) {
    try {
        // Use Pterodactyl's filter parameter for efficient lookup
        const encodedEmail = encodeURIComponent(email);
        const result = await makeRequest('GET', `/application/users?filter[email]=${encodedEmail}`);
        
        if (result.success && result.data.data && result.data.data.length > 0) {
            // Find exact match (filter is partial match)
            const user = result.data.data.find(u => u.attributes.email.toLowerCase() === email.toLowerCase());
            if (user) {
                return {
                    success: true,
                    data: user.attributes
                };
            }
        }
        return {
            success: false,
            error: 'User not found'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Check if Pterodactyl is configured
async function isConfigured() {
    const config = await getConfig();
    return !!(config.url && config.apiKey);
}

// Test connection to Pterodactyl panel
async function testConnection(panelUrl, apiKey) {
    try {
        const testAPI = axios.create({
            baseURL: panelUrl ? `${panelUrl}/api` : '',
            headers: {
                'Authorization': apiKey ? `Bearer ${apiKey}` : '',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });
        
        // Try to fetch servers list (lightweight endpoint)
        const response = await testAPI.get('/application/servers?per_page=1');
        
        return {
            success: true,
            message: 'Connection successful!'
        };
    } catch (error) {
        let errorMessage = 'Connection failed';
        
        if (error.response) {
            // Server responded with error
            if (error.response.status === 401 || error.response.status === 403) {
                errorMessage = 'Invalid API key. Please check your API key.';
            } else if (error.response.status === 404) {
                errorMessage = 'Panel URL not found. Please check your panel URL.';
            } else {
                errorMessage = `Connection error: ${error.response.status} ${error.response.statusText}`;
            }
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            errorMessage = 'Cannot connect to panel. Please check your panel URL.';
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Connection timeout. Please check your panel URL.';
        } else {
            errorMessage = error.message || 'Unknown error occurred';
        }
        
        return {
            success: false,
            message: errorMessage,
            error: error.response?.data || error.message
        };
    }
}

module.exports = {
    makeRequest,
    getAllServers,
    getServer,
    getServerDetails,
    getServerResources,
    createServer,
    updateServerResources,
    updateServerBuild,
    patchServerBuildFeatureLimits,
    sendServerPowerSignal,
    sendServerCommand,
    restartServer,
    getPrimaryAllocation,
    extractPublicAddress,
    suspendServer,
    unsuspendServer,
    deleteServer,
    getAllUsers,
    getAllUsersPaginated,
    getUser,
    createUser,
    deleteUser,
    getServerStats,
    isConfigured,
    testConnection,
    getConfig,
    clearConfigCache,
    updateAxiosConfig,
    getAllNests,
    getEggsForNest,
    getAllEggs,
    getAllLocations,
    getAllNodes,
    getAllocationsForNode,
    getAllAllocations,
    createPterodactylUser,
    updatePterodactylUser,
    getPterodactylUserByEmail,
    getPterodactylUserByExternalId,
    // File Manager (Feature 5)
    listFiles,
    getFileContents,
    writeFile,
    createDirectory,
    deleteFiles,
    renameFile,
    compressFiles,
    decompressFile,
    // Backup System (Feature 6)
    listBackups,
    createBackup,
    getBackup,
    getBackupDownloadUrl,
    deleteBackup,
    restoreBackup,
    // Scheduled Tasks (Feature 7)
    listSchedules,
    getSchedule,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    executeSchedule,
    createScheduleTask,
    deleteScheduleTask,
    // Database Management (Feature 8)
    listDatabases,
    createDatabase,
    rotateDatabasePassword,
    deleteDatabase,
    addServerAllocation,
    removeServerAllocation
};
