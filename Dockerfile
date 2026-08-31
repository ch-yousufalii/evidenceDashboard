# Official Evidence self-host image (per docs.evidence.dev/self-host/railway)
FROM evidencedev/serve:latest
COPY --chown=evidence:evidence . /project
