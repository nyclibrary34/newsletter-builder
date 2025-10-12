#!/usr/bin/env python3
"""
Cleanup Utility for Percent-Encoded Filenames

This script scans the local file storage directory and renames any files
with literal percent-encoding in their names (like %20) to clean names with spaces.

Usage:
    python utils/cleanup_filenames.py [--dry-run]

Options:
    --dry-run    Show what would be renamed without making changes
"""

import os
import sys
import argparse
import re
from urllib.parse import unquote


# Standalone sanitization function (copied from storage.py to avoid Flask dependency)
FILENAME_ALLOWED_PATTERN = re.compile(r'[^A-Za-z0-9 _\.\-]+')
DEFAULT_EXTENSION = ".html"


def sanitize_filename(filename: str, default_extension: str = DEFAULT_EXTENSION) -> str:
    """Return a filesystem-safe filename with whitespace instead of percent escapes."""
    # Decode URL-encoded characters
    decoded = unquote(filename or "")
    # Replace any remaining percent signs with spaces
    decoded = decoded.replace('%', ' ')
    decoded = decoded.replace('\\', '/')
    decoded = os.path.basename(decoded)
    decoded = decoded.strip()

    if not decoded:
        decoded = f"newsletter{default_extension}"

    # Split into name and extension
    name, ext = os.path.splitext(decoded)
    if not ext:
        ext = default_extension
    else:
        # Clean extension: only allow alphanumeric
        cleaned_ext = ''.join(ch for ch in ext.lower().lstrip('.') if ch.isalnum())
        ext = f".{cleaned_ext}" if cleaned_ext else default_extension

    # Replace non-allowed characters with spaces
    name = FILENAME_ALLOWED_PATTERN.sub(' ', name)
    # Collapse multiple spaces
    name = re.sub(r'\s+', ' ', name).strip()

    if not name:
        name = "newsletter"

    sanitized = f"{name}{ext}"
    # Remove any double dots
    sanitized = sanitized.replace('..', '.').strip()

    if not sanitized:
        sanitized = f"newsletter{default_extension}"

    # Limit to 255 characters (filesystem limit)
    return sanitized[:255]


def cleanup_directory(base_path: str, dry_run: bool = False) -> dict:
    """
    Scan directory and rename files with percent-encoding.

    Args:
        base_path: Path to scan (usually static/files)
        dry_run: If True, only show what would be done

    Returns:
        Dictionary with statistics about the operation
    """
    stats = {
        'total_files': 0,
        'renamed_files': 0,
        'errors': 0,
        'skipped': 0
    }

    if not os.path.exists(base_path):
        print(f"Error: Directory {base_path} does not exist")
        return stats

    print(f"Scanning directory: {base_path}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print("-" * 60)

    for root, dirs, files in os.walk(base_path):
        for filename in files:
            stats['total_files'] += 1
            file_path = os.path.join(root, filename)

            # Check if filename has percent-encoding
            if '%' not in filename:
                continue

            # Get sanitized version
            clean_filename = sanitize_filename(filename)

            # Skip if no change needed
            if clean_filename == filename:
                stats['skipped'] += 1
                continue

            # Build new path
            new_path = os.path.join(root, clean_filename)

            # Check if target already exists
            if os.path.exists(new_path):
                print(f"⚠️  SKIP (target exists): {filename}")
                print(f"     Would be: {clean_filename}")
                stats['skipped'] += 1
                continue

            # Perform rename
            print(f"{'🔍' if dry_run else '✅'} {filename}")
            print(f"   → {clean_filename}")

            if not dry_run:
                try:
                    os.rename(file_path, new_path)
                    stats['renamed_files'] += 1
                except Exception as e:
                    print(f"   ❌ Error: {e}")
                    stats['errors'] += 1
            else:
                stats['renamed_files'] += 1

    print("-" * 60)
    print(f"\nStatistics:")
    print(f"  Total files scanned: {stats['total_files']}")
    print(f"  Files {'that would be ' if dry_run else ''}renamed: {stats['renamed_files']}")
    print(f"  Files skipped: {stats['skipped']}")
    print(f"  Errors: {stats['errors']}")

    return stats


def main():
    """Main entry point for the cleanup script."""
    parser = argparse.ArgumentParser(
        description="Clean up percent-encoded filenames in storage directory"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Show what would be renamed without making changes"
    )
    parser.add_argument(
        '--path',
        default='static/files',
        help="Base path to scan (default: static/files)"
    )

    args = parser.parse_args()

    # Resolve path relative to project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    base_path = os.path.join(project_root, args.path)

    print("=" * 60)
    print("Filename Cleanup Utility")
    print("=" * 60)
    print()

    stats = cleanup_directory(base_path, dry_run=args.dry_run)

    if args.dry_run:
        print("\n✨ This was a dry run. No files were actually renamed.")
        print("   Run without --dry-run to perform the cleanup.")
    elif stats['renamed_files'] > 0:
        print("\n✨ Cleanup complete!")
    else:
        print("\n✨ No files needed cleanup.")

    return 0 if stats['errors'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
