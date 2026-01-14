from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import sys

app = Flask(__name__)
# Enable CORS for all routes so Node.js can talk to it easily
CORS(app)

@app.route('/predict', methods=['POST'])
def predict():
    # 1. LOGGING: Print the incoming request immediately
    print(f"\n[ML Service] Request Received: {request.get_data(as_text=True)}", flush=True)

    try:
        # 2. PARSE INPUT
        data = request.get_json(force=True)
        
        # Safe extraction with defaults to prevent KeyErrors
        base_price = float(data.get('basePrice', 100))
        date_str = data.get('date', '')
        room_type = data.get('roomType', 'Standard')

        # 3. VALIDATE DATE (Defensive Programming)
        if not date_str:
            raise ValueError("No date provided")

        # Parse date (Expects YYYY-MM-DD)
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        month = date_obj.month

        # 4. APPLY SEASONAL LOGIC (The Exam Requirements)
        multiplier = 1.0
        reason = "Standard Season"

        # Summer: June (6), July (7), August (8), September (9)
        if month in [6, 7, 8, 9]:
            multiplier = 1.5
            reason = "High Season (Summer)"
        
        # Winter: December (12), January (1), February (2)
        elif month in [12, 1, 2]:
            multiplier = 0.8
            reason = "Low Season (Winter)"

        # Calculate Final Price
        predicted_price = round(base_price * multiplier, 2)

        result = {
            "predictedPrice": predicted_price,
            "multiplier": multiplier,
            "reason": reason
        }

        print(f"[ML Service] Success: {result}", flush=True)
        return jsonify(result)

    except Exception as e:
        # 5. ERROR FALLBACK (Do NOT Crash)
        print(f"[ML Service] ⚠️ Error during prediction: {str(e)}", flush=True)
        
        # If anything fails (bad date format, missing data), return base price
        # This ensures the frontend still works.
        fallback_price = request.get_json(silent=True).get('basePrice', 0) if request.get_json(silent=True) else 0
        
        return jsonify({
            "predictedPrice": fallback_price,
            "reason": f"Prediction Failed (Fallback Used). Error: {str(e)}"
        })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ML Service Running", "timestamp": datetime.now().isoformat()})

if __name__ == '__main__':
    print("🚀 ML Service starting on Port 5004...", flush=True)
    # Host='0.0.0.0' is required for Docker containers to be accessible
    app.run(host='0.0.0.0', port=5004, debug=True)