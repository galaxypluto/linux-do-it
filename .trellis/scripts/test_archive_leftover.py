#!/usr/bin/env python3
"""Tests for archived task ghost cleanup."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from common.task_utils import prune_archived_task_ghosts, remove_leftover_task_source_dir


class ArchiveLeftoverTests(unittest.TestCase):
    def test_remove_leftover_when_archive_exists(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "active-task"
            archive = root / "archive-copy"
            source.mkdir()
            archive.mkdir()
            (source / "prd.md").write_text("stale", encoding="utf-8")
            (archive / "task.json").write_text("{}", encoding="utf-8")

            self.assertTrue(remove_leftover_task_source_dir(source, archive))
            self.assertFalse(source.exists())
            self.assertTrue(archive.exists())

    def test_noop_when_source_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = root / "archive-copy"
            archive.mkdir()
            self.assertFalse(remove_leftover_task_source_dir(root / "missing", archive))

    def test_prune_archived_task_ghosts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tasks = root / ".trellis" / "tasks"
            month = tasks / "archive" / "2026-07"
            ghost = tasks / "ghost-task"
            archived = month / "ghost-task"
            month.mkdir(parents=True)
            ghost.mkdir()
            archived.mkdir()
            (ghost / "prd.md").write_text("ghost", encoding="utf-8")
            (archived / "task.json").write_text("{}", encoding="utf-8")

            removed = prune_archived_task_ghosts(root)
            self.assertEqual(removed, ["ghost-task"])
            self.assertFalse(ghost.exists())


if __name__ == "__main__":
    unittest.main()
