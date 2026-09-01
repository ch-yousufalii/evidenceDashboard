# Evidence dashboard with a custom login page.
#
# Two processes in one container:
#   1. `evidence serve` on 127.0.0.1:3001 with auth disabled
#      (the login gateway below is the authentication boundary —
#      the pattern from docs.evidence.dev/self-host/authentication)
#   2. login-gateway/proxy.js on $PORT — styled login page, session
#      cookie, reverse proxy to the Evidence server
FROM node:20-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Install the released Evidence CLI (pinned; --http1.1 for flaky CDNs)
RUN set -e; \
	BLOB_BASE="https://gaamozau3jchzs3r.public.blob.vercel-storage.com/cli"; \
	VERSION="0.9.2"; \
	curl --http1.1 -fsSL "${BLOB_BASE}/v${VERSION}/evidence-linux-x64" -o /usr/local/bin/evidence; \
	chmod +x /usr/local/bin/evidence; \
	ln -sf /usr/local/bin/evidence /usr/local/bin/evd

WORKDIR /app
COPY . /app

EXPOSE 3000
CMD ["sh", "-c", "EVIDENCE_AUTH_DISABLED=true evidence serve --host 127.0.0.1 --port ${UPSTREAM_PORT:-3001} & exec node login-gateway/proxy.js"]
