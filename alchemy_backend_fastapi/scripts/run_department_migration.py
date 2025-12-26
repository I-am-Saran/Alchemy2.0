"""
Script to add department column to security_controls and tasks tables.
Run this script to execute the migration.
"""
import sys
import psycopg2
import os

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DB_URL

def run_migration():
    """Run the department migration."""
    migration_sql = """
-- ============================================
-- Add department column to security_controls and tasks tables
-- Auto-populate department from user's department when owner/assigned_to is set
-- ============================================

BEGIN;

-- Add department column to security_controls table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'security_controls' 
        AND column_name = 'department'
    ) THEN
        ALTER TABLE security_controls ADD COLUMN department TEXT;
    END IF;
END $$;

-- Add department column to tasks table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tasks' 
        AND column_name = 'department'
    ) THEN
        ALTER TABLE tasks ADD COLUMN department TEXT;
    END IF;
END $$;

-- Create index on department for filtering
CREATE INDEX IF NOT EXISTS idx_security_controls_department ON public.security_controls USING btree (department);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON public.tasks USING btree (department);

COMMIT;
"""
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        print("=" * 60)
        print("Running department migration...")
        print("=" * 60)
        
        # Execute the migration SQL
        cur.execute(migration_sql)
        conn.commit()
        
        # Verify the migration
        print("\nVerifying migration...")
        
        # Check security_controls table
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'security_controls' 
            AND column_name = 'department'
        """)
        if cur.fetchone():
            print("✓ Department column added to security_controls table")
        else:
            print("✗ Department column NOT found in security_controls table")
        
        # Check tasks table
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'tasks' 
            AND column_name = 'department'
        """)
        if cur.fetchone():
            print("✓ Department column added to tasks table")
        else:
            print("✗ Department column NOT found in tasks table")
        
        # Check indexes
        cur.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = 'idx_security_controls_department'
        """)
        if cur.fetchone():
            print("✓ Index created on security_controls.department")
        else:
            print("✗ Index NOT found on security_controls.department")
        
        cur.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = 'idx_tasks_department'
        """)
        if cur.fetchone():
            print("✓ Index created on tasks.department")
        else:
            print("✗ Index NOT found on tasks.department")
        
        conn.close()
        
        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)
        
    except psycopg2.Error as e:
        print(f"\n✗ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()


