#!/usr/bin/env python
"""
Script to set up periodic session cleanup using Windows Task Scheduler.
This script generates the necessary commands and instructions for scheduling.
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def generate_task_scheduler_commands():
    """Generate Windows Task Scheduler commands for session cleanup."""

    python_exe = sys.executable
    manage_py = project_root / "manage.py"

    # Command to run the cleanup
    cleanup_cmd = f'"{python_exe}" "{manage_py}" cleanup_sessions --days 30'

    print("=== Windows Task Scheduler Setup ===")
    print()
    print("1. Open Task Scheduler (search for 'Task Scheduler' in Windows)")
    print("2. Click 'Create Basic Task' or 'Create Task'")
    print("3. Configure the task with these settings:")
    print()
    print("   Name: Medical Aid Session Cleanup")
    print("   Description: Clean up expired user sessions daily")
    print("   Trigger: Daily at 2:00 AM")
    print("   Action: Start a program")
    print(f"   Program/script: {python_exe}")
    print(f"   Add arguments: {manage_py} cleanup_sessions --days 30")
    print(f"   Start in: {project_root}")
    print()
    print("4. Under 'General' tab, check 'Run whether user is logged on or not'")
    print("5. Under 'Conditions' tab, uncheck 'Start the task only if the computer is on AC power'")
    print("6. Click OK and enter your password when prompted")
    print()
    print("=== Alternative: Manual Command ===")
    print("You can also run this manually or from a batch file:")
    print(cleanup_cmd)
    print()
    print("=== Testing the Command ===")
    print("Test the command with dry-run first:")
    print(f'"{python_exe}" "{manage_py}" cleanup_sessions --dry-run --days 30')

if __name__ == "__main__":
    generate_task_scheduler_commands()