package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRollbackSkipsPreDeployCommand(t *testing.T) {
	tempDir := workspaceTempDir(t, "agent-rollback-fixture-")
	binDir := filepath.Join(tempDir, "bin")
	dockerLog := filepath.Join(tempDir, "docker.log")
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		t.Fatal(err)
	}

	writeExecutable(t, filepath.Join(binDir, "git"), `#!/bin/sh
set -eu
if [ "$1" = "clone" ]; then
  last=""
  for arg in "$@"; do last="$arg"; done
  mkdir -p "$last"
  cat > "$last/compose.yml" <<'YAML'
services:
  web:
    image: example.invalid/unused:fixture
YAML
  exit 0
fi
if [ "$1" = "rev-parse" ]; then
  echo abc1234
  exit 0
fi
exit 1
`)
	writeExecutable(t, filepath.Join(binDir, "docker"), `#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$FAKE_DOCKER_LOG"
if [ "$1" = "version" ]; then
  exit 0
fi
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then
  exit 0
fi
case "$*" in
  *" config --format json")
    echo '{"services":{"web":{}}}'
    exit 0
    ;;
  *" run --rm "*)
    echo "pre-deploy must not run during rollback" >&2
    exit 1
    ;;
  *" ps -q")
    echo fake-container
    exit 0
    ;;
esac
if [ "$1" = "inspect" ] && [ "$2" = "-f" ]; then
  echo "/fixture-web-1	running	healthy"
  exit 0
fi
exit 0
`)
	t.Setenv("PATH", binDir+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("FAKE_DOCKER_LOG", dockerLog)

	runner := NewRunner(Config{
		AgentID:  "server-1",
		StateDir: filepath.Join(tempDir, "state"),
		Token:    "fixture-agent-token",
	}, nil)
	completion := runner.runDeploymentJob(t.Context(), deploymentJob{
		ID: "deployment-rollback",
		Repo: repo{
			FullName: "example/fixture",
			Branch:   "main",
			Token:    "fixture-token",
		},
		Runtime: runtimeConfig{
			Type:           "compose",
			Path:           "compose.yml",
			ProjectName:    "fixture_project",
			Action:         "rollback",
			ReleaseCommand: "bad-migrate",
			ReleaseService: "web",
		},
	})

	if completion.Status != "succeeded" {
		t.Fatalf("rollback fixture failed: %s\n%s", completion.Status, strings.Join(completion.Logs, "\n"))
	}
	content := strings.Join(completion.Logs, "\n")
	if strings.Contains(content, "pre-deploy") || strings.Contains(content, "bad-migrate") {
		t.Fatalf("rollback ran the pre-deploy command:\n%s", content)
	}
	dockerCommands := readFile(t, dockerLog)
	if strings.Contains(dockerCommands, "run --rm") {
		t.Fatalf("rollback invoked compose run:\n%s", dockerCommands)
	}
}
