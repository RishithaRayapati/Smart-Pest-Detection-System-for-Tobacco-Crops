import os
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, redirect, url_for
from werkzeug.utils import secure_filename

from config import Config
from database import db, Prediction, init_db
from model_utils import predictor, DISPLAY_NAMES, PEST_DETAILS

app = Flask(__name__)
app.config.from_object(Config)

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database
init_db(app)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def seed_database_if_empty():
    """Seeds the database with mock records if it's currently empty."""
    with app.app_context():
        if Prediction.query.count() == 0:
            print("Database is empty. Seeding mock prediction records for dashboard...")
            
            pests = ['aphids', 'budworm', 'cutworms', 'healthy', 'thrips', 'whiteflies']
            severities = ['Low', 'Medium', 'High']
            
            # Create records over the last 10 days
            now = datetime.utcnow()
            for i in range(15):
                pest_key = pests[i % len(pests)]
                details = PEST_DETAILS[pest_key]
                
                # Assign sensible random variables
                severity = 'N/A' if pest_key == 'healthy' else severities[(i + 2) % len(severities)]
                confidence = 78.4 + (i * 1.3) % 21.6
                
                # Mock filename
                filename = f"seed_{pest_key}_{i}.jpg"
                
                # Backdate records
                created_at = now - timedelta(days=10 - (i % 8), hours=i * 2)
                
                record = Prediction(
                    filename=filename,
                    predicted_class=DISPLAY_NAMES[pest_key],
                    confidence=confidence,
                    severity=severity,
                    symptoms=details['symptoms'],
                    causes=details['causes'],
                    pesticide=details['pesticide'],
                    organic_alternative=details['organic_alternative'],
                    created_at=created_at
                )
                db.session.add(record)
                
            db.session.commit()
            print("Database seeding completed.")

# Seed database
seed_database_if_empty()

@app.route('/')
def index():
    """Renders the main pest detection landing page."""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    """Renders the crop health statistics dashboard."""
    # Check if the evaluation report exists
    base_dir = os.path.dirname(os.path.abspath(__file__))
    report_path = os.path.join(base_dir, 'ml', 'evaluation_report.txt')
    accuracy = 0.85 # fallback default
    
    if os.path.exists(report_path):
        try:
            with open(report_path, 'r') as f:
                first_line = f.readline().strip()
                if "Accuracy" in first_line:
                    accuracy = float(first_line.split(":")[1].strip())
        except Exception as e:
            print(f"Error reading evaluation report: {e}")
            
    return render_template('dashboard.html', accuracy=round(accuracy * 100, 2))

@app.route('/history')
def history():
    """Renders the historical detection log page."""
    return render_template('history.html')

@app.route('/api/diagnose', methods=['POST'])
def diagnose():
    """Receives leaf image, runs inference, saves data, and returns diagnosis details."""
    if 'image' not in request.files:
        return jsonify({'error': 'No image file uploaded'}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected image file'}), 400
        
    if file and allowed_file(file.filename):
        # Create a unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        # Run CNN model inference and OpenCV analysis
        try:
            result = predictor.predict(filepath)
            
            # Save results to database
            prediction_record = Prediction(
                filename=unique_filename,
                predicted_class=result['predicted_class'],
                confidence=result['confidence'],
                severity=result['severity'],
                symptoms=result['symptoms'],
                causes=result['causes'],
                pesticide=result['pesticide'],
                organic_alternative=result['organic_alternative']
            )
            db.session.add(prediction_record)
            db.session.commit()
            
            # Return prediction response
            response = result.copy()
            response['id'] = prediction_record.id
            response['filename'] = unique_filename
            return jsonify(response), 200
            
        except Exception as e:
            # Cleanup saved file on fail
            if os.path.exists(filepath):
                os.remove(filepath)
            print(f"Diagnosis execution failed: {e}")
            return jsonify({'error': f'Diagnosis failed: {str(e)}'}), 500
            
    return jsonify({'error': 'File type not allowed. Please upload JPG, PNG or WEBP.'}), 400

@app.route('/api/history', methods=['GET'])
def get_history():
    """Retrieves all past predictions from the database, sorted by date descending."""
    try:
        predictions = Prediction.query.order_by(Prediction.created_at.desc()).all()
        return jsonify([p.to_dict() for p in predictions]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete/<int:prediction_id>', methods=['DELETE'])
def delete_prediction(prediction_id):
    """Deletes a specific prediction entry from the database and removes its image."""
    try:
        record = Prediction.query.get(prediction_id)
        if not record:
            return jsonify({'error': 'Record not found'}), 404
            
        # Delete image from uploads folder if it exists and is not a seeded image
        if record.filename and not record.filename.startswith("seed_"):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], record.filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception as e:
                    print(f"Error removing file: {e}")
                    
        db.session.delete(record)
        db.session.commit()
        return jsonify({'success': 'Record deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Aggregates prediction records for dashboard charts."""
    try:
        all_records = Prediction.query.all()
        
        # 1. Class occurrence count
        pest_counts = {}
        # 2. Severity level count
        severity_counts = {'Low': 0, 'Medium': 0, 'High': 0, 'N/A': 0}
        # 3. Chronological occurrence counts
        trend_data = {}
        
        for record in all_records:
            # Class count
            cls = record.predicted_class
            pest_counts[cls] = pest_counts.get(cls, 0) + 1
            
            # Severity count
            sev = record.severity
            if sev in severity_counts:
                severity_counts[sev] += 1
            else:
                severity_counts[sev] = 1
                
            # Trend mapping (YYYY-MM-DD)
            date_str = record.created_at.strftime('%Y-%m-%d')
            trend_data[date_str] = trend_data.get(date_str, 0) + 1
            
        # Sort trend data by date
        sorted_trend = [{'date': d, 'count': trend_data[d]} for d in sorted(trend_data.keys())]
        
        # Calculate summary statistics
        total_diagnosed = len(all_records)
        healthy_count = pest_counts.get('Healthy Plant', 0)
        infestation_count = total_diagnosed - healthy_count
        avg_confidence = sum([r.confidence for r in all_records]) / total_diagnosed if total_diagnosed > 0 else 0.0
        
        return jsonify({
            'total_diagnosed': total_diagnosed,
            'infestation_count': infestation_count,
            'healthy_count': healthy_count,
            'avg_confidence': round(avg_confidence, 2),
            'pest_counts': pest_counts,
            'severity_counts': severity_counts,
            'trend_data': sorted_trend
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Default to port 5000 in debug mode for local testing
    app.run(host='0.0.0.0', port=5000, debug=True)
