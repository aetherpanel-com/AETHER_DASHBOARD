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
                        if (!columnNames.includes('panel_password')) {
                            columnsToAdd.push({ name: 'panel_password', type: 'TEXT' });
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

                        // Daily login rewards (streak fields)
                        // Default 0 / null-safe strings so existing users are unaffected.
                        if (!columnNames.includes('streak_day')) {
                            try {
                                console.log(`🔄 Adding streak_day column to users table...`);
                                db.run(`ALTER TABLE users ADD COLUMN streak_day INTEGER DEFAULT 0`, (err) => {
                                    if (err) console.error('Error adding streak_day column:', err);
                                    else console.log('✅ streak_day column added to users table');
                                });
                            } catch (e) {
                                console.error('Error adding streak_day column:', e);
                            }
                        }

                        if (!columnNames.includes('streak_last_claim')) {
                            try {
                                console.log(`🔄 Adding streak_last_claim column to users table...`);
                                db.run(`ALTER TABLE users ADD COLUMN streak_last_claim TEXT`, (err) => {
                                    if (err) console.error('Error adding streak_last_claim column:', err);
                                    else console.log('✅ streak_last_claim column added to users table');
                                });
                            } catch (e) {
                                console.error('Error adding streak_last_claim column:', e);
                            }
                        }

                        // User onboarding checklist (bit flags)
                        if (!columnNames.includes('onboarding_flags')) {
                            try {
                                console.log(`🔄 Adding onboarding_flags column to users table...`);
                                db.run(`ALTER TABLE users ADD COLUMN onboarding_flags INTEGER DEFAULT 0`, (err) => {
                                    if (err) console.error('Error adding onboarding_flags column:', err);
                                    else console.log('✅ onboarding_flags column added to users table');
                                });
                            } catch (e) {
                                console.error('Error adding onboarding_flags column:', e);
                            }
                        }


                    }
                });

                // Create daily login reward tables + seed defaults
                db.run(`
                    CREATE TABLE IF NOT EXISTS daily_reward_config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        day_number INTEGER UNIQUE,
                        coins INTEGER,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating daily_reward_config table:', err);
                        return;
                    }

                    const seedRewards = [
                        [1, 50],
                        [2, 100],
                        [3, 150],
                        [4, 200],
                        [5, 250],
                        [6, 300],
                        [7, 500]
                    ];

                    seedRewards.forEach(([dayNumber, coins]) => {
                        db.run(
                            `INSERT OR IGNORE INTO daily_reward_config (day_number, coins) VALUES (?, ?)`,
                            [dayNumber, coins],
                            (err) => {
                                if (err) console.error('Error seeding daily_reward_config:', err);
                            }
                        );
                    });
                });

                db.run(`
                    CREATE TABLE IF NOT EXISTS feature_flags (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE,
                        enabled INTEGER DEFAULT 1,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating feature_flags table:', err);
                        return;
                    }

                    db.run(
                        `INSERT OR IGNORE INTO feature_flags (name, enabled) VALUES ('daily_rewards', 1)`,
                        [],
                        (err) => {
                            if (err) console.error('Error seeding feature_flags:', err);
                        }
                    );


                    // Add retention column for audit logs (legacy installs)
                    try {
                        db.run(`ALTER TABLE feature_flags ADD COLUMN log_retention_days INTEGER DEFAULT 90`, () => {
                            // Ignore if already exists
                        });
                    } catch (e) {
                        // Ignore migration errors
                    }

                    // Ensure audit_logs settings row exists
                    setTimeout(() => {
                        db.run(
                            `INSERT OR IGNORE INTO feature_flags (name, enabled, log_retention_days) VALUES ('audit_logs', 1, 90)`,
                            [],
                            () => {
                                // Ignore if schema not ready yet
                            }
                        );

                        // Startup purge by retention days
                        db.get(
                            `SELECT log_retention_days FROM feature_flags WHERE name = 'audit_logs' ORDER BY id DESC LIMIT 1`,
                            [],
                            (retErr, retentionRow) => {
                                if (retErr) return;
                                const retentionDays = Number(retentionRow?.log_retention_days || 0);
                                if (retentionDays > 0) {
                                    db.run(
                                        `DELETE FROM activity_logs WHERE created_at < datetime('now', ?)`,
                                        [`-${retentionDays} days`],
                                        () => {
                                            // best-effort cleanup
                                        }
                                    );
                                }
                            }
                        );
                    }, 50);
                });

                db.run(`
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        username TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        description TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating activity_logs table:', err);
                        return;
                    }
                    console.log('✅ activity_logs table created/verified');
                });

            });

            // Notifications (supports per-user + global notifications)
            db.run(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    type TEXT DEFAULT 'info',
                    title TEXT,
                    message TEXT,
                    is_read INTEGER DEFAULT 0,
                    is_global INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating notifications table:', err);
                    return;
                }
                console.log('✅ notifications table created/verified');
            });

            // Per-user read state for global notifications
            db.run(`
                CREATE TABLE IF NOT EXISTS notification_reads (
                    user_id INTEGER NOT NULL,
                    notification_id INTEGER NOT NULL,
                    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, notification_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating notification_reads table:', err);
                    return;
                }
                console.log('✅ notification_reads table created/verified');
            });

            // Server health timeline recorder
            db.run(`
                CREATE TABLE IF NOT EXISTS server_health_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating server_health_logs table:', err);
                    return;
                }

                // Keep an index for efficient timeline queries.
                db.run(
                    `CREATE INDEX IF NOT EXISTS idx_server_health_logs_server_id_recorded_at
                     ON server_health_logs (server_id, recorded_at DESC)`,
                    (idxErr) => {
                        if (idxErr) {
                            console.error('Error creating idx_server_health_logs index:', idxErr);
                        } else {
                            console.log('✅ server_health_logs index created/verified');
                        }
                    }
                );
            });

            // Maintenance mode schedule windows
            db.run(`
                CREATE TABLE IF NOT EXISTS maintenance_schedule (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT DEFAULT 'Scheduled Maintenance',
                    message TEXT,
                    starts_at DATETIME,
                    ends_at DATETIME,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating maintenance_schedule table:', err);
                    return;
                }
                console.log('✅ maintenance_schedule table created/verified');
            });

            // Admin broadcast messages (global announcements)
            db.run(`
                CREATE TABLE IF NOT EXISTS broadcast_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    message TEXT,
                    segment TEXT DEFAULT 'all',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating broadcast_messages table:', err);
                    return;
                }
                console.log('✅ broadcast_messages table created/verified');
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
                        if (!columnNames.includes('renewal_next_due_at')) {
                            columnsToAdd.push({ name: 'renewal_next_due_at', type: 'TEXT' });
                        }
                        if (!columnNames.includes('renewal_last_processed_at')) {
                            columnsToAdd.push({ name: 'renewal_last_processed_at', type: 'TEXT' });
                        }
                        if (!columnNames.includes('renewal_status')) {
                            columnsToAdd.push({ name: 'renewal_status', type: "TEXT DEFAULT 'active'" });
                        }
                        if (!columnNames.includes('renewal_overdue_count')) {
                            columnsToAdd.push({ name: 'renewal_overdue_count', type: 'INTEGER DEFAULT 0' });
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

            // Renewal system settings (global MVP policy)
            db.run(`
                CREATE TABLE IF NOT EXISTS renewal_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    renewal_enabled INTEGER DEFAULT 0,
                    renewal_frequency TEXT DEFAULT 'monthly',
                    renewal_coins_per_cycle INTEGER DEFAULT 0,
                    renewal_deduction_mode TEXT DEFAULT 'manual',
                    renewal_grace_cycles INTEGER DEFAULT 0,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating renewal_settings table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ renewal_settings table created/verified');
                db.get('SELECT id FROM renewal_settings LIMIT 1', (rowErr, row) => {
                    if (!rowErr && !row) {
                        db.run(
                            `INSERT INTO renewal_settings (renewal_enabled, renewal_frequency, renewal_coins_per_cycle, renewal_deduction_mode, renewal_grace_cycles)
                             VALUES (0, 'monthly', 0, 'manual', 0)`
                        );
                    }
                });
            });

            // Renewal processing/audit events
            db.run(`
                CREATE TABLE IF NOT EXISTS server_renewal_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    due_at TEXT,
                    processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    amount INTEGER DEFAULT 0,
                    mode TEXT,
                    result TEXT,
                    notes TEXT,
                    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating server_renewal_events table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ server_renewal_events table created/verified');
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
                
                db.all("PRAGMA table_info(linkvertise_links)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        if (!columnNames.includes('max_completions')) {
                            console.log('🔄 Adding max_completions column to linkvertise_links table...');
                            db.run('ALTER TABLE linkvertise_links ADD COLUMN max_completions INTEGER DEFAULT 0', (err) => {});
                        }
                        if (!columnNames.includes('completion_window_hours')) {
                            console.log('🔄 Adding completion_window_hours column to linkvertise_links table...');
                            db.run('ALTER TABLE linkvertise_links ADD COLUMN completion_window_hours INTEGER DEFAULT 24', (err) => {});
                        }
                    }
                });
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

            // Create Adsterra_Config table
            db.run(`
                CREATE TABLE IF NOT EXISTS adsterra_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    enabled INTEGER DEFAULT 0,
                    publisher_id TEXT DEFAULT '',
                    api_token TEXT DEFAULT '',
                    default_ad_format TEXT DEFAULT 'banner',
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating adsterra_config table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ adsterra_config table created/verified');
                db.get('SELECT id FROM adsterra_config LIMIT 1', (rowErr, row) => {
                    if (!rowErr && !row) {
                        db.run(
                            `INSERT INTO adsterra_config (enabled, publisher_id, api_token, default_ad_format)
                             VALUES (0, '', '', 'banner')`
                        );
                    }
                });
            });

            // Create Adsterra_Placements table
            db.run(`
                CREATE TABLE IF NOT EXISTS adsterra_placements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    placement_key TEXT NOT NULL,
                    ad_format TEXT NOT NULL DEFAULT 'banner',
                    target_devices TEXT NOT NULL DEFAULT 'all',
                    script_placement TEXT NOT NULL DEFAULT 'body_end',
                    ad_code TEXT NOT NULL DEFAULT '',
                    smartlink_url TEXT DEFAULT '',
                    is_active INTEGER DEFAULT 1,
                    sort_order INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating adsterra_placements table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ adsterra_placements table created/verified');
            });

            // Create Discord_Invites table
            db.run(`
                CREATE TABLE IF NOT EXISTS discord_invites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    inviter TEXT NOT NULL,
                    joined_user TEXT NOT NULL,
                    invite_code TEXT NOT NULL,
                    rewarded INTEGER DEFAULT 1,
                    coins_awarded INTEGER DEFAULT 0,
                    left_at INTEGER DEFAULT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating discord_invites table:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Discord_Invites table created/verified');

                db.run("ALTER TABLE discord_invites ADD COLUMN coins_awarded INTEGER DEFAULT 0", (err) => {
                    // Column may already exist, ignore error
                });
                db.run("ALTER TABLE discord_invites ADD COLUMN left_at INTEGER DEFAULT NULL", (err) => {
                    // Column may already exist, ignore error
                });
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
                    deduct_per_invite INTEGER DEFAULT 0,
                    discord_invite_link TEXT DEFAULT '',
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

                db.run("ALTER TABLE discord_config ADD COLUMN deduct_per_invite INTEGER DEFAULT 0", (err) => {
                    // Column may already exist, ignore error
                });
                db.run("ALTER TABLE discord_config ADD COLUMN discord_invite_link TEXT DEFAULT ''", (err) => {
                    // Column may already exist, ignore error
                });
                
                // Create default config if it doesn't exist
                db.get('SELECT id FROM discord_config', (err, row) => {
                    if (!err && !row) {
                        db.run('INSERT INTO discord_config (guild_id, chat_channel_id, invite_channel_id, reward_per_invite, enable_chat, enable_invite_rewards, deduct_per_invite, discord_invite_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                            ['', '', '', 100, 1, 1, 0, ''], (err) => {
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
                    
                    -- Sidebar Theme (default: Midnight Dark preset)
                    sidebar_bg_type TEXT DEFAULT 'gradient',
                    sidebar_color_1 TEXT DEFAULT '#18181b',
                    sidebar_color_2 TEXT DEFAULT '#27272a',
                    sidebar_color_3 TEXT DEFAULT '#3f3f46',
                    sidebar_gradient_direction TEXT DEFAULT '180deg',
                    sidebar_text_color TEXT DEFAULT '#fafafa',
                    sidebar_active_bg TEXT DEFAULT 'rgba(255, 255, 255, 0.15)',
                    sidebar_hover_bg TEXT DEFAULT 'rgba(255, 255, 255, 0.1)',
                    
                    -- Main Frame Theme
                    main_bg_type TEXT DEFAULT 'gradient',
                    main_color_1 TEXT DEFAULT '#09090b',
                    main_color_2 TEXT DEFAULT '#18181b',
                    main_color_3 TEXT DEFAULT '#27272a',
                    main_gradient_direction TEXT DEFAULT '135deg',
                    
                    -- Card Theme
                    card_bg_color TEXT DEFAULT 'rgba(39, 39, 42, 0.6)',
                    card_border_color TEXT DEFAULT 'rgba(113, 113, 122, 0.3)',
                    card_text_color TEXT DEFAULT '#fafafa',
                    
                    -- Accent Colors
                    accent_primary TEXT DEFAULT '#a1a1aa',
                    accent_secondary TEXT DEFAULT '#d4d4d8',
                    accent_tertiary TEXT DEFAULT '#e4e4e7',
                    accent_success TEXT DEFAULT '#22c55e',
                    accent_warning TEXT DEFAULT '#f59e0b',
                    accent_danger TEXT DEFAULT '#ef4444',
                    
                    -- Input Theme
                    input_bg_color TEXT DEFAULT 'rgba(39, 39, 42, 0.4)',
                    input_border_color TEXT DEFAULT 'rgba(113, 113, 122, 0.3)',
                    input_text_color TEXT DEFAULT '#fafafa',
                    input_placeholder_color TEXT DEFAULT '#a1a1aa',
                    
                    -- Header Theme
                    header_bg_color TEXT DEFAULT 'rgba(24, 24, 27, 0.9)',
                    header_text_color TEXT DEFAULT '#fafafa',
                    
                    -- Active Preset
                    active_preset TEXT DEFAULT 'midnight',
                    
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
                            db.run(`INSERT INTO theme_settings (active_preset) VALUES (?)`, ['midnight'], (err) => {
                                if (!err) {
                                    console.log('✅ Default theme settings created');
                                }
                            });
                        }
                    });

                    // Removed "Default Purple" preset — migrate legacy active_preset to Midnight Dark
                    db.run(
                        `UPDATE theme_settings SET
                            sidebar_bg_type = 'gradient',
                            sidebar_color_1 = '#18181b',
                            sidebar_color_2 = '#27272a',
                            sidebar_color_3 = '#3f3f46',
                            sidebar_gradient_direction = '180deg',
                            sidebar_text_color = '#fafafa',
                            sidebar_active_bg = 'rgba(255, 255, 255, 0.15)',
                            sidebar_hover_bg = 'rgba(255, 255, 255, 0.1)',
                            main_bg_type = 'gradient',
                            main_color_1 = '#09090b',
                            main_color_2 = '#18181b',
                            main_color_3 = '#27272a',
                            main_gradient_direction = '135deg',
                            card_bg_color = 'rgba(39, 39, 42, 0.6)',
                            card_border_color = 'rgba(113, 113, 122, 0.3)',
                            card_text_color = '#fafafa',
                            accent_primary = '#a1a1aa',
                            accent_secondary = '#d4d4d8',
                            accent_tertiary = '#e4e4e7',
                            accent_success = '#22c55e',
                            accent_warning = '#f59e0b',
                            accent_danger = '#ef4444',
                            input_bg_color = 'rgba(39, 39, 42, 0.4)',
                            input_border_color = 'rgba(113, 113, 122, 0.3)',
                            input_text_color = '#fafafa',
                            input_placeholder_color = '#a1a1aa',
                            header_bg_color = 'rgba(24, 24, 27, 0.9)',
                            header_text_color = '#fafafa',
                            active_preset = 'midnight',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE active_preset = 'default'`,
                        (mErr) => {
                            if (mErr) {
                                console.error('Theme preset migration:', mErr);
                            }
                        }
                    );
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
                    database_coins_per_set INTEGER DEFAULT 10,
                    database_count_per_set INTEGER DEFAULT 1,
                    backup_coins_per_set INTEGER DEFAULT 10,
                    backup_count_per_set INTEGER DEFAULT 1,
                    port_coins_per_set INTEGER DEFAULT 100,
                    port_count_per_set INTEGER DEFAULT 1,
                    max_ram_gb INTEGER DEFAULT 0,
                    max_cpu_percent INTEGER DEFAULT 0,
                    max_storage_gb INTEGER DEFAULT 0,
                    max_server_slots INTEGER DEFAULT 0,
                    max_databases INTEGER DEFAULT 0,
                    max_backups INTEGER DEFAULT 0,
                    max_ports INTEGER DEFAULT 0,
                    ram_icon_path TEXT DEFAULT '/icons/ram.svg',
                    cpu_icon_path TEXT DEFAULT '/icons/cpu.svg',
                    storage_icon_path TEXT DEFAULT '/icons/storage.svg',
                    server_slot_icon_path TEXT DEFAULT '/icons/server-slot.svg',
                    database_icon_path TEXT DEFAULT '/icons/database.svg',
                    backup_icon_path TEXT DEFAULT '/icons/backup.svg',
                    port_icon_path TEXT DEFAULT '/icons/ip.svg',
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
                            db.run('INSERT INTO resource_prices (ram_coins_per_set, ram_gb_per_set, cpu_coins_per_set, cpu_percent_per_set, storage_coins_per_set, storage_gb_per_set, server_slot_price, database_coins_per_set, database_count_per_set, backup_coins_per_set, backup_count_per_set, port_coins_per_set, port_count_per_set, max_ram_gb, max_cpu_percent, max_storage_gb, max_server_slots, max_databases, max_backups, max_ports, ram_icon_path, cpu_icon_path, storage_icon_path, server_slot_icon_path, database_icon_path, backup_icon_path, port_icon_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                                [1, 1, 1, 1, 1, 1, 100, 10, 1, 10, 1, 100, 1, 0, 0, 0, 0, 0, 0, 0, '/icons/ram.svg', '/icons/cpu.svg', '/icons/storage.svg', '/icons/server-slot.svg', '/icons/database.svg', '/icons/backup.svg', '/icons/ip.svg'], (err) => {
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
                                    if (!columnNames.includes('max_ram_gb')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN max_ram_gb INTEGER DEFAULT 0', (err) => {
                                            if (err) console.error('Error adding max_ram_gb column:', err);
                                            else console.log('✅ max_ram_gb column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('max_cpu_percent')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN max_cpu_percent INTEGER DEFAULT 0', (err) => {
                                            if (err) console.error('Error adding max_cpu_percent column:', err);
                                            else console.log('✅ max_cpu_percent column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('max_storage_gb')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN max_storage_gb INTEGER DEFAULT 0', (err) => {
                                            if (err) console.error('Error adding max_storage_gb column:', err);
                                            else console.log('✅ max_storage_gb column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('max_server_slots')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN max_server_slots INTEGER DEFAULT 0', (err) => {
                                            if (err) console.error('Error adding max_server_slots column:', err);
                                            else console.log('✅ max_server_slots column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('database_coins_per_set')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN database_coins_per_set INTEGER DEFAULT 10', (err) => {
                                            if (err) console.error('Error adding database_coins_per_set column:', err);
                                            else console.log('✅ database_coins_per_set column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('database_count_per_set')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN database_count_per_set INTEGER DEFAULT 1', (err) => {
                                            if (err) console.error('Error adding database_count_per_set column:', err);
                                            else console.log('✅ database_count_per_set column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('backup_coins_per_set')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN backup_coins_per_set INTEGER DEFAULT 10', (err) => {
                                            if (err) console.error('Error adding backup_coins_per_set column:', err);
                                            else console.log('✅ backup_coins_per_set column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('backup_count_per_set')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN backup_count_per_set INTEGER DEFAULT 1', (err) => {
                                            if (err) console.error('Error adding backup_count_per_set column:', err);
                                            else console.log('✅ backup_count_per_set column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('port_coins_per_set')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN port_coins_per_set INTEGER DEFAULT 100', (err) => {
                                            if (err) console.error('Error adding port_coins_per_set column:', err);
                                            else console.log('✅ port_coins_per_set column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('port_count_per_set')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN port_count_per_set INTEGER DEFAULT 1', (err) => {
                                            if (err) console.error('Error adding port_count_per_set column:', err);
                                            else console.log('✅ port_count_per_set column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('max_databases')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN max_databases INTEGER DEFAULT 0', (err) => {
                                            if (err) console.error('Error adding max_databases column:', err);
                                            else console.log('✅ max_databases column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('max_backups')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN max_backups INTEGER DEFAULT 0', (err) => {
                                            if (err) console.error('Error adding max_backups column:', err);
                                            else console.log('✅ max_backups column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('max_ports')) {
                                        db.run('ALTER TABLE resource_prices ADD COLUMN max_ports INTEGER DEFAULT 0', (err) => {
                                            if (err) console.error('Error adding max_ports column:', err);
                                            else console.log('✅ max_ports column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('ram_icon_path')) {
                                        db.run("ALTER TABLE resource_prices ADD COLUMN ram_icon_path TEXT DEFAULT '/icons/ram.svg'", (err) => {
                                            if (err) console.error('Error adding ram_icon_path column:', err);
                                            else console.log('✅ ram_icon_path column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('cpu_icon_path')) {
                                        db.run("ALTER TABLE resource_prices ADD COLUMN cpu_icon_path TEXT DEFAULT '/icons/cpu.svg'", (err) => {
                                            if (err) console.error('Error adding cpu_icon_path column:', err);
                                            else console.log('✅ cpu_icon_path column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('storage_icon_path')) {
                                        db.run("ALTER TABLE resource_prices ADD COLUMN storage_icon_path TEXT DEFAULT '/icons/storage.svg'", (err) => {
                                            if (err) console.error('Error adding storage_icon_path column:', err);
                                            else console.log('✅ storage_icon_path column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('server_slot_icon_path')) {
                                        db.run("ALTER TABLE resource_prices ADD COLUMN server_slot_icon_path TEXT DEFAULT '/icons/server-slot.svg'", (err) => {
                                            if (err) console.error('Error adding server_slot_icon_path column:', err);
                                            else console.log('✅ server_slot_icon_path column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('database_icon_path')) {
                                        db.run("ALTER TABLE resource_prices ADD COLUMN database_icon_path TEXT DEFAULT '/icons/database.svg'", (err) => {
                                            if (err) console.error('Error adding database_icon_path column:', err);
                                            else console.log('✅ database_icon_path column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('backup_icon_path')) {
                                        db.run("ALTER TABLE resource_prices ADD COLUMN backup_icon_path TEXT DEFAULT '/icons/backup.svg'", (err) => {
                                            if (err) console.error('Error adding backup_icon_path column:', err);
                                            else console.log('✅ backup_icon_path column added to resource_prices');
                                        });
                                    }
                                    if (!columnNames.includes('port_icon_path')) {
                                        db.run("ALTER TABLE resource_prices ADD COLUMN port_icon_path TEXT DEFAULT '/icons/ip.svg'", (err) => {
                                            if (err) console.error('Error adding port_icon_path column:', err);
                                            else console.log('✅ port_icon_path column added to resource_prices');
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
                                    database_coins_per_set INTEGER DEFAULT 10,
                                    database_count_per_set INTEGER DEFAULT 1,
                                    backup_coins_per_set INTEGER DEFAULT 10,
                                    backup_count_per_set INTEGER DEFAULT 1,
                                    port_coins_per_set INTEGER DEFAULT 100,
                                    port_count_per_set INTEGER DEFAULT 1,
                                    max_ram_gb INTEGER DEFAULT 0,
                                    max_cpu_percent INTEGER DEFAULT 0,
                                    max_storage_gb INTEGER DEFAULT 0,
                                    max_server_slots INTEGER DEFAULT 0,
                                    max_databases INTEGER DEFAULT 0,
                                    max_backups INTEGER DEFAULT 0,
                                    max_ports INTEGER DEFAULT 0,
                                    ram_icon_path TEXT DEFAULT '/icons/ram.svg',
                                    cpu_icon_path TEXT DEFAULT '/icons/cpu.svg',
                                    storage_icon_path TEXT DEFAULT '/icons/storage.svg',
                                    server_slot_icon_path TEXT DEFAULT '/icons/server-slot.svg',
                                    database_icon_path TEXT DEFAULT '/icons/database.svg',
                                    backup_icon_path TEXT DEFAULT '/icons/backup.svg',
                                    port_icon_path TEXT DEFAULT '/icons/ip.svg',
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
                                db.run('INSERT INTO resource_prices (ram_coins_per_set, ram_gb_per_set, cpu_coins_per_set, cpu_percent_per_set, storage_coins_per_set, storage_gb_per_set, server_slot_price, database_coins_per_set, database_count_per_set, backup_coins_per_set, backup_count_per_set, port_coins_per_set, port_count_per_set, max_ram_gb, max_cpu_percent, max_storage_gb, max_server_slots, max_databases, max_backups, max_ports, ram_icon_path, cpu_icon_path, storage_icon_path, server_slot_icon_path, database_icon_path, backup_icon_path, port_icon_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                                    [1, 1, 1, 1, 1, 1, 100, 10, 1, 10, 1, 100, 1, 0, 0, 0, 0, 0, 0, 0, '/icons/ram.svg', '/icons/cpu.svg', '/icons/storage.svg', '/icons/server-slot.svg', '/icons/database.svg', '/icons/backup.svg', '/icons/ip.svg'], (err) => {
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

