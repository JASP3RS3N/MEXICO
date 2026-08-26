FROM python:3.11-slim

WORKDIR /app

# Install only the runtime deps needed to run the API.
COPY requirements.docker.txt .
RUN pip install --no-cache-dir -r requirements.docker.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
