# Phase I Agent Coordination

## Current Status

### Wave 1 (In Progress)
- ✅ **Task #6:** Dependencies installed (completed)
- 🔄 **Task #1:** Database schema (Agent: database-schema-agent) - IN PROGRESS
- 🔄 **Task #11:** Branding update (Agent: branding-agent) - IN PROGRESS

### Wave 2 (Blocked, waiting for Task #1)
- ⏳ **Task #2:** Media indexer service (blocked by #1)
- ⏳ **Task #7:** Indexer tests (blocked by #2)

### Wave 3 (Blocked, waiting for Task #2)
- ⏳ **Task #3:** File watcher service (blocked by #2)
- ⏳ **Task #4:** IPC handlers (blocked by #2)
- ⏳ **Task #8:** Watcher tests (blocked by #3)
- ⏳ **Task #9:** IPC tests (blocked by #4)

### Wave 4 (Blocked, waiting for Task #4)
- ⏳ **Task #5:** Basic test UI (blocked by #4)

### Wave 5 (Final, waiting for tests)
- ⏳ **Task #10:** Run full test suite (blocked by #7, #8, #9)

## Coordination Strategy

### After Task #1 completes:
Launch **2 agents in parallel:**
1. **indexer-agent** → Task #2 (Media indexer service)
2. **tests-agent** → Task #7 (Indexer tests) - can write tests from spec while indexer is being built

These can work in parallel because:
- Tests can be written from the spec/interface
- If indexer completes first, tests can run against it
- If tests complete first, they'll validate the indexer when it's done

### After Task #2 completes:
Launch **2 agents in parallel:**
1. **watcher-agent** → Task #3 (File watcher service)
2. **ipc-agent** → Task #4 (IPC handlers)

These are independent and can be built in parallel.

### After Tasks #3 and #4 complete:
Launch **3 agents in parallel:**
1. **watcher-tests-agent** → Task #8 (Watcher tests)
2. **ipc-tests-agent** → Task #9 (IPC tests)
3. **ui-agent** → Task #5 (Basic test UI)

### After Tasks #7, #8, #9 complete:
Launch **1 agent:**
1. **test-runner-agent** → Task #10 (Run full test suite)

This agent will:
- Run `npm test`
- Verify no regressions
- Fix any failing tests
- Ensure build succeeds

## File Ownership (Avoid Conflicts)

### database-schema-agent (Task #1)
- `desktop/services/database.ts`
- `shared/types.ts`
- Creates migration logic

### branding-agent (Task #11)
- `package.json` (description only, not dependencies)
- `README.md`
- `desktop/index.ts` (window title)
- Frontend UI strings

### indexer-agent (Task #2)
- Creates `desktop/services/media-indexer.ts`
- Uses types from `shared/types.ts` (read-only)
- Calls database functions (read-only)

### watcher-agent (Task #3)
- Creates `desktop/services/file-watcher.ts`
- Calls media-indexer functions (read-only)

### ipc-agent (Task #4)
- `desktop/index.ts` or creates `desktop/ipc/media-handlers.ts`
- Calls media-indexer functions (read-only)

### ui-agent (Task #5)
- Creates `frontend/pages/LocalMedia.tsx` or extends `frontend/pages/Library.tsx`
- May create `frontend/components/LocalMediaManager/`
- Calls IPC handlers (read-only)

### test agents (Tasks #7, #8, #9)
- Create new files in `tests/services/` and `tests/database/`
- Read-only access to implementation files

## Inter-Agent Communication

If an agent needs output from another agent that's still running:
1. **Wait for notification** - agents notify when complete
2. **Check task status** - use TaskList to see if blocker is done
3. **Read committed code** - once agent completes, files are on disk

## Success Criteria

Each agent should:
1. ✅ Update task status to "in_progress" when starting
2. ✅ Write clean, tested code
3. ✅ Follow existing code patterns
4. ✅ Add comments for complex logic
5. ✅ Mark task as "completed" when done
6. ✅ If blocked/error: keep task "in_progress" and report issue

## Handoff Points

### Task #1 → Task #2
**Deliverables from Task #1:**
- New `media_items` table schema
- `MediaItem` TypeScript interface in shared/types.ts
- Database functions: `insertMediaItem()`, `getMediaItems()`, `updateMediaItem()`
- Migration completed successfully

**What Task #2 needs:**
- Use `MediaItem` interface
- Call database functions to insert media items
- Reference schema for required/optional fields

### Task #2 → Tasks #3, #4
**Deliverables from Task #2:**
- `media-indexer.ts` with exported functions:
  - `scanFolder(folderPath: string): Promise<void>`
  - `indexFile(filePath: string): Promise<MediaItem | null>`
  - Events: `indexing-started`, `indexing-progress`, `indexing-completed`

**What Tasks #3, #4 need:**
- Task #3 (watcher): Call `indexFile()` when file changes detected
- Task #4 (IPC): Call `scanFolder()`, `getMediaItems()` from database

### Task #4 → Task #5
**Deliverables from Task #4:**
- IPC handlers registered:
  - `add-local-folder`
  - `get-media-items`
  - `get-indexed-folders`
  - `rescan-folder`

**What Task #5 needs:**
- Call IPC handlers from React components
- Display results in UI

## Rollback Strategy

If any agent fails or causes issues:
1. Git status shows uncommitted changes
2. Review changes with `git diff`
3. If problematic: `git checkout -- <file>` to revert
4. If OK: Continue to next task

Keep local, don't push until Phase I is complete and tested.

## Final Integration (After All Tasks)

Once all tasks #1-9 are complete:
1. Run full test suite (Task #10)
2. Manual testing:
   - Add a local folder
   - Verify files are indexed
   - Check sorting/filtering
   - Right-click → Copy Path
   - Verify no YouTube regression
3. If issues: Create fix tasks
4. When stable: Commit all changes
5. Test locally one more time
6. Then push to remote

## Communication Back to Coordinator

Each agent should report when complete:
- What was accomplished
- Any issues encountered
- Any follow-up tasks needed
- Files modified
- Task status updated

The coordinator will:
- Verify completion
- Launch next wave of agents
- Coordinate handoffs
- Resolve conflicts if any
