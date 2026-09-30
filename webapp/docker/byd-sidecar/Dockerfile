# BYD sidecar — wraps the maintained `pybyd` library (which owns the BYD cloud
# crypto/"bangcle"/device-fingerprint logic) behind a tiny local JSON API that
# Kinboard's native `byd` vehicle driver reads. Not Home Assistant.
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 8140
# Single worker: we keep pybyd sessions in-process memory, so one worker only.
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8140", "--workers", "1"]
