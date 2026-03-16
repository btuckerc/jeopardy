# Repository Agent Instructions

## Docker Workflow

- Treat the production-style Docker workflow as the default verification path for this repo.
- Run Docker commands from the repository root: `/Users/tucker/Documents/GitHub/jeopardy`.
- Prefer the Docker Desktop binary directly because `docker` may not be on `PATH` in Codex shells:
  - `'/Applications/Docker.app/Contents/Resources/bin/docker' compose up -d --build web`
- That command is the standard way to rebuild and restart the running `web` service for verification.

## Validation Commands

- After rebuilding the image, validate against the built `jeopardy-web` image instead of the host toolchain:
  - `'/Applications/Docker.app/Contents/Resources/bin/docker' run --rm --entrypoint sh jeopardy-web -lc 'cd /app && npm run lint'`
  - `'/Applications/Docker.app/Contents/Resources/bin/docker' run --rm --entrypoint sh jeopardy-web -lc 'cd /app && npm run typecheck'`
  - `'/Applications/Docker.app/Contents/Resources/bin/docker' run --rm --entrypoint sh jeopardy-web -lc 'cd /app && npm run test:run'`

## Verification Notes

- If you only need the running service refreshed, still use the rebuild command above so the container matches the latest code.
- If a command fails, inspect the live container with:
  - `'/Applications/Docker.app/Contents/Resources/bin/docker' compose ps`
  - `'/Applications/Docker.app/Contents/Resources/bin/docker' logs --tail 200 jeopardy-web-1`
- Keep build and validation findings in the final response so later sessions have a clear baseline.
