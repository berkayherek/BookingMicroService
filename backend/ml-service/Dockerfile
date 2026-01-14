# Use official Python image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy requirements first
COPY requirements.txt .

# Install dependencies (Flask, Flask-Cors)
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Run the app (Host 0.0.0.0 is CRITICAL for Docker)
CMD ["python", "app.py"]