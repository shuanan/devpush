package agent

import "testing"

func TestAllContainersReadyRejectsUnhealthy(t *testing.T) {
	if allContainersReady([]containerStatus{{Name: "web", State: "running", Health: "unhealthy"}}) {
		t.Fatal("unhealthy container was treated as ready")
	}
	if allContainersReady([]containerStatus{{Name: "web", State: "exited", Health: "healthy"}}) {
		t.Fatal("stopped container was treated as ready")
	}
	if allContainersReady(nil) {
		t.Fatal("missing containers were treated as ready")
	}
	if !allContainersReady([]containerStatus{{Name: "web", State: "running", Health: "healthy"}}) {
		t.Fatal("healthy running container was rejected")
	}
	if !allContainersReady([]containerStatus{{Name: "web", State: "running", Health: ""}}) {
		t.Fatal("empty health is currently treated as ready")
	}
}
