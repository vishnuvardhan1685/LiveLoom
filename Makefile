.PHONY: docker-build docker-up docker-down docker-reset smoke

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-reset:
	docker compose down -v

smoke:
	node scripts/smoke_test.js
