// Database Configuration
// SQLite database setup and connection

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to database file
const DB_PATH = path.join(__dirname, '..', 'database.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Initialize database - create all tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
                console.error('Error enabling foreign keys:', err);
                reject(err);
                return;
            }

            // Create Users table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    discord_id TEXT,
                    coins INTEGER DEFAULT 0,
                    is_admin INTEGER DEFAULT 0,
                    server_slots INTEGER DEFAULT 1,
                    purchased_ram INTEGER DEFAULT 0,
                    purchased_cpu INTEGER DEFAULT 0,
                    purchased_storage INTEGER DEFAULT 0,
                    pterodactyl_user_id TEXT,
                    client_api_key TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating users table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Users table created/verified');
                
                // Check and add missing columns
                db.all("PRAGMA table_info(users)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        const columnsToAdd = [];
                        
                        if (!columnNames.includes('server_slots')) {
                            columnsToAdd.push({ name: 'server_slots', type: 'INTEGER DEFAULT 1' });
                        }
                        if (!columnNames.includes('purchased_ram')) {
                            columnsToAdd.push({ name: 'purchased_ram', type: 'INTEGER DEFAULT 0' });
                        }
                        if (!columnNames.includes('purchased_cpu')) {
                            columnsToAdd.push({ name: 'purchased_cpu', type: 'INTEGER DEFAULT 0' });
                        }
                        if (!columnNames.includes('purchased_storage')) {
                            columnsToAdd.push({ name: 'purchased_storage', type: 'INTEGER DEFAULT 0' });
                        }
                        if (!columnNames.includes('pterodactyl_user_id')) {
                            columnsToAdd.push({ name: 'pterodactyl_user_id', type: 'TEXT' });
                        }
                        if (!columnNames.includes('client_api_key')) {
                            columnsToAdd.push({ name: 'client_api_key', type: 'TEXT' });
                        }
                        
                        // Add missing columns
                        columnsToAdd.forEach(col => {
                            console.log(`🔄 Adding ${col.name} column to users table...`);
                            db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
                                if (err) {
                                    console.error(`Error adding ${col.name} column:`, err);
                                } else {
                                    console.log(`✅ ${col.name} column added`);
                                }
                            });
                        });
                    }
                });
            });

            // Create Servers table
            db.run(`
                CREATE TABLE IF NOT EXISTS servers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    pterodactyl_id TEXT,
                    name TEXT NOT NULL,
                    ram INTEGER DEFAULT 0,
                    cpu INTEGER DEFAULT 0,
                    storage INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating servers table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Servers table created/verified');
                
                // Check and add missing columns to servers table
                db.all("PRAGMA table_info(servers)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        const columnsToAdd = [];
                        
                        if (!columnNames.includes('server_ip')) {
                            columnsToAdd.push({ name: 'server_ip', type: 'TEXT' });
                        }
                        if (!columnNames.includes('server_ip_alias')) {
                            columnsToAdd.push({ name: 'server_ip_alias', type: 'TEXT' });
                        }
                        if (!columnNames.includes('server_port')) {
                            columnsToAdd.push({ name: 'server_port', type: 'INTEGER' });
                        }
                        if (!columnNames.includes('public_address')) {
                            columnsToAdd.push({ name: 'public_address', type: 'TEXT' });
                        }
                        // BUGFIX #3: Add pterodactyl_identifier column for Client API panel URLs
                        // pterodactyl_id = internal numeric ID (for Application API)
                        // pterodactyl_identifier = 8-char string (for Client API panel URLs)
                        if (!columnNames.includes('pterodactyl_identifier')) {
                            columnsToAdd.push({ name: 'pterodactyl_identifier', type: 'TEXT' });
                        }
                        
                        // Add missing columns
                        columnsToAdd.forEach(col => {
                            console.log(`🔄 Adding ${col.name} column to servers table...`);
                            db.run(`ALTER TABLE servers ADD COLUMN ${col.name} ${col.type}`, (err) => {
                                if (err) {
                                    console.error(`Error adding ${col.name} column:`, err);
                                } else {
                                    console.log(`✅ ${col.name} column added`);
                                }
                            });
                        });
                    }
                });
            });

            // Create Linkvertise_Completions table
            db.run(`
                CREATE TABLE IF NOT EXISTS linkvertise_completions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    link_id TEXT NOT NULL,
                    coins_earned INTEGER DEFAULT 0,
                    completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating linkvertise_completions table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Linkvertise_Completions table created/verified');
            });

            // Create Resource_Purchases table
            db.run(`
                CREATE TABLE IF NOT EXISTS resource_purchases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    server_id INTEGER,
                    resource_type TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    coins_spent INTEGER NOT NULL,
                    purchased_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating resource_purchases table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Resource_Purchases table created/verified');
            });

            // Create Server_Slot_Purchases table
            db.run(`
                CREATE TABLE IF NOT EXISTS server_slot_purchases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    coins_spent INTEGER NOT NULL,
                    purchased_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating server_slot_purchases table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Server_Slot_Purchases table created/verified');
            });

            // Create Linkvertise_Links table
            db.run(`
                CREATE TABLE IF NOT EXISTS linkvertise_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    coins_earned INTEGER DEFAULT 10,
                    is_active INTEGER DEFAULT 1,
                    priority INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating linkvertise_links table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Linkvertise_Links table created/verified');
            });

            // Create Linkvertise_Config table
            db.run(`
                CREATE TABLE IF NOT EXISTS linkvertise_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    publisher_link TEXT,
                    publisher_id TEXT,
                    default_coins INTEGER DEFAULT 10,
                    cooldown_seconds INTEGER DEFAULT 30,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating linkvertise_config table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Linkvertise_Config table created/verified');
                
                // Check if cooldown_seconds column exists, add if not
                db.all("PRAGMA table_info(linkvertise_config)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        if (!columnNames.includes('cooldown_seconds')) {
                            console.log('🔄 Adding cooldown_seconds column to linkvertise_config table...');
                            db.run('ALTER TABLE linkvertise_config ADD COLUMN cooldown_seconds INTEGER DEFAULT 30', (err) => {
                                if (err) {
                                    console.error('Error adding cooldown_seconds column:', err);
                                } else {
                                    console.log('✅ cooldown_seconds column added');
                                    // Update existing rows to have default cooldown
                                    db.run('UPDATE linkvertise_config SET cooldown_seconds = 30 WHERE cooldown_seconds IS NULL', (err) => {
                                        if (err) {
                                            console.error('Error updating existing config:', err);
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
                
                // Create default config if it doesn't exist
                db.get('SELECT id FROM linkvertise_config', (err, row) => {
                    if (!err && !row) {
                        db.run('INSERT INTO linkvertise_config (publisher_link, default_coins, cooldown_seconds) VALUES (?, ?, ?)', 
                            ['', 10, 30], (err) => {
                                if (!err) {
                                    console.log('✅ Default Linkvertise config created');
                                }
                            });
                    }
                });
            });

            // Create Discord_Invites table
            db.run(`
                CREATE TABLE IF NOT EXISTS discord_invites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    inviter TEXT NOT NULL,
                    joined_user TEXT NOT NULL,
                    invite_code TEXT NOT NULL,
                    rewarded INTEGER DEFAULT 1,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating discord_invites table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Discord_Invites table created/verified');
            });

            // Create Discord_Config table
            db.run(`
                CREATE TABLE IF NOT EXISTS discord_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT,
                    chat_channel_id TEXT,
                    invite_channel_id TEXT,
                    reward_per_invite INTEGER DEFAULT 100,
                    enable_chat INTEGER DEFAULT 1,
                    enable_invite_rewards INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating discord_config table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Discord_Config table created/verified');
                
                // Create default config if it doesn't exist
                db.get('SELECT id FROM discord_config', (err, row) => {
                    if (!err && !row) {
                        db.run('INSERT INTO discord_config (guild_id, chat_channel_id, invite_channel_id, reward_per_invite, enable_chat, enable_invite_rewards) VALUES (?, ?, ?, ?, ?, ?)', 
                            ['', '', '', 100, 1, 1], (err) => {
                                if (!err) {
                                    console.log('✅ Default Discord config created');
                                }
                            });
                    }
                });
            });

            // Create Pterodactyl_Config table
            db.run(`
                CREATE TABLE IF NOT EXISTS pterodactyl_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    panel_url TEXT,
                    api_key TEXT,
                    client_api_key TEXT,
                    last_connected_at TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating pterodactyl_config table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Pterodactyl_Config table created/verified');
                
                // Check if client_api_key column exists, add if not
                db.all("PRAGMA table_info(pterodactyl_config)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        if (!columnNames.includes('client_api_key')) {
                            console.log('🔄 Adding client_api_key column to pterodactyl_config table...');
                            db.run('ALTER TABLE pterodactyl_config ADD COLUMN client_api_key TEXT', (err) => {
                                if (err) {
                                    console.error('Error adding client_api_key column:', err);
                                } else {
                                    console.log('✅ client_api_key column added');
                                }
                            });
                        }
                    }
                });
            });

            // Create Pterodactyl_Eggs table (cache for fetched eggs)
            db.run(`
                CREATE TABLE IF NOT EXISTS pterodactyl_eggs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    egg_id INTEGER UNIQUE NOT NULL,
                    nest_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    docker_image TEXT,
                    startup_command TEXT,
                    environment_variables TEXT,
                    is_active INTEGER DEFAULT 1,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating pterodactyl_eggs table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Pterodactyl_Eggs table created/verified');
            });

            // Create Pterodactyl_Allocations table
            db.run(`
                CREATE TABLE IF NOT EXISTS pterodactyl_allocations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    allocation_id INTEGER UNIQUE NOT NULL,
                    ip TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    node_id INTEGER NOT NULL,
                    priority INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating pterodactyl_allocations table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Pterodactyl_Allocations table created/verified');
                
                // Check and add missing columns to pterodactyl_allocations table
                db.all("PRAGMA table_info(pterodactyl_allocations)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        if (!columnNames.includes('ip_alias')) {
                            console.log('🔄 Adding ip_alias column to pterodactyl_allocations table...');
                            db.run('ALTER TABLE pterodactyl_allocations ADD COLUMN ip_alias TEXT', (err) => {
                                if (err) {
                                    console.error('Error adding ip_alias column:', err);
                                } else {
                                    console.log('✅ ip_alias column added');
                                }
                            });
                        }
                    }
                });
            });

            // Create Pterodactyl_Node_Aliases table
            db.run(`
                CREATE TABLE IF NOT EXISTS pterodactyl_node_aliases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    node_id INTEGER NOT NULL UNIQUE,
                    default_alias TEXT,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating pterodactyl_node_aliases table:', err);
                } else {
                    console.log('✅ Pterodactyl_Node_Aliases table created/verified');
                }
            });

            // Create Pterodactyl_Settings table
            db.run(`
                CREATE TABLE IF NOT EXISTS pterodactyl_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    default_nest_id INTEGER,
                    default_location_id INTEGER,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating pterodactyl_settings table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Pterodactyl_Settings table created/verified');
            });

            // Create Dashboard_Settings table
            db.run(`
                CREATE TABLE IF NOT EXISTS dashboard_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dashboard_name TEXT DEFAULT 'Aether Dashboard',
                    logo_path TEXT,
                    favicon_path TEXT,
                    logo_shape TEXT DEFAULT 'square',
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating dashboard_settings table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Dashboard_Settings table created/verified');
                
                // Add logo_shape column if it doesn't exist (for existing installations)
                db.run(`ALTER TABLE dashboard_settings ADD COLUMN logo_shape TEXT DEFAULT 'square'`, (err) => {
                    // Ignore error if column already exists
                });
                
                // Create default settings if table is empty
                db.get('SELECT id FROM dashboard_settings', (err, row) => {
                    if (!err && !row) {
                        db.run('INSERT INTO dashboard_settings (dashboard_name, logo_path, favicon_path, logo_shape) VALUES (?, ?, ?, ?)', 
                            ['Aether Dashboard', '/assets/defaults/aether-dashboard-logo.png', '/assets/defaults/aether-dashboard-favicon.ico', 'square'], 
                            (err) => {
                                if (!err) {
                                    console.log('✅ Default dashboard settings created');
                                }
                            }
                        );
                    }
                });
            });

            // ============================================
            // Theme Settings Table (v1.3)
            // ============================================
            db.run(`
                CREATE TABLE IF NOT EXISTS theme_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    
                    -- Sidebar Theme
                    sidebar_bg_type TEXT DEFAULT 'gradient',
                    sidebar_color_1 TEXT DEFAULT '#7c3aed',
                    sidebar_color_2 TEXT DEFAULT '#a855f7',
                    sidebar_color_3 TEXT DEFAULT '#06b6d4',
                    sidebar_gradient_direction TEXT DEFAULT '180deg',
                    sidebar_text_color TEXT DEFAULT '#ffffff',
                    sidebar_active_bg TEXT DEFAULT 'rgba(255, 255, 255, 0.25)',
                    sidebar_hover_bg TEXT DEFAULT 'rgba(255, 255, 255, 0.15)',
                    
                    -- Main Frame Theme
                    main_bg_type TEXT DEFAULT 'gradient',
                    main_color_1 TEXT DEFAULT '#0a0e27',
                    main_color_2 TEXT DEFAULT '#141b2d',
                    main_color_3 TEXT DEFAULT '#1a1f3a',
                    main_gradient_direction TEXT DEFAULT '135deg',
                    
                    -- Card Theme
                    card_bg_color TEXT DEFAULT 'rgba(30, 30, 50, 0.6)',
                    card_border_color TEXT DEFAULT 'rgba(124, 58, 237, 0.2)',
                    card_text_color TEXT DEFAULT '#f8fafc',
                    
                    -- Accent Colors
                    accent_primary TEXT DEFAULT '#7c3aed',
                    accent_secondary TEXT DEFAULT '#a855f7',
                    accent_tertiary TEXT DEFAULT '#06b6d4',
                    accent_success TEXT DEFAULT '#10b981',
                    accent_warning TEXT DEFAULT '#f59e0b',
                    accent_danger TEXT DEFAULT '#ef4444',
                    
                    -- Input Theme
                    input_bg_color TEXT DEFAULT 'rgba(30, 30, 50, 0.4)',
                    input_border_color TEXT DEFAULT 'rgba(124, 58, 237, 0.3)',
                    input_text_color TEXT DEFAULT '#f8fafc',
                    input_placeholder_color TEXT DEFAULT '#94a3b8',
                    
                    -- Header Theme
                    header_bg_color TEXT DEFAULT 'rgba(20, 27, 45, 0.8)',
                    header_text_color TEXT DEFAULT '#f8fafc',
                    
                    -- Active Preset
                    active_preset TEXT DEFAULT 'default',
                    
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating theme_settings table:', err);
                } else {
                    console.log('✅ Theme_Settings table created/verified');
                    
                    // Create default theme settings if table is empty
                    db.get('SELECT id FROM theme_settings', (err, row) => {
                        if (!err && !row) {
                            db.run(`INSERT INTO theme_settings (active_preset) VALUES (?)`, ['default'], (err) => {
                                if (!err) {
                                    console.log('✅ Default theme settings created');
                                }
                            });
                        }
                    });
                }
            });

            // ============================================
            // FEATURE 2: Server Templates
            // ============================================
            // Create Server_Templates table
            db.run(`
                CREATE TABLE IF NOT EXISTS server_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    egg_id INTEGER NOT NULL,
                    ram_mb INTEGER DEFAULT 1024,
                    cpu_percent INTEGER DEFAULT 100,
                    storage_mb INTEGER DEFAULT 5120,
                    is_active INTEGER DEFAULT 1,
                    icon TEXT DEFAULT '🎮',
                    display_order INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating server_templates table:', err);
                } else {
                    console.log('✅ Server_Templates table created/verified');
                }
            });

            // Create Resource_Prices table
            db.run(`
                CREATE TABLE IF NOT EXISTS resource_prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ram_coins_per_set INTEGER DEFAULT 1,
                    ram_gb_per_set INTEGER DEFAULT 1,
                    cpu_coins_per_set INTEGER DEFAULT 1,
                    cpu_percent_per_set INTEGER DEFAULT 1,
                    storage_coins_per_set INTEGER DEFAULT 1,
                    storage_gb_per_set INTEGER DEFAULT 1,
                    server_slot_price INTEGER DEFAULT 100,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating resource_prices table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Resource_Prices table created/verified');
                
                // Helper function to create default prices and admin
                const createDefaultPricesAndAdmin = () => {
                    db.get('SELECT id FROM resource_prices', (err, row) => {
                        if (!err && !row) {
                            db.run('INSERT INTO resource_prices (ram_coins_per_set, ram_gb_per_set, cpu_coins_per_set, cpu_percent_per_set, storage_coins_per_set, storage_gb_per_set, server_slot_price) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                                [1, 1, 1, 1, 1, 1, 100], (err) => {
                                    if (!err) {
                                        console.log('✅ Default resource prices created');
                                    }
                                });
                        } else if (!err && row) {
                            // Check if server_slot_price column exists, add if not
                            db.all("PRAGMA table_info(resource_prices)", (err, columns) => {
                                if (!err) {
                                    const columnNames = columns.map(col => col.name);
                                    if (!columnNames.includes('server_slot_price')) {
                                        console.log('🔄 Adding server_slot_price column to resource_prices table...');
                                        db.run('ALTER TABLE resource_prices ADD COLUMN server_slot_price INTEGER DEFAULT 100', (err) => {
                                            if (err) {
                                                console.error('Error adding server_slot_price column:', err);
                                            } else {
                                                console.log('✅ server_slot_price column added');
                                                // Set default price for existing rows
                                                db.run('UPDATE resource_prices SET server_slot_price = 100 WHERE server_slot_price IS NULL', (err) => {
                                                    if (err) {
                                                        console.error('Error updating existing prices:', err);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                }
                            });
                        }
                        
                        createDefaultAdmin().then(() => {
                            resolve();
                        }).catch(reject);
                    });
                };
                
                // Check if table has old schema and migrate
                db.all("PRAGMA table_info(resource_prices)", (err, columns) => {
                    if (err) {
                        console.error('Error checking table schema:', err);
                        // Continue anyway - might be first run
                        createDefaultPricesAndAdmin();
                        return;
                    }
                    
                    const columnNames = columns.map(col => col.name);
                    const hasOldSchema = columnNames.includes('ram_price_per_mb');
                    const hasNewSchema = columnNames.includes('ram_coins_per_set');
                    
                    if (hasOldSchema && !hasNewSchema) {
                        // Old schema exists, need to migrate
                        console.log('🔄 Migrating resource_prices table to new schema...');
                        db.run('DROP TABLE resource_prices', (err) => {
                            if (err) {
                                console.error('Error dropping old table:', err);
                                // Try to continue anyway
                                createDefaultPricesAndAdmin();
                                return;
                            }
                            
                            // Recreate with new schema
                            db.run(`
                                CREATE TABLE resource_prices (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    ram_coins_per_set INTEGER DEFAULT 1,
                                    ram_gb_per_set INTEGER DEFAULT 1,
                                    cpu_coins_per_set INTEGER DEFAULT 1,
                                    cpu_percent_per_set INTEGER DEFAULT 1,
                                    storage_coins_per_set INTEGER DEFAULT 1,
                                    storage_gb_per_set INTEGER DEFAULT 1,
                                    server_slot_price INTEGER DEFAULT 100,
                                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                                )
                            `, (err) => {
                                if (err) {
                                    console.error('Error recreating table:', err);
                                    createDefaultPricesAndAdmin();
                                    return;
                                }
                                console.log('✅ Table migrated successfully');
                                
                                // Create default prices
                                db.run('INSERT INTO resource_prices (ram_coins_per_set, ram_gb_per_set, cpu_coins_per_set, cpu_percent_per_set, storage_coins_per_set, storage_gb_per_set, server_slot_price) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                                    [1, 1, 1, 1, 1, 1, 100], (err) => {
                                        if (!err) {
                                            console.log('✅ Default resource prices created');
                                        }
                                        createDefaultAdmin().then(() => {
                                            resolve();
                                        }).catch(reject);
                                    });
                            });
                        });
                    } else {
                        // New schema or no table, create default prices if needed
                        createDefaultPricesAndAdmin();
                    }
                });
            });
        });
    });
}

// Create default admin user
function createDefaultAdmin() {
    return new Promise((resolve, reject) => {
        const bcrypt = require('bcrypt');
        
        // Check if admin exists
        db.get('SELECT id FROM users WHERE is_admin = 1', (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row) {
                console.log('✅ Admin user already exists');
                resolve();
                return;
            }
            
            // Create admin user with ID 0
            // Default: username: admin, password: admin123 (change this!)
            const defaultPassword = 'admin123';
            bcrypt.hash(defaultPassword, 10, (err, hash) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Insert admin with explicit ID 0
                db.run(`
                    INSERT INTO users (id, username, email, password, is_admin, coins)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [0, 'admin', 'admin@aether.local', hash, 1, 1000], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Update SQLite sequence to prevent ID conflicts
                    // Set sequence to 0 so next auto-increment starts at 1
                    db.run('UPDATE sqlite_sequence SET seq = 0 WHERE name = "users"', (seqErr) => {
                        if (seqErr) {
                            // If sqlite_sequence doesn't exist yet, create it
                            // This happens on first insert with AUTOINCREMENT
                            // SQLite will create it automatically on next insert, so this is fine
                            console.log('⚠️  Note: sqlite_sequence will be created on next insert');
                        }
                        
                        console.log('✅ Default admin user created with ID 0');
                        console.log('⚠️  Username: admin, Password: admin123');
                        console.log('⚠️  Please change the admin password after first login!');
                        resolve();
                    });
                });
            });
        });
    });
}

// Helper function to run queries
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Helper function to get single row
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Helper function to run INSERT/UPDATE/DELETE
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
}

// Close database connection
function close() {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Database connection closed');
                resolve();
            }
        });
    });
}

// Helper function to run transactions
// Note: SQLite3 doesn't have native promise-based transactions, so we use a callback-based approach
function transaction(callback) {
    return new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (beginErr) => {
            if (beginErr) {
                reject(beginErr);
                return;
            }
            
            // Execute the callback (which should return a promise)
            Promise.resolve(callback())
                .then((result) => {
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            // If commit fails, try to rollback
                            db.run('ROLLBACK', (rollbackErr) => {
                                if (rollbackErr) {
                                    console.error('Error during rollback:', rollbackErr);
                                }
                                reject(commitErr);
                            });
                        } else {
                            resolve(result);
                        }
                    });
                })
                .catch((error) => {
                    // Rollback on error
                    db.run('ROLLBACK', (rollbackErr) => {
                        if (rollbackErr) {
                            console.error('Error during rollback:', rollbackErr);
                        }
                        reject(error);
                    });
                });
        });
    });
}

// Initialize database on module load
initializeDatabase().catch(console.error);

module.exports = {
    db,
    query,
    get,
    run,
    transaction,
    close,
    initializeDatabase
};

