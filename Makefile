VENV := .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip

$(VENV):
	python3 -m venv $(VENV)

install: $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	cd web && npm install

server:
	$(VENV)/bin/uvicorn app.main:app --reload --reload-dir app

ui:
	cd && npm run dev

clean:
	rm -rf $(VENV) __pycache__ app/__pycache__ web/node_modules
	find . -type f -name '*Zone.Identifier*' -delete

docker-db:
	docker compose up --build -d

docker-down-db:
	docker compose down
