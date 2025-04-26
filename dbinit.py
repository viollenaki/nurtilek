import sqlite3
from sqlite3 import Row
import bcrypt
import os

def get_db_connection():
    """Create and return a database connection"""
    db_path = 'database.db'
    print(f"Connecting to database at: {os.path.abspath(db_path)}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def force_create_tables():
    """Create all necessary tables forcefully"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("Creating tables...")
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password TEXT NOT NULL,
        profile_photo BLOB DEFAULT NULL,
        is_verified BOOLEAN DEFAULT 0,
        verification_code TEXT,
        verification_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create chats table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_name TEXT,
        chat_type TEXT NOT NULL,  -- 'dialog' или 'group'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create dialogs table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS dialogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (user1_id) REFERENCES users (id),
        FOREIGN KEY (user2_id) REFERENCES users (id),
        UNIQUE(user1_id, user2_id)
    )
    ''')
    
    # Create group_chats table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        admin_id INTEGER NOT NULL,
        description TEXT,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (admin_id) REFERENCES users (id)
    )
    ''')
    
    # Create group_members table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_chat_id) REFERENCES group_chats (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(group_chat_id, user_id)
    )
    ''')
    
    # Create messages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT 0,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users (id)
    )
    ''')
    
    conn.commit()
    conn.close()
    print("Tables created successfully")

def check_and_update_schema():
    """Check if the database schema needs updates and apply them"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if users table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if not cursor.fetchone():
        conn.close()
        print("Users table doesn't exist, forcing table creation...")
        force_create_tables()
        return
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Add missing columns
    if 'email' not in columns:
        print("Adding email column...")
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT UNIQUE")
    
    if 'is_verified' not in columns:
        print("Adding is_verified column...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0")
    
    if 'verification_code' not in columns:
        print("Adding verification_code column...")
        cursor.execute("ALTER TABLE users ADD COLUMN verification_code TEXT")
    
    if 'verification_expiry' not in columns:
        print("Adding verification_expiry column...")
        cursor.execute("ALTER TABLE users ADD COLUMN verification_expiry TIMESTAMP")
    
    conn.commit()
    conn.close()

def init_db():
    """Initialize database with required tables"""
    # Check if database file exists
    db_exists = os.path.exists('database.db')
    
    # If you want to reset the database, uncomment these lines
    if os.environ.get('RESET_DB', '').lower() == 'true':
        if db_exists:
            os.remove('database.db')
            print("Database reset: database.db removed")
            db_exists = False
    
    if not db_exists:
        print("Database file does not exist, creating new database...")
        force_create_tables()
    else:
        print("Database file already exists")
        check_and_update_schema()

# Directly initialize DB when this module is imported
init_db()

if __name__ == "__main__":
    print("Running explicit database initialization...")
    init_db()
    print("Database initialized successfully.")
